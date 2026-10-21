import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OKX_BASE = "https://openapi.okx.com";

/*
 * Default universe used by automatic collection.
 * We can later make this dynamic from your scanner.
 */
const DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "WLDUSDT",
];

type MarkPriceData = {
  markPx?: string;
  ts?: string;
};

type OpenInterestData = {
  oi?: string;
  oiCcy?: string;
  oiUsd?: string;
  ts?: string;
};

type OkxResponse<T> = {
  code: string;
  msg: string;
  data: T[];
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSymbol(value: string): string {
  const symbol = value
    .trim()
    .toUpperCase()
    .replace(/[-_/]/g, "");

  if (!symbol.endsWith("USDT")) {
    throw new Error(
      `Unsupported symbol ${value}. Only USDT pairs are supported.`
    );
  }

  return symbol;
}

function toOkxSwapSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  const base = normalized.slice(0, -4);

  if (!base) {
    throw new Error(`Invalid symbol: ${symbol}`);
  }

  return `${base}-USDT-SWAP`;
}

async function fetchOkx<T>(
  path: string
): Promise<OkxResponse<T>> {
  const response = await fetch(`${OKX_BASE}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`OKX HTTP error ${response.status}`);
  }

  const json = (await response.json()) as OkxResponse<T>;

  if (json.code !== "0") {
    throw new Error(json.msg || `OKX API error ${json.code}`);
  }

  return json;
}

/*
 * Fetch one symbol.
 */
async function getSnapshot(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  const providerSymbol = toOkxSwapSymbol(normalized);

  const markPath =
    `/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(
      providerSymbol
    )}`;

  const oiPath =
    `/api/v5/public/open-interest?instType=SWAP&instId=${encodeURIComponent(
      providerSymbol
    )}`;

  const [markResponse, oiResponse] = await Promise.all([
    fetchOkx<MarkPriceData>(markPath),
    fetchOkx<OpenInterestData>(oiPath),
  ]);

  const mark = markResponse.data[0];
  const oi = oiResponse.data[0];

  if (!mark || !oi) {
    throw new Error(`No OKX data returned for ${providerSymbol}`);
  }

  const price = safeNumber(mark.markPx);

  const openInterestContracts = safeNumber(oi.oi);
  const openInterestBase = safeNumber(oi.oiCcy);

  let openInterestUsd = safeNumber(oi.oiUsd);

  /*
   * Fallback only if OKX doesn't return oiUsd.
   */
  if (openInterestUsd <= 0 && openInterestBase > 0 && price > 0) {
    openInterestUsd = openInterestBase * price;
  }

  if (price <= 0) {
    throw new Error(`Invalid price returned for ${providerSymbol}`);
  }

  if (openInterestUsd <= 0) {
    throw new Error(
      `Invalid open interest returned for ${providerSymbol}`
    );
  }

  return {
    symbol: normalized,
    providerSymbol,

    price,

    open_interest_usd: openInterestUsd,

    open_interest_base:
      openInterestBase > 0 ? openInterestBase : null,

    open_interest_contracts:
      openInterestContracts > 0 ? openInterestContracts : null,

    source: "OKX",
  };
}

export async function GET(request: NextRequest) {
  try {
        /*
     * Protect automatic snapshot collection.
     *
     * Vercel Cron sends:
     * Authorization: Bearer <CRON_SECRET>
     */
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      throw new Error("CRON_SECRET is missing.");
    }

    const authorization = request.headers.get("authorization");

    const isAuthorized =
      authorization === `Bearer ${cronSecret}`;

    /*
     * Allow localhost testing without the secret.
     * Production requests must be authenticated.
     */
    const hostname = request.nextUrl.hostname;

    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1";

    if (!isAuthorized && !isLocalhost) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized snapshot request.",
        },
        {
          status: 401,
        }
      );
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
    }

    if (!secretKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    /*
     * Optional:
     *
     * ?symbol=BTCUSDT
     *
     * still lets us test one coin.
     *
     * Without ?symbol=...
     * the route collects the complete universe.
     */
    const requestedSymbol =
      request.nextUrl.searchParams.get("symbol");

    const symbols = requestedSymbol
      ? [normalizeSymbol(requestedSymbol)]
      : DEFAULT_SYMBOLS;

    /*
     * Promise.allSettled is important.
     *
     * If WLD fails, BTC/ETH/etc. can still
     * be saved instead of killing the
     * complete collection job.
     */
    const results = await Promise.allSettled(
      symbols.map((symbol) => getSnapshot(symbol))
    );

    const successfulSnapshots: Awaited<
      ReturnType<typeof getSnapshot>
    >[] = [];

    const failedSymbols: {
      symbol: string;
      error: string;
    }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulSnapshots.push(result.value);
      } else {
        failedSymbols.push({
          symbol: symbols[index],

          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    if (successfulSnapshots.length === 0) {
      throw new Error(
        "No valid open-interest snapshots were returned by OKX."
      );
    }

    /*
     * One Supabase insert for all successful symbols.
     */
    const rows = successfulSnapshots.map((snapshot) => ({
      symbol: snapshot.symbol,
      price: snapshot.price,
      open_interest_usd: snapshot.open_interest_usd,
      open_interest_base: snapshot.open_interest_base,
      open_interest_contracts: snapshot.open_interest_contracts,
      source: snapshot.source,
    }));

    const { data, error } = await supabase
      .from("trading_oi_snapshots")
      .insert(rows)
      .select(
        `
          id,
          symbol,
          price,
          open_interest_usd,
          open_interest_base,
          open_interest_contracts,
          source,
          captured_at
        `
      );

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,

      version: "oi-snapshot-v2-multi-symbol",

      mode: requestedSymbol ? "single-symbol" : "multi-symbol",

      message: requestedSymbol
        ? "Open-interest snapshot saved."
        : "Open-interest snapshots saved for trading universe.",

      requested: symbols.length,

      saved: data?.length ?? 0,

      failed: failedSymbols.length,

      symbolsSaved:
        data?.map((row) => row.symbol) ?? [],

      failures: failedSymbols,

      snapshots: data ?? [],

      collection: {
        defaultSymbols: DEFAULT_SYMBOLS,

        intendedIntervalMinutes: 5,

        historicalWindows: ["15m", "1h", "4h"],
      },

      source: "OKX USDT Perpetual Swap",

      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("OI multi-snapshot error:", error);

    return NextResponse.json(
      {
        success: false,

        version: "oi-snapshot-v2-multi-symbol",

        error:
          error instanceof Error
            ? error.message
            : "Unable to save open-interest snapshots.",
      },
      {
        status: 500,
      }
    );
  }
}