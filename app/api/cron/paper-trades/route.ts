import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BASE = "https://data-api.binance.vision";
const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);

/*
 * Paper-trade execution is always evaluated with 1-minute candles,
 * regardless of the strategy timeframe that created the signal.
 *
 * This prevents a 1h/4h candle from including price action that happened
 * before the paper trade existed.
 */
const EXECUTION_INTERVAL = "1m";
const EXECUTION_INTERVAL_MS = 60_000;

type Trade = {
  id: string;
  symbol: string;
  interval: string;
  signal: "LONG" | "SHORT";
  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  status: string;
  opened_at: string;
  max_favorable_excursion_percent: number | null;
  max_adverse_excursion_percent: number | null;
};

type Candle = {
  openTime: number;
  high: number;
  low: number;
  close: number;
  closeTime: number;
};

function toNumber(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}


function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is missing.");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    throw new Error("CRON_SECRET is missing.");
  }

  const authorization = request.headers.get("authorization") || "";
  const bearerSecret = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const headerSecret = request.headers.get("x-cron-secret") || "";

  return bearerSecret === expectedSecret || headerSecret === expectedSecret;
}

async function fetchCandles(
  symbol: string,
  startTime: number
): Promise<Candle[]> {
  const output: Candle[] = [];
  const now = Date.now();

  /*
   * Start only from the first COMPLETE 1-minute candle whose open time is
   * at or after the trade creation time.
   *
   * Example:
   * trade opened 17:42:18
   * first evaluated candle 17:43:00-17:43:59
   *
   * We intentionally ignore the partial 17:42 candle because its OHLC
   * contains price action from before 17:42:18 and cannot be separated
   * using standard OHLC data.
   */
  let cursor =
    Math.ceil(startTime / EXECUTION_INTERVAL_MS) *
    EXECUTION_INTERVAL_MS;

  for (let page = 0; page < 20 && cursor <= now; page += 1) {
    const url = new URL(`${BINANCE_BASE}/api/v3/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", EXECUTION_INTERVAL);
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("limit", "1000");

    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(
        `Binance 1m execution candles failed for ${symbol}: HTTP ${response.status}`
      );
    }

    const rows = (await response.json()) as unknown[][];

    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const candle: Candle = {
        openTime: Number(row[0]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        closeTime: Number(row[6]),
      };

      if (
        Number.isFinite(candle.openTime) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.closeTime) &&
        candle.openTime >= cursor
      ) {
        output.push(candle);
      }
    }

    const last = output.at(-1);

    if (!last || rows.length < 1000) {
      break;
    }

    const nextCursor = last.openTime + EXECUTION_INTERVAL_MS;

    if (nextCursor <= cursor) {
      break;
    }

    cursor = nextCursor;
  }

  return Array.from(
    new Map(output.map((item) => [item.openTime, item])).values()
  ).sort((a, b) => a.openTime - b.openTime);
}

function calculatePnlPercent(
  signal: "LONG" | "SHORT",
  entry: number,
  exit: number
) {
  if (entry <= 0) return 0;

  return signal === "LONG"
    ? ((exit - entry) / entry) * 100
    : ((entry - exit) / entry) * 100;
}

function evaluateTrade(trade: Trade, candles: Candle[]) {
  const entryLow = toNumber(trade.entry_low);
  const entryHigh = toNumber(trade.entry_high);
  const stop = toNumber(trade.stop_loss);
  const tp1 = toNumber(trade.tp1);
  const tp2 = toNumber(trade.tp2);
  const tp3 = toNumber(trade.tp3);

  if (
    entryLow === null ||
    entryHigh === null ||
    stop === null ||
    tp1 === null ||
    tp2 === null ||
    tp3 === null
  ) {
    throw new Error("Trade is missing entry, stop-loss, or take-profit levels.");
  }

  const entry = (entryLow + entryHigh) / 2;
  const openedAt = new Date(trade.opened_at).getTime();

  if (!Number.isFinite(openedAt)) {
    throw new Error("Trade opened_at is invalid.");
  }

  const trackingStart =
    Math.ceil(openedAt / EXECUTION_INTERVAL_MS) *
    EXECUTION_INTERVAL_MS;

  const relevantCandles = candles.filter(
    (candle) => candle.openTime >= trackingStart
  );

  let status = trade.status;
  let highestTarget = status === "TP2_HIT" ? 2 : status === "TP1_HIT" ? 1 : 0;
  let exitPrice: number | null = null;
  let closedAt: string | null = null;
  let ambiguous = false;
  let maxFavorable = Number(trade.max_favorable_excursion_percent ?? 0);
  let maxAdverse = Number(trade.max_adverse_excursion_percent ?? 0);

  for (const candle of relevantCandles) {
    const favorable =
      trade.signal === "LONG"
        ? ((candle.high - entry) / entry) * 100
        : ((entry - candle.low) / entry) * 100;

    const adverse =
      trade.signal === "LONG"
        ? ((entry - candle.low) / entry) * 100
        : ((candle.high - entry) / entry) * 100;

    maxFavorable = Math.max(maxFavorable, favorable);
    maxAdverse = Math.max(maxAdverse, adverse);

    const stopHit =
      trade.signal === "LONG" ? candle.low <= stop : candle.high >= stop;

    const tp1Hit =
      trade.signal === "LONG" ? candle.high >= tp1 : candle.low <= tp1;

    const tp2Hit =
      trade.signal === "LONG" ? candle.high >= tp2 : candle.low <= tp2;

    const tp3Hit =
      trade.signal === "LONG" ? candle.high >= tp3 : candle.low <= tp3;

    const deepestTarget = tp3Hit ? 3 : tp2Hit ? 2 : tp1Hit ? 1 : 0;

    // Conservative backtest rule: if SL and TP were both touched inside
    // the same OHLC candle, count the stop first because intrabar order
    // cannot be proven from OHLC data alone.
    if (stopHit) {
      if (deepestTarget > 0) ambiguous = true;

      status = "STOPPED";
      exitPrice = stop;
      closedAt = new Date(candle.closeTime).toISOString();
      break;
    }

    highestTarget = Math.max(highestTarget, deepestTarget);

    if (highestTarget >= 3) {
      status = "TP3_HIT";
      exitPrice = tp3;
      closedAt = new Date(candle.closeTime).toISOString();
      break;
    }

    if (highestTarget === 2) {
      status = "TP2_HIT";
    } else if (highestTarget === 1) {
      status = "TP1_HIT";
    }
  }

  const isClosed = status === "TP3_HIT" || status === "STOPPED";

  const pnlPercent =
    isClosed && exitPrice !== null
      ? round(calculatePnlPercent(trade.signal, entry, exitPrice))
      : null;

  return {
    status,
    highestTarget,
    exitPrice,
    closedAt,
    pnlPercent,
    maxFavorable: round(maxFavorable),
    maxAdverse: round(maxAdverse),
    ambiguous,
    candlesChecked: relevantCandles.length,
    lastPrice: relevantCandles.at(-1)?.close ?? null,
    trackingStart: new Date(trackingStart).toISOString(),
    executionInterval: EXECUTION_INTERVAL,
  };
}

async function runTracker() {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("paper_trades")
    .select(
      "id,symbol,interval,signal,entry_low,entry_high,stop_loss,tp1,tp2,tp3,status,opened_at,max_favorable_excursion_percent,max_adverse_excursion_percent"
    )
    .in("status", ["OPEN", "TP1_HIT", "TP2_HIT"])
    .order("opened_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const trades = (data ?? []) as Trade[];
  const results: Record<string, unknown>[] = [];

  for (const trade of trades) {
    try {
      if (!VALID_INTERVALS.has(trade.interval)) {
        throw new Error(`Unsupported interval: ${trade.interval}`);
      }

      const openedAt = new Date(trade.opened_at).getTime();

      if (!Number.isFinite(openedAt)) {
        throw new Error("Trade opened_at is invalid.");
      }

      const marketCandles = await fetchCandles(
        trade.symbol,
        openedAt
      );

      const result = evaluateTrade(trade, marketCandles);
      const previousMfe = Number(trade.max_favorable_excursion_percent ?? 0);
      const previousMae = Number(trade.max_adverse_excursion_percent ?? 0);

      const changed =
        result.status !== trade.status ||
        result.maxFavorable !== previousMfe ||
        result.maxAdverse !== previousMae;

      if (changed) {
        const updatePayload: Record<string, unknown> = {
          status: result.status,
          max_favorable_excursion_percent: result.maxFavorable,
          max_adverse_excursion_percent: result.maxAdverse,
        };

        if (result.exitPrice !== null) {
          updatePayload.exit_price = result.exitPrice;
        }

        if (result.closedAt) {
          updatePayload.closed_at = result.closedAt;
        }

        if (result.pnlPercent !== null) {
          updatePayload.pnl_percent = result.pnlPercent;
        }

        const { error: updateError } = await supabase
          .from("paper_trades")
          .update(updatePayload)
          .eq("id", trade.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      results.push({
        success: true,
        id: trade.id,
        symbol: trade.symbol,
        interval: trade.interval,
        signal: trade.signal,
        previousStatus: trade.status,
        status: result.status,
        changed,
        highestTarget: result.highestTarget,
        exitPrice: result.exitPrice,
        pnlPercent: result.pnlPercent,
        maxFavorableExcursionPercent: result.maxFavorable,
        maxAdverseExcursionPercent: result.maxAdverse,
        strategyInterval: trade.interval,
        executionInterval: result.executionInterval,
        trackingStart: result.trackingStart,
        candlesChecked: result.candlesChecked,
        lastPrice: result.lastPrice,
        ambiguousIntrabarOutcome: result.ambiguous,
        ambiguityPolicy: result.ambiguous
          ? "SL and TP were touched inside the same OHLC candle, so stop-loss was conservatively assumed first."
          : null,
      });
    } catch (error) {
      results.push({
        success: false,
        id: trade.id,
        symbol: trade.symbol,
        interval: trade.interval,
        error: error instanceof Error ? error.message : "Tracking failed.",
      });
    }
  }

  return {
    success: true,
    checked: trades.length,
    updated: results.filter(
      (item) => item.success === true && item.changed === true
    ).length,
    results,
    methodology:
      "Paper-trade execution is evaluated with Binance Spot 1-minute candles, independent of the strategy timeframe. Tracking begins at the first full 1-minute candle at or after opened_at, so OHLC price action from before the signal cannot contaminate results. The partial opening minute is intentionally skipped. TP3 or stop closes the trade; TP1/TP2 keep it active. Same-1m-candle TP/SL ambiguity uses the conservative stop-first assumption.",
    updatedAt: new Date().toISOString(),
  };
}

async function handleCron(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const result = await runTracker();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Paper trade cron error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to run paper-trade cron.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
