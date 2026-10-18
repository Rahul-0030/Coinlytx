import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCAN_INTERVAL = "1h";
const BATCH_SIZE = 10;
const TOTAL_BATCHES = 5;
const CONCURRENCY = 2;

const ACTIVE_STATUSES = ["OPEN", "TP1_HIT", "TP2_HIT"];

type Market = {
  symbol: string;
  baseAsset?: string;
};

type SymbolsResponse = {
  success?: boolean;
  symbols?: Market[];
  error?: string;
};

type FinalResponse = {
  success?: boolean;
  error?: string;
  symbol?: string;
  interval?: string;
  finalDecision?: "LONG" | "SHORT" | "WAIT";
  decisionScore?: number;
  confidence?: number;
  confidenceType?: string;
  strongConflict?: boolean;
  currentPrice?: number;
  tradePlan?: {
    entryLow?: number | null;
    entryHigh?: number | null;
    stopLoss?: number | null;
    tp1?: number | null;
    tp2?: number | null;
    tp3?: number | null;
    invalidation?: number | null;
    riskReward?: string | null;
  };
  selectedTimeframe?: {
    score?: number;
    signal?: string;
    interval?: string;
    confidence?: number;
  };
  multiTimeframe?: {
    weightedScore?: number;
    alignment?: string;
    consensusSignal?: string;
    confidence?: number;
  };
  intelligenceScores?: {
    technical?: number;
    derivatives?: number;
    whale?: number;
    stablecoin?: number;
    catalyst?: number;
    macro?: number;
  };
  intelligenceWeights?: {
    technical?: number;
    derivatives?: number;
    whale?: number;
    stablecoin?: number;
    catalyst?: number;
    macro?: number;
  };
  decisionContributions?: {
    selectedSignalScore?: number;
    multiTimeframeScore?: number;
  };
  updatedAt?: string;
};

type LatestTrade = {
  id: string;
  status: string;
  signal: string;
  opened_at: string;
  closed_at: string | null;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is missing.");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    throw new Error("CRON_SECRET is missing.");
  }

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const headerSecret = request.headers.get("x-cron-secret") || "";

  return bearer === expected || headerSecret === expected;
}

function safeNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getBatchIndex(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("batch");

  if (raw !== null) {
    const parsed = Number.parseInt(raw, 10);

    if (Number.isInteger(parsed) && parsed >= 0 && parsed < TOTAL_BATCHES) {
      return parsed;
    }
  }

  const fiveMinuteBucket = Math.floor(Date.now() / 300_000);
  return fiveMinuteBucket % TOTAL_BATCHES;
}

function cooldownMinutes(interval: string) {
  const map: Record<string, number> = {
    "1m": 5,
    "5m": 15,
    "15m": 30,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
  };

  return map[interval] ?? 60;
}

async function fetchJson<T>(url: string, timeoutMs = 45_000): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `Request failed: HTTP ${response.status}`);
  }

  return data;
}

function hasValidTradePlan(data: FinalResponse) {
  const plan = data.tradePlan;

  if (!plan) {
    return false;
  }

  return [
    plan.entryLow,
    plan.entryHigh,
    plan.stopLoss,
    plan.tp1,
    plan.tp2,
    plan.tp3,
  ].every((value) => safeNumber(value) !== null);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker()
    )
  );

  return results;
}

async function processSymbol(origin: string, symbol: string) {
  const supabase = getAdminSupabase();

  const { data: latestRows, error: latestError } = await supabase
    .from("paper_trades")
    .select("id,status,signal,opened_at,closed_at")
    .eq("symbol", symbol)
    .eq("interval", SCAN_INTERVAL)
    .order("opened_at", { ascending: false })
    .limit(1);

  if (latestError) {
    throw new Error(latestError.message);
  }

  const latest = (latestRows ?? [])[0] as LatestTrade | undefined;

  if (latest && ACTIVE_STATUSES.includes(latest.status)) {
    return {
      symbol,
      action: "SKIPPED",
      reason: "ACTIVE_TRADE_EXISTS",
      activeTradeId: latest.id,
      activeStatus: latest.status,
    };
  }

  if (latest?.closed_at) {
    const closedAt = new Date(latest.closed_at).getTime();
    const cooldownMs = cooldownMinutes(SCAN_INTERVAL) * 60_000;

    if (Number.isFinite(closedAt) && Date.now() - closedAt < cooldownMs) {
      return {
        symbol,
        action: "SKIPPED",
        reason: "COOLDOWN_AFTER_CLOSED_TRADE",
        previousTradeId: latest.id,
        previousStatus: latest.status,
        cooldownMinutes: cooldownMinutes(SCAN_INTERVAL),
      };
    }
  }

  const finalUrl = new URL("/api/trading/final", origin);
  finalUrl.searchParams.set("symbol", symbol);
  finalUrl.searchParams.set("interval", SCAN_INTERVAL);

  const final = await fetchJson<FinalResponse>(finalUrl.toString());

  if (!final.success) {
    throw new Error(
      final.error || "Final trading engine returned an unsuccessful response."
    );
  }

  if (final.symbol !== symbol) {
    throw new Error(
      `Final engine symbol mismatch. Requested ${symbol}, received ${final.symbol}.`
    );
  }

  if (final.interval !== SCAN_INTERVAL) {
    throw new Error(
      `Final engine interval mismatch. Requested ${SCAN_INTERVAL}, received ${final.interval}.`
    );
  }

  const decision = final.finalDecision;

  if (decision !== "LONG" && decision !== "SHORT") {
    return {
      symbol,
      action: "SKIPPED",
      reason: "WAIT",
      finalDecision: decision || "WAIT",
      decisionScore: safeNumber(final.decisionScore),
      confidence: safeNumber(final.confidence),
    };
  }

  if (final.strongConflict) {
    return {
      symbol,
      action: "SKIPPED",
      reason: "STRONG_CONFLICT",
      finalDecision: decision,
      decisionScore: safeNumber(final.decisionScore),
      confidence: safeNumber(final.confidence),
    };
  }

  if (!hasValidTradePlan(final)) {
    return {
      symbol,
      action: "SKIPPED",
      reason: "INVALID_TRADE_PLAN",
      finalDecision: decision,
    };
  }

  const currentPrice = safeNumber(final.currentPrice);
  const decisionScore = safeNumber(final.decisionScore);
  const confidence = safeNumber(final.confidence);

  if (currentPrice === null || decisionScore === null || confidence === null) {
    return {
      symbol,
      action: "SKIPPED",
      reason: "MISSING_REQUIRED_SIGNAL_DATA",
      finalDecision: decision,
    };
  }

  const { data: activeRows, error: activeError } = await supabase
    .from("paper_trades")
    .select("id,status")
    .eq("symbol", symbol)
    .eq("interval", SCAN_INTERVAL)
    .in("status", ACTIVE_STATUSES)
    .limit(1);

  if (activeError) {
    throw new Error(activeError.message);
  }

  if ((activeRows ?? []).length > 0) {
    return {
      symbol,
      action: "SKIPPED",
      reason: "ACTIVE_TRADE_CREATED_DURING_SCAN",
    };
  }

  const plan = final.tradePlan!;
  const selectedSignalScore = safeNumber(
    final.selectedTimeframe?.score ??
      final.decisionContributions?.selectedSignalScore
  );
  const multiTimeframeScore = safeNumber(
    final.multiTimeframe?.weightedScore ??
      final.decisionContributions?.multiTimeframeScore
  );

  const sourceUpdatedAt =
    final.updatedAt && !Number.isNaN(Date.parse(final.updatedAt))
      ? final.updatedAt
      : new Date().toISOString();

  const payload = {
    symbol,
    interval: SCAN_INTERVAL,
    signal: decision,
    decision_score: decisionScore,
    confidence,
    current_price: currentPrice,
    entry_low: safeNumber(plan.entryLow),
    entry_high: safeNumber(plan.entryHigh),
    stop_loss: safeNumber(plan.stopLoss),
    tp1: safeNumber(plan.tp1),
    tp2: safeNumber(plan.tp2),
    tp3: safeNumber(plan.tp3),
    invalidation: safeNumber(plan.invalidation),
    risk_reward: plan.riskReward ?? null,
    status: "OPEN",
    selected_signal_score: selectedSignalScore,
    multi_timeframe_score: multiTimeframeScore,
    multi_timeframe_alignment: final.multiTimeframe?.alignment ?? null,
    technical_score: safeNumber(final.intelligenceScores?.technical),
    derivatives_score: safeNumber(final.intelligenceScores?.derivatives),
    whale_score: safeNumber(final.intelligenceScores?.whale),
    stablecoin_score: safeNumber(final.intelligenceScores?.stablecoin),
    catalyst_score: safeNumber(final.intelligenceScores?.catalyst),
    macro_score: safeNumber(final.intelligenceScores?.macro),
    technical_weight: safeNumber(final.intelligenceWeights?.technical),
    derivatives_weight: safeNumber(final.intelligenceWeights?.derivatives),
    whale_weight: safeNumber(final.intelligenceWeights?.whale),
    stablecoin_weight: safeNumber(final.intelligenceWeights?.stablecoin),
    catalyst_weight: safeNumber(final.intelligenceWeights?.catalyst),
    macro_weight: safeNumber(final.intelligenceWeights?.macro),
    source_updated_at: sourceUpdatedAt,
    snapshot: {
      ...final,
      _paperTrading: {
        createdBy: "automatic-top50-scanner",
        scannerVersion: "v1",
        scanInterval: SCAN_INTERVAL,
        batchSize: BATCH_SIZE,
        createdAt: new Date().toISOString(),
        confidenceMeaning:
          "Heuristic model score, not calibrated win probability.",
      },
    },
  };

  const { data: inserted, error: insertError } = await supabase
    .from("paper_trades")
    .insert(payload)
    .select("id,symbol,interval,signal,status,opened_at")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    symbol,
    action: "CREATED",
    trade: inserted,
    finalDecision: decision,
    decisionScore,
    confidence,
  };
}

async function runScanner(request: NextRequest) {
  const startedAt = Date.now();
  const origin = request.nextUrl.origin;
  const batchIndex = getBatchIndex(request);

  const symbolsUrl = new URL("/api/trading/symbols", origin);
  const symbolsResponse = await fetchJson<SymbolsResponse>(
    symbolsUrl.toString(),
    20_000
  );

  if (!symbolsResponse.success) {
    throw new Error(
      symbolsResponse.error || "Unable to load Top-50 trading symbols."
    );
  }

  const allSymbols = (symbolsResponse.symbols ?? [])
    .map((item) => item.symbol)
    .filter(Boolean)
    .slice(0, 50);

  if (allSymbols.length === 0) {
    throw new Error("No trading symbols were returned.");
  }

  const start = batchIndex * BATCH_SIZE;
  const batch = allSymbols.slice(start, start + BATCH_SIZE);

  const results = await mapWithConcurrency(
    batch,
    CONCURRENCY,
    async (symbol) => {
      try {
        return await processSymbol(origin, symbol);
      } catch (error) {
        return {
          symbol,
          action: "ERROR",
          error:
            error instanceof Error ? error.message : "Unknown scanner error.",
        };
      }
    }
  );

  const created = results.filter((item: any) => item.action === "CREATED").length;
  const skipped = results.filter((item: any) => item.action === "SKIPPED").length;
  const errors = results.filter((item: any) => item.action === "ERROR").length;

  return {
    success: true,
    scannerVersion: "v1",
    interval: SCAN_INTERVAL,
    batch: {
      index: batchIndex,
      totalBatches: TOTAL_BATCHES,
      batchSize: BATCH_SIZE,
      symbols: batch,
    },
    summary: {
      scanned: batch.length,
      created,
      skipped,
      errors,
    },
    results,
    safeguards: {
      onlyLongOrShort: true,
      waitSignalsSkipped: true,
      strongConflictSkipped: true,
      activeTradeDeduplication: true,
      postCloseCooldownMinutes: cooldownMinutes(SCAN_INTERVAL),
      concurrency: CONCURRENCY,
      liveOrderExecution: false,
    },
    durationMs: Date.now() - startedAt,
    updatedAt: new Date().toISOString(),
  };
}

async function handle(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const result = await runScanner(request);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Paper trade scanner error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to run paper-trade scanner.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
