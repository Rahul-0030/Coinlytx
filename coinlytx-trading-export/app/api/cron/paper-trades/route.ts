import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BASE = "https://data-api.binance.vision";
const EXECUTION_INTERVAL = "1m";
const ONE_MINUTE_MS = 60_000;

const ACTIVE_STATUSES = [
  "PENDING_ENTRY",
  "OPEN",
  "TP1_HIT",
  "TP2_HIT",
] as const;

type Trade = {
  id: string;
  symbol: string;
  interval: string;
  signal: "LONG" | "SHORT";
  entry_low: number | null;
  entry_high: number | null;
  entry_price: number | null;
  entry_filled_at: string | null;
  entry_expires_at: string | null;
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
  open: number;
  high: number;
  low: number;
  close: number;
  closeTime: number;
};

type Levels = {
  entryLow: number;
  entryHigh: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function ceilToMinute(timestamp: number) {
  return Math.ceil(timestamp / ONE_MINUTE_MS) * ONE_MINUTE_MS;
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
  let cursor = Math.max(0, startTime);

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
        `Binance candles failed for ${symbol}: HTTP ${response.status}`
      );
    }

    const rows = (await response.json()) as unknown[][];

    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const candle: Candle = {
        openTime: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        closeTime: Number(row[6]),
      };

      if (
        Number.isFinite(candle.openTime) &&
        Number.isFinite(candle.open) &&
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

    const nextCursor = last.openTime + ONE_MINUTE_MS;

    if (nextCursor <= cursor) {
      break;
    }

    cursor = nextCursor;
  }

  return Array.from(
    new Map(output.map((item) => [item.openTime, item])).values()
  ).sort((a, b) => a.openTime - b.openTime);
}

function getLevels(trade: Trade): Levels {
  const rawEntryLow = toNumber(trade.entry_low);
  const rawEntryHigh = toNumber(trade.entry_high);
  const stop = toNumber(trade.stop_loss);
  const tp1 = toNumber(trade.tp1);
  const tp2 = toNumber(trade.tp2);
  const tp3 = toNumber(trade.tp3);

  if (
    rawEntryLow === null ||
    rawEntryHigh === null ||
    stop === null ||
    tp1 === null ||
    tp2 === null ||
    tp3 === null
  ) {
    throw new Error("Trade is missing entry, stop-loss, or take-profit levels.");
  }

  const entryLow = Math.min(rawEntryLow, rawEntryHigh);
  const entryHigh = Math.max(rawEntryLow, rawEntryHigh);

  return {
    entryLow,
    entryHigh,
    stop,
    tp1,
    tp2,
    tp3,
  };
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

function candleTouchesEntry(
  candle: Candle,
  entryLow: number,
  entryHigh: number
) {
  return candle.high >= entryLow && candle.low <= entryHigh;
}

function estimateEntryPrice(
  candle: Candle,
  entryLow: number,
  entryHigh: number
) {
  if (candle.open >= entryLow && candle.open <= entryHigh) {
    return candle.open;
  }

  if (candle.open < entryLow) {
    return entryLow;
  }

  return entryHigh;
}

function stopTouched(
  signal: "LONG" | "SHORT",
  candle: Candle,
  stop: number
) {
  return signal === "LONG" ? candle.low <= stop : candle.high >= stop;
}

function deepestTargetTouched(
  signal: "LONG" | "SHORT",
  candle: Candle,
  tp1: number,
  tp2: number,
  tp3: number
) {
  const tp1Hit = signal === "LONG" ? candle.high >= tp1 : candle.low <= tp1;
  const tp2Hit = signal === "LONG" ? candle.high >= tp2 : candle.low <= tp2;
  const tp3Hit = signal === "LONG" ? candle.high >= tp3 : candle.low <= tp3;

  return tp3Hit ? 3 : tp2Hit ? 2 : tp1Hit ? 1 : 0;
}

function evaluatePendingEntry(trade: Trade, candles: Candle[]) {
  const levels = getLevels(trade);
  const openedAt = new Date(trade.opened_at).getTime();

  if (!Number.isFinite(openedAt)) {
    throw new Error("Trade opened_at is invalid.");
  }

  const expiresAt = trade.entry_expires_at
    ? new Date(trade.entry_expires_at).getTime()
    : NaN;

  if (!Number.isFinite(expiresAt)) {
    throw new Error(
      "PENDING_ENTRY trade is missing a valid entry_expires_at."
    );
  }

  const trackingStart = ceilToMinute(openedAt);
  const now = Date.now();
  const relevantCandles = candles.filter(
    (candle) => candle.openTime >= trackingStart
  );

  const fillEligibleCandles = relevantCandles.filter((candle) => {
    if (now < expiresAt) {
      return candle.openTime < expiresAt;
    }

    return candle.closeTime <= expiresAt;
  });

  const fillCandle = fillEligibleCandles.find((candle) =>
    candleTouchesEntry(candle, levels.entryLow, levels.entryHigh)
  );

  if (!fillCandle) {
    const expired = now >= expiresAt;

    return {
      status: expired ? "EXPIRED" : "PENDING_ENTRY",
      changed: expired,
      entryFilledAt: null as string | null,
      entryPrice: null as number | null,
      exitPrice: null as number | null,
      closedAt: expired ? new Date(expiresAt).toISOString() : null,
      pnlPercent: null as number | null,
      maxFavorable: Number(
        trade.max_favorable_excursion_percent ?? 0
      ),
      maxAdverse: Number(
        trade.max_adverse_excursion_percent ?? 0
      ),
      highestTarget: 0,
      candlesChecked: fillEligibleCandles.length,
      lastPrice: relevantCandles.at(-1)?.close ?? null,
      trackingStart: new Date(trackingStart).toISOString(),
      entryExpired: expired,
      entryFilled: false,
      entryFillCandleOpenTime: null as string | null,
      ambiguous: false,
      ambiguityPolicy: null as string | null,
    };
  }

  const entryPrice = estimateEntryPrice(
    fillCandle,
    levels.entryLow,
    levels.entryHigh
  );

  const entryFilledAt = new Date(fillCandle.closeTime).toISOString();
  const fillCandleStopHit = stopTouched(
    trade.signal,
    fillCandle,
    levels.stop
  );
  const fillCandleTarget = deepestTargetTouched(
    trade.signal,
    fillCandle,
    levels.tp1,
    levels.tp2,
    levels.tp3
  );

  if (fillCandleStopHit) {
    return {
      status: "STOPPED",
      changed: true,
      entryFilledAt,
      entryPrice,
      exitPrice: levels.stop,
      closedAt: entryFilledAt,
      pnlPercent: round(
        calculatePnlPercent(trade.signal, entryPrice, levels.stop)
      ),
      maxFavorable: 0,
      maxAdverse: round(
        Math.max(
          0,
          calculatePnlPercent(trade.signal, entryPrice, levels.stop) * -1
        )
      ),
      highestTarget: 0,
      candlesChecked:
        fillEligibleCandles.findIndex(
          (candle) => candle.openTime === fillCandle.openTime
        ) + 1,
      lastPrice: fillCandle.close,
      trackingStart: new Date(trackingStart).toISOString(),
      entryExpired: false,
      entryFilled: true,
      entryFillCandleOpenTime: new Date(fillCandle.openTime).toISOString(),
      ambiguous: true,
      ambiguityPolicy:
        fillCandleTarget > 0
          ? "Entry, stop-loss and at least one take-profit were touched inside the same 1-minute fill candle. Intrabar order is unknown, so the conservative stop-first outcome was used."
          : "Entry and stop-loss were touched inside the same 1-minute fill candle. Intrabar order is unknown, so the conservative assumption is that entry filled before the stop.",
    };
  }

  return {
    status: "OPEN",
    changed: true,
    entryFilledAt,
    entryPrice,
    exitPrice: null as number | null,
    closedAt: null as string | null,
    pnlPercent: null as number | null,
    maxFavorable: 0,
    maxAdverse: 0,
    highestTarget: 0,
    candlesChecked:
      fillEligibleCandles.findIndex(
        (candle) => candle.openTime === fillCandle.openTime
      ) + 1,
    lastPrice: fillCandle.close,
    trackingStart: new Date(trackingStart).toISOString(),
    entryExpired: false,
    entryFilled: true,
    entryFillCandleOpenTime: new Date(fillCandle.openTime).toISOString(),
    ambiguous: false,
    ambiguityPolicy:
      fillCandleTarget > 0
        ? "A take-profit level was also touched inside the entry-fill candle, but it was not credited because OHLC cannot prove it occurred after the entry."
        : null,
  };
}

function evaluateOpenTrade(trade: Trade, candles: Candle[]) {
  const levels = getLevels(trade);
  const storedEntry = toNumber(trade.entry_price);
  const entry =
    storedEntry !== null && storedEntry > 0
      ? storedEntry
      : (levels.entryLow + levels.entryHigh) / 2;

  const entryTimeSource = trade.entry_filled_at || trade.opened_at;
  const entryTime = new Date(entryTimeSource).getTime();

  if (!Number.isFinite(entryTime)) {
    throw new Error("Trade entry time is invalid.");
  }

  const trackingStart = ceilToMinute(entryTime);
  const relevantCandles = candles.filter(
    (candle) => candle.openTime >= trackingStart
  );

  let status = trade.status;
  let highestTarget =
    status === "TP2_HIT" ? 2 : status === "TP1_HIT" ? 1 : 0;
  let exitPrice: number | null = null;
  let closedAt: string | null = null;
  let ambiguous = false;
  let maxFavorable = Number(
    trade.max_favorable_excursion_percent ?? 0
  );
  let maxAdverse = Number(
    trade.max_adverse_excursion_percent ?? 0
  );

  for (const candle of relevantCandles) {
    const favorable =
      trade.signal === "LONG"
        ? ((candle.high - entry) / entry) * 100
        : ((entry - candle.low) / entry) * 100;

    const adverse =
      trade.signal === "LONG"
        ? ((entry - candle.low) / entry) * 100
        : ((candle.high - entry) / entry) * 100;

    maxFavorable = Math.max(maxFavorable, favorable, 0);
    maxAdverse = Math.max(maxAdverse, adverse, 0);

    const stopHit = stopTouched(trade.signal, candle, levels.stop);
    const deepestTarget = deepestTargetTouched(
      trade.signal,
      candle,
      levels.tp1,
      levels.tp2,
      levels.tp3
    );

    if (stopHit) {
      if (deepestTarget > 0) {
        ambiguous = true;
      }

      status = "STOPPED";
      exitPrice = levels.stop;
      closedAt = new Date(candle.closeTime).toISOString();
      break;
    }

    highestTarget = Math.max(highestTarget, deepestTarget);

    if (highestTarget >= 3) {
      status = "TP3_HIT";
      exitPrice = levels.tp3;
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
    entryPrice: entry,
    highestTarget,
    exitPrice,
    closedAt,
    pnlPercent,
    maxFavorable: round(maxFavorable),
    maxAdverse: round(maxAdverse),
    ambiguous,
    ambiguityPolicy: ambiguous
      ? "Stop-loss and at least one take-profit were touched inside the same 1-minute candle, so the conservative stop-first assumption was used."
      : null,
    candlesChecked: relevantCandles.length,
    lastPrice: relevantCandles.at(-1)?.close ?? null,
    trackingStart: new Date(trackingStart).toISOString(),
  };
}

async function runTracker() {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("paper_trades")
    .select(
      "id,symbol,interval,signal,entry_low,entry_high,entry_price,entry_filled_at,entry_expires_at,stop_loss,tp1,tp2,tp3,status,opened_at,max_favorable_excursion_percent,max_adverse_excursion_percent"
    )
    .in("status", [...ACTIVE_STATUSES])
    .order("opened_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const trades = (data ?? []) as Trade[];
  const results: Record<string, unknown>[] = [];

  for (const trade of trades) {
    try {
      if (trade.status === "PENDING_ENTRY") {
        const signalStart = ceilToMinute(
          new Date(trade.opened_at).getTime()
        );
        const marketCandles = await fetchCandles(trade.symbol, signalStart);
        const result = evaluatePendingEntry(trade, marketCandles);

        if (result.changed) {
          const updatePayload: Record<string, unknown> = {
            status: result.status,
          };

          if (result.entryFilledAt) {
            updatePayload.entry_filled_at = result.entryFilledAt;
          }

          if (result.entryPrice !== null) {
            updatePayload.entry_price = result.entryPrice;
          }

          if (result.status === "STOPPED") {
            updatePayload.max_favorable_excursion_percent =
              result.maxFavorable;
            updatePayload.max_adverse_excursion_percent = result.maxAdverse;
            updatePayload.exit_price = result.exitPrice;
            updatePayload.closed_at = result.closedAt;
            updatePayload.pnl_percent = result.pnlPercent;
          }

          if (result.status === "EXPIRED") {
            updatePayload.closed_at = result.closedAt;
          }

          const { error: updateError } = await supabase
            .from("paper_trades")
            .update(updatePayload)
            .eq("id", trade.id)
            .eq("status", "PENDING_ENTRY");

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
          changed: result.changed,
          entryFilled: result.entryFilled,
          entryPrice: result.entryPrice,
          entryFilledAt: result.entryFilledAt,
          entryExpiresAt: trade.entry_expires_at,
          entryExpired: result.entryExpired,
          entryFillCandleOpenTime: result.entryFillCandleOpenTime,
          highestTarget: result.highestTarget,
          exitPrice: result.exitPrice,
          pnlPercent: result.pnlPercent,
          maxFavorableExcursionPercent: result.maxFavorable,
          maxAdverseExcursionPercent: result.maxAdverse,
          strategyInterval: trade.interval,
          executionInterval: EXECUTION_INTERVAL,
          trackingStart: result.trackingStart,
          candlesChecked: result.candlesChecked,
          lastPrice: result.lastPrice,
          ambiguousIntrabarOutcome: result.ambiguous,
          ambiguityPolicy: result.ambiguityPolicy,
        });

        continue;
      }

      const entryTimeSource = trade.entry_filled_at || trade.opened_at;
      const trackingStart = ceilToMinute(
        new Date(entryTimeSource).getTime()
      );
      const marketCandles = await fetchCandles(trade.symbol, trackingStart);
      const result = evaluateOpenTrade(trade, marketCandles);
      const previousMfe = Number(
        trade.max_favorable_excursion_percent ?? 0
      );
      const previousMae = Number(
        trade.max_adverse_excursion_percent ?? 0
      );
      const storedEntry = toNumber(trade.entry_price);

      const changed =
        result.status !== trade.status ||
        result.maxFavorable !== previousMfe ||
        result.maxAdverse !== previousMae ||
        storedEntry === null;

      if (changed) {
        const updatePayload: Record<string, unknown> = {
          status: result.status,
          entry_price: result.entryPrice,
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
          .eq("id", trade.id)
          .in("status", ["OPEN", "TP1_HIT", "TP2_HIT"]);

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
        entryFilled: true,
        entryPrice: result.entryPrice,
        entryFilledAt: trade.entry_filled_at,
        entryExpiresAt: trade.entry_expires_at,
        highestTarget: result.highestTarget,
        exitPrice: result.exitPrice,
        pnlPercent: result.pnlPercent,
        maxFavorableExcursionPercent: result.maxFavorable,
        maxAdverseExcursionPercent: result.maxAdverse,
        strategyInterval: trade.interval,
        executionInterval: EXECUTION_INTERVAL,
        trackingStart: result.trackingStart,
        candlesChecked: result.candlesChecked,
        lastPrice: result.lastPrice,
        ambiguousIntrabarOutcome: result.ambiguous,
        ambiguityPolicy: result.ambiguityPolicy,
      });
    } catch (error) {
      results.push({
        success: false,
        id: trade.id,
        symbol: trade.symbol,
        interval: trade.interval,
        previousStatus: trade.status,
        error: error instanceof Error ? error.message : "Tracking failed.",
      });
    }
  }

  return {
    success: true,
    trackerVersion: "v3-pending-entry",
    checked: trades.length,
    updated: results.filter(
      (item) => item.success === true && item.changed === true
    ).length,
    pendingEntries: results.filter(
      (item) => item.success === true && item.status === "PENDING_ENTRY"
    ).length,
    entriesFilled: results.filter(
      (item) =>
        item.success === true &&
        item.previousStatus === "PENDING_ENTRY" &&
        item.entryFilled === true
    ).length,
    expiredEntries: results.filter(
      (item) => item.success === true && item.status === "EXPIRED"
    ).length,
    results,
    methodology:
      "Signals created by the automatic scanner begin as PENDING_ENTRY. Binance Spot 1-minute candles are checked from the first full minute after signal creation. A trade becomes OPEN only after price touches its entry zone before entry_expires_at. The fill candle is not used to credit take-profit progress or MFE/MAE because OHLC cannot prove movement occurred after the fill; if the stop is also touched in the fill candle, the conservative stop-first outcome is used. After entry, execution is evaluated with 1-minute candles independent of the strategy timeframe. TP3 or stop closes the trade; TP1/TP2 keep it active. Same-1m-candle TP/SL ambiguity uses the conservative stop-first assumption.",
    liveOrderExecution: false,
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
