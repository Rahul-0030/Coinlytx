import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BASE = "https://data-api.binance.vision";
const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);

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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 4) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function intervalMs(interval: string) {
  const values: Record<string, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
  };

  return values[interval] ?? 3_600_000;
}

async function getAuthenticatedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: error ? null : user,
  };
}

async function fetchCandles(
  symbol: string,
  interval: string,
  startTime: number
): Promise<Candle[]> {
  const output: Candle[] = [];
  const now = Date.now();
  let cursor = Math.max(0, startTime - intervalMs(interval));

  for (let page = 0; page < 20 && cursor <= now; page += 1) {
    const url = new URL(`${BINANCE_BASE}/api/v3/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("limit", "1000");

    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(
        `Binance candle request failed for ${symbol}: HTTP ${response.status}`
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
        Number.isFinite(candle.closeTime)
      ) {
        output.push(candle);
      }
    }

    const last = output.at(-1);

    if (!last || rows.length < 1000) {
      break;
    }

    const nextCursor = last.openTime + intervalMs(interval);

    if (nextCursor <= cursor) {
      break;
    }

    cursor = nextCursor;
  }

  return Array.from(
    new Map(output.map((item) => [item.openTime, item])).values()
  ).sort((a, b) => a.openTime - b.openTime);
}

function calculatePnl(
  signal: "LONG" | "SHORT",
  entry: number,
  exit: number
) {
  if (entry <= 0) {
    return 0;
  }

  return signal === "LONG"
    ? ((exit - entry) / entry) * 100
    : ((entry - exit) / entry) * 100;
}

function evaluateTrade(trade: Trade, candleData: Candle[]) {
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
  const relevantCandles = candleData.filter(
    (candle) => candle.closeTime >= openedAt
  );

  let status = trade.status;
  let highestTarget =
    status === "TP2_HIT" ? 2 : status === "TP1_HIT" ? 1 : 0;

  let exitPrice: number | null = null;
  let closedAt: string | null = null;
  let ambiguousIntrabarOutcome = false;

  let maxFavorableExcursionPercent = Number(
    trade.max_favorable_excursion_percent ?? 0
  );
  let maxAdverseExcursionPercent = Number(
    trade.max_adverse_excursion_percent ?? 0
  );

  for (const candle of relevantCandles) {
    const favorableMove =
      trade.signal === "LONG"
        ? ((candle.high - entry) / entry) * 100
        : ((entry - candle.low) / entry) * 100;

    const adverseMove =
      trade.signal === "LONG"
        ? ((entry - candle.low) / entry) * 100
        : ((candle.high - entry) / entry) * 100;

    maxFavorableExcursionPercent = Math.max(
      maxFavorableExcursionPercent,
      favorableMove
    );

    maxAdverseExcursionPercent = Math.max(
      maxAdverseExcursionPercent,
      adverseMove
    );

    const stopTouched =
      trade.signal === "LONG"
        ? candle.low <= stop
        : candle.high >= stop;

    const tp1Touched =
      trade.signal === "LONG"
        ? candle.high >= tp1
        : candle.low <= tp1;

    const tp2Touched =
      trade.signal === "LONG"
        ? candle.high >= tp2
        : candle.low <= tp2;

    const tp3Touched =
      trade.signal === "LONG"
        ? candle.high >= tp3
        : candle.low <= tp3;

    const deepestTarget = tp3Touched
      ? 3
      : tp2Touched
        ? 2
        : tp1Touched
          ? 1
          : 0;

    // OHLC candles do not reveal the order of events inside the candle.
    // If both a target and the stop were touched, use the conservative
    // assumption that the stop-loss happened first.
    if (stopTouched) {
      if (deepestTarget > 0) {
        ambiguousIntrabarOutcome = true;
      }

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

  return {
    status,
    exitPrice,
    closedAt,
    pnlPercent:
      isClosed && exitPrice !== null
        ? round(calculatePnl(trade.signal, entry, exitPrice), 4)
        : null,
    maxFavorableExcursionPercent: round(maxFavorableExcursionPercent, 4),
    maxAdverseExcursionPercent: round(maxAdverseExcursionPercent, 4),
    highestTarget,
    ambiguousIntrabarOutcome,
    candlesChecked: relevantCandles.length,
    lastPrice: relevantCandles.at(-1)?.close ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    let body: {
      id?: string;
      symbol?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    let query = supabase
      .from("paper_trades")
      .select(
        "id,symbol,interval,signal,entry_low,entry_high,stop_loss,tp1,tp2,tp3,status,opened_at,max_favorable_excursion_percent,max_adverse_excursion_percent"
      )
      .in("status", ["OPEN", "TP1_HIT", "TP2_HIT"])
      .order("opened_at", {
        ascending: true,
      });

    if (body.id) {
      query = query.eq("id", body.id);
    }

    if (body.symbol) {
      query = query.eq(
        "symbol",
        body.symbol.trim().toUpperCase()
      );
    }

    const {
      data,
      error,
    } = await query;

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

        const marketCandles = await fetchCandles(
          trade.symbol,
          trade.interval,
          new Date(trade.opened_at).getTime()
        );

        const result = evaluateTrade(trade, marketCandles);

        const changed =
          result.status !== trade.status ||
          result.maxFavorableExcursionPercent !==
            Number(trade.max_favorable_excursion_percent ?? 0) ||
          result.maxAdverseExcursionPercent !==
            Number(trade.max_adverse_excursion_percent ?? 0);

        if (changed) {
          const updatePayload: Record<string, unknown> = {
            status: result.status,
            max_favorable_excursion_percent:
              result.maxFavorableExcursionPercent,
            max_adverse_excursion_percent:
              result.maxAdverseExcursionPercent,
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

          const {
            error: updateError,
          } = await supabase
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
          maxFavorableExcursionPercent:
            result.maxFavorableExcursionPercent,
          maxAdverseExcursionPercent:
            result.maxAdverseExcursionPercent,
          candlesChecked: result.candlesChecked,
          lastPrice: result.lastPrice,
          ambiguousIntrabarOutcome:
            result.ambiguousIntrabarOutcome,
          ambiguityPolicy: result.ambiguousIntrabarOutcome
            ? "SL and TP were touched inside the same OHLC candle, so stop-loss was conservatively assumed first."
            : null,
        });
      } catch (tradeError) {
        results.push({
          success: false,
          id: trade.id,
          symbol: trade.symbol,
          error:
            tradeError instanceof Error
              ? tradeError.message
              : "Tracking failed for this trade.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      checked: trades.length,
      updated: results.filter(
        (item) => item.success === true && item.changed === true
      ).length,
      results,
      methodology:
        "Binance spot candle high/low is checked from opened_at onward. TP3 or stop closes the trade. TP1/TP2 keep it active. Same-candle TP/SL ambiguity uses the conservative stop-first assumption.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Paper trade tracker error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to track paper trades.",
      },
      {
        status: 500,
      }
    );
  }
}
