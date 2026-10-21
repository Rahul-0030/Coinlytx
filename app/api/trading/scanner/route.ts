import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCANNER_VERSION = "scanner-v2-best-per-symbol";

const DEFAULT_SYMBOL_LIMIT = 10;
const MAX_SYMBOL_LIMIT = 50;

const SCAN_INTERVALS = ["15m", "1h", "4h"] as const;

const PRE_SCAN_CONCURRENCY = 8;
const FINAL_SCAN_CONCURRENCY = 3;

const MAX_FINAL_CANDIDATES = 20;
const MAX_RESULTS = 20;

const MIN_PRE_SCAN_SCORE = 30;
const MIN_FINAL_DECISION_SCORE = 30;

type ScanInterval = (typeof SCAN_INTERVALS)[number];
type Direction = "LONG" | "SHORT";
type UnknownRecord = Record<string, unknown>;

type PreScanCandidate = {
  symbol: string;
  interval: ScanInterval;
  direction: Direction;

  technicalScore: number;
  absoluteScore: number;
  confidence: number | null;

  rsi: number | null;
  currentPrice: number | null;
  support: number | null;
  resistance: number | null;

  preRankScore: number;
};

type RankedSetup = {
  rank: number;

  symbol: string;
  interval: string;
  decision: Direction;

  setupStrength: number;

  decisionScore: number;
  confidence: number | null;
  confidenceType: string;

  confirmationCount: number;
  confirmationRequired: number;
  confirmationPassed: boolean;

  entryLow: number;
  entryHigh: number;
  entryMid: number;

  stopLoss: number;

  tp1: number;
  tp2: number;
  tp3: number;

  tp1R: number;
  tp2R: number;
  tp3R: number;

  invalidation: number | null;

  multiTimeframeSignal: string | null;
  multiTimeframeAlignment: string | null;

  higherTimeframeTrend: string | null;
  higherTimeframeScore: number | null;

  selectedTimeframeScore: number | null;
  technicalScore: number | null;
  derivativesScore: number | null;
  derivativesBias: string | null;

  currentPrice: number | null;

  confirmations: string[];
  bullishReasons: string[];
  bearishReasons: string[];
  risks: string[];

  finalVersion: string | null;
  updatedAt: string | null;
};

type FinalResponse = {
  success?: boolean;
  version?: string;

  symbol?: string;
  interval?: string;

  finalDecision?: string;
  decisionScore?: number;

  confidence?: number;
  confidenceType?: string;

  strongConflict?: boolean;
  currentPrice?: number;

  confirmationGate?: {
    required?: number;
    longConfirmationCount?: number;
    shortConfirmationCount?: number;
    passed?: boolean;
  };

  selectedTimeframe?: {
    interval?: string;
    signal?: string;
    score?: number;
    confidence?: number;
    technicalScore?: number;
    derivativesScore?: number;
  };

  multiTimeframe?: {
    consensusSignal?: string;
    weightedScore?: number;
    confidence?: number;
    alignment?: string;
    trendConflict?: boolean;
    higherTimeframeTrend?: string;
    higherTimeframeScore?: number;
  };

  tradePlan?: {
    entryLow?: number;
    entryHigh?: number;
    stopLoss?: number;
    tp1?: number;
    tp2?: number;
    tp3?: number;
    invalidation?: number;
  };

  derivatives?: {
    bias?: string;
  };

  confirmations?: string[];
  bullishReasons?: string[];
  bearishReasons?: string[];
  risks?: string[];

  updatedAt?: string;

  [key: string]: unknown;
};


// =========================================================
// GENERIC HELPERS
// =========================================================

function asRecord(value: unknown): UnknownRecord | null {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(max, Math.max(min, value));
}

function round(
  value: number,
  digits = 2
) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function normalizeSignal(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase()
    : "";
}

function normalizeSymbol(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase()
    : "";
}

function isDirection(
  value: unknown
): value is Direction {
  return value === "LONG" || value === "SHORT";
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}


// =========================================================
// FETCH HELPER
// =========================================================

async function fetchJson(
  url: string,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const raw = await response.text();

    let json: unknown;

    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        `Invalid JSON response from ${url}. HTTP ${response.status}.`
      );
    }

    if (!response.ok) {
      const record = asRecord(json);

      const message =
        typeof record?.error === "string"
          ? record.error
          : `HTTP ${response.status}`;

      throw new Error(message);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}


// =========================================================
// CONCURRENCY
// =========================================================

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (
    item: T,
    index: number
  ) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(
        items[index],
        index
      );
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => runWorker()
    )
  );

  return results;
}


// =========================================================
// SYMBOL LOADING
// =========================================================

function extractSymbols(
  payload: unknown
): string[] {
  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  const possibleArrays = [
    record.symbols,
    record.markets,
    record.data,
  ];

  for (const possible of possibleArrays) {
    if (!Array.isArray(possible)) {
      continue;
    }

    const symbols = possible
      .map((item) => {
        if (typeof item === "string") {
          return normalizeSymbol(item);
        }

        const itemRecord = asRecord(item);

        if (!itemRecord) {
          return "";
        }

        return normalizeSymbol(
          itemRecord.symbol ??
            itemRecord.value ??
            itemRecord.id
        );
      })
      .filter(Boolean)
      .filter((symbol) =>
        symbol.endsWith("USDT")
      );

    if (symbols.length > 0) {
      return Array.from(
        new Set(symbols)
      );
    }
  }

  return [];
}

async function loadSymbols(
  baseUrl: string,
  limit: number
) {
  const url =
    `${baseUrl}/api/trading/symbols?limit=${limit}`;

  const json = await fetchJson(
    url,
    15_000
  );

  const symbols = extractSymbols(json);

  if (symbols.length === 0) {
    throw new Error(
      "No USDT symbols returned by /api/trading/symbols."
    );
  }

  return symbols.slice(0, limit);
}


// =========================================================
// TECHNICAL PRE-SCAN
// =========================================================

function extractTechnicalCandidate(
  payload: unknown,
  symbol: string,
  interval: ScanInterval
): PreScanCandidate | null {
  const root = asRecord(payload);

  if (!root || root.success === false) {
    return null;
  }

  const nested =
    asRecord(root.technical) ??
    asRecord(root.analysis) ??
    asRecord(root.data);

  const source = nested ?? root;

  const signal = normalizeSignal(
    source.signal ??
      source.finalSignal ??
      source.decision ??
      root.signal
  );

  if (!isDirection(signal)) {
    return null;
  }

  const technicalScore =
    finiteNumber(
      source.score ??
        source.technicalScore ??
        root.score ??
        root.technicalScore
    ) ?? 0;

  const absoluteScore =
    Math.abs(technicalScore);

  if (
    absoluteScore <
    MIN_PRE_SCAN_SCORE
  ) {
    return null;
  }

  // Direction and score must agree.
  if (
    signal === "LONG" &&
    technicalScore < 0
  ) {
    return null;
  }

  if (
    signal === "SHORT" &&
    technicalScore > 0
  ) {
    return null;
  }

  const confidence =
    finiteNumber(
      source.confidence ??
        root.confidence
    );

  const indicators =
    asRecord(source.indicators);

  const rsi =
    finiteNumber(
      source.rsi ??
        indicators?.rsi ??
        root.rsi
    );

  const currentPrice =
    finiteNumber(
      source.currentPrice ??
        source.price ??
        root.currentPrice ??
        root.price
    );

  const support =
    finiteNumber(
      source.support ??
        root.support
    );

  const resistance =
    finiteNumber(
      source.resistance ??
        root.resistance
    );

  const confidenceComponent =
    confidence !== null
      ? clamp(
          confidence,
          0,
          100
        ) * 0.2
      : 0;

  const preRankScore =
    absoluteScore * 0.8 +
    confidenceComponent;

  return {
    symbol,
    interval,
    direction: signal,

    technicalScore,
    absoluteScore,

    confidence,
    rsi,
    currentPrice,
    support,
    resistance,

    preRankScore:
      round(
        preRankScore,
        2
      ),
  };
}

async function runTechnicalPreScan(
  baseUrl: string,
  symbol: string,
  interval: ScanInterval
): Promise<PreScanCandidate | null> {
  try {
    const url =
      `${baseUrl}/api/trading/technical` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${encodeURIComponent(interval)}`;

    const json = await fetchJson(
      url,
      15_000
    );

    return extractTechnicalCandidate(
      json,
      symbol,
      interval
    );
  } catch (error) {
    console.warn(
      `[scanner] Technical scan failed: ${symbol} ${interval}`,
      error
    );

    return null;
  }
}


// =========================================================
// RISK / REWARD
// =========================================================

function calculateRiskReward(
  direction: Direction,
  entry: number,
  stopLoss: number,
  target: number
) {
  let risk: number;
  let reward: number;

  if (direction === "LONG") {
    risk =
      entry - stopLoss;

    reward =
      target - entry;
  } else {
    risk =
      stopLoss - entry;

    reward =
      entry - target;
  }

  if (
    !Number.isFinite(risk) ||
    !Number.isFinite(reward) ||
    risk <= 0 ||
    reward <= 0
  ) {
    return null;
  }

  return reward / risk;
}

function validTradeGeometry(
  direction: Direction,
  entryLow: number,
  entryHigh: number,
  stopLoss: number,
  tp1: number,
  tp2: number,
  tp3: number
) {
  if (
    entryLow <= 0 ||
    entryHigh <= 0 ||
    stopLoss <= 0 ||
    tp1 <= 0 ||
    tp2 <= 0 ||
    tp3 <= 0
  ) {
    return false;
  }

  if (entryLow > entryHigh) {
    return false;
  }

  const entry =
    (entryLow + entryHigh) / 2;

  if (direction === "LONG") {
    return (
      stopLoss < entry &&
      tp1 > entry &&
      tp2 > tp1 &&
      tp3 > tp2
    );
  }

  return (
    stopLoss > entry &&
    tp1 < entry &&
    tp2 < tp1 &&
    tp3 < tp2
  );
}


// =========================================================
// FINAL ANALYSIS PARSER
// =========================================================

function buildRankedSetup(
  payload: unknown
): Omit<RankedSetup, "rank"> | null {
  const data =
    asRecord(payload) as
      | FinalResponse
      | null;

  if (
    !data ||
    data.success !== true
  ) {
    return null;
  }

  const decision =
    normalizeSignal(
      data.finalDecision
    );

  if (!isDirection(decision)) {
    return null;
  }

  if (
    data.strongConflict === true
  ) {
    return null;
  }

  const decisionScore =
    finiteNumber(
      data.decisionScore
    );

  if (decisionScore === null) {
    return null;
  }

  if (
    decision === "LONG" &&
    decisionScore <
      MIN_FINAL_DECISION_SCORE
  ) {
    return null;
  }

  if (
    decision === "SHORT" &&
    decisionScore >
      -MIN_FINAL_DECISION_SCORE
  ) {
    return null;
  }

  const gate =
    data.confirmationGate;

  if (
    !gate ||
    gate.passed !== true
  ) {
    return null;
  }

  const confirmationRequired =
    finiteNumber(
      gate.required
    ) ?? 2;

  const confirmationCount =
    decision === "LONG"
      ? finiteNumber(
          gate.longConfirmationCount
        ) ?? 0
      : finiteNumber(
          gate.shortConfirmationCount
        ) ?? 0;

  if (
    confirmationCount <
    confirmationRequired
  ) {
    return null;
  }

  const plan =
    data.tradePlan;

  if (!plan) {
    return null;
  }

  const entryLow =
    finiteNumber(
      plan.entryLow
    );

  const entryHigh =
    finiteNumber(
      plan.entryHigh
    );

  const stopLoss =
    finiteNumber(
      plan.stopLoss
    );

  const tp1 =
    finiteNumber(
      plan.tp1
    );

  const tp2 =
    finiteNumber(
      plan.tp2
    );

  const tp3 =
    finiteNumber(
      plan.tp3
    );

  if (
    entryLow === null ||
    entryHigh === null ||
    stopLoss === null ||
    tp1 === null ||
    tp2 === null ||
    tp3 === null
  ) {
    return null;
  }

  if (
    !validTradeGeometry(
      decision,
      entryLow,
      entryHigh,
      stopLoss,
      tp1,
      tp2,
      tp3
    )
  ) {
    return null;
  }

  const entryMid =
    (entryLow + entryHigh) / 2;

  const tp1R =
    calculateRiskReward(
      decision,
      entryMid,
      stopLoss,
      tp1
    );

  const tp2R =
    calculateRiskReward(
      decision,
      entryMid,
      stopLoss,
      tp2
    );

  const tp3R =
    calculateRiskReward(
      decision,
      entryMid,
      stopLoss,
      tp3
    );

  if (
    tp1R === null ||
    tp2R === null ||
    tp3R === null
  ) {
    return null;
  }

  const confidence =
    finiteNumber(
      data.confidence
    );

  const selectedConfidence =
    finiteNumber(
      data.selectedTimeframe
        ?.confidence
    ) ?? 0;

  const mtfConfidence =
    finiteNumber(
      data.multiTimeframe
        ?.confidence
    ) ?? 0;

  const absoluteDecisionScore =
    Math.abs(
      decisionScore
    );

  // Setup Strength is only a ranking score.
  // It is NOT a win probability.
  let setupStrength =
    absoluteDecisionScore * 0.55 +
    (confidence ?? 0) * 0.2 +
    mtfConfidence * 0.15 +
    selectedConfidence * 0.1;

  if (
    confirmationCount >= 3
  ) {
    setupStrength += 3;
  }

  const alignment =
    data.multiTimeframe
      ?.alignment;

  if (
    decision === "LONG" &&
    alignment ===
      "STRONG_BULLISH"
  ) {
    setupStrength += 2;
  }

  if (
    decision === "SHORT" &&
    alignment ===
      "STRONG_BEARISH"
  ) {
    setupStrength += 2;
  }

  if (
    data.multiTimeframe
      ?.trendConflict === true
  ) {
    setupStrength -= 8;
  }

  // Small reward for good TP1 R:R.
  // Capped so huge targets cannot dominate ranking.
  setupStrength +=
    clamp(
      tp1R,
      0,
      3
    ) * 2;

  setupStrength =
    clamp(
      setupStrength,
      0,
      100
    );

  return {
    symbol:
      normalizeSymbol(
        data.symbol
      ),

    interval:
      typeof data.interval ===
      "string"
        ? data.interval
        : "",

    decision,

    setupStrength:
      round(
        setupStrength,
        1
      ),

    decisionScore:
      round(
        decisionScore,
        1
      ),

    confidence:
      confidence !== null
        ? round(
            confidence,
            1
          )
        : null,

    confidenceType:
      typeof data.confidenceType ===
      "string"
        ? data.confidenceType
        : "heuristic",

    confirmationCount,
    confirmationRequired,
    confirmationPassed: true,

    entryLow,
    entryHigh,

    entryMid:
      round(
        entryMid,
        10
      ),

    stopLoss,

    tp1,
    tp2,
    tp3,

    tp1R:
      round(
        tp1R,
        2
      ),

    tp2R:
      round(
        tp2R,
        2
      ),

    tp3R:
      round(
        tp3R,
        2
      ),

    invalidation:
      finiteNumber(
        plan.invalidation
      ),

    multiTimeframeSignal:
      typeof data
        .multiTimeframe
        ?.consensusSignal ===
      "string"
        ? data
            .multiTimeframe
            .consensusSignal
        : null,

    multiTimeframeAlignment:
      typeof alignment ===
      "string"
        ? alignment
        : null,

    higherTimeframeTrend:
      typeof data
        .multiTimeframe
        ?.higherTimeframeTrend ===
      "string"
        ? data
            .multiTimeframe
            .higherTimeframeTrend
        : null,

    higherTimeframeScore:
      finiteNumber(
        data.multiTimeframe
          ?.higherTimeframeScore
      ),

    selectedTimeframeScore:
      finiteNumber(
        data.selectedTimeframe
          ?.score
      ),

    technicalScore:
      finiteNumber(
        data.selectedTimeframe
          ?.technicalScore
      ),

    derivativesScore:
      finiteNumber(
        data.selectedTimeframe
          ?.derivativesScore
      ),

    derivativesBias:
      typeof data.derivatives
        ?.bias === "string"
        ? data.derivatives.bias
        : null,

    currentPrice:
      finiteNumber(
        data.currentPrice
      ),

    confirmations:
      uniqueStrings(
        data.confirmations
      ),

    bullishReasons:
      uniqueStrings(
        data.bullishReasons
      ),

    bearishReasons:
      uniqueStrings(
        data.bearishReasons
      ),

    risks:
      uniqueStrings(
        data.risks
      ),

    finalVersion:
      typeof data.version ===
      "string"
        ? data.version
        : null,

    updatedAt:
      typeof data.updatedAt ===
      "string"
        ? data.updatedAt
        : null,
  };
}


// =========================================================
// FULL FINAL-V2 ANALYSIS
// =========================================================

async function runFinalAnalysis(
  baseUrl: string,
  candidate: PreScanCandidate
): Promise<
  Omit<RankedSetup, "rank"> | null
> {
  try {
    const url =
      `${baseUrl}/api/trading/final` +
      `?symbol=${encodeURIComponent(
        candidate.symbol
      )}` +
      `&interval=${encodeURIComponent(
        candidate.interval
      )}`;

    const json =
      await fetchJson(
        url,
        45_000
      );

    const setup =
      buildRankedSetup(
        json
      );

    if (!setup) {
      return null;
    }

    // Pre-scan and full engine must agree.
    if (
      setup.decision !==
      candidate.direction
    ) {
      return null;
    }

    return setup;
  } catch (error) {
    console.warn(
      `[scanner] Final analysis failed: ${candidate.symbol} ${candidate.interval}`,
      error
    );

    return null;
  }
}


// =========================================================
// DEDUPLICATE EXACT SETUPS
// =========================================================

function deduplicateSetups(
  setups: Omit<
    RankedSetup,
    "rank"
  >[]
) {
  const map =
    new Map<
      string,
      Omit<
        RankedSetup,
        "rank"
      >
    >();

  for (const setup of setups) {
    const key =
      `${setup.symbol}:${setup.interval}:${setup.decision}`;

    const existing =
      map.get(key);

    if (
      !existing ||
      setup.setupStrength >
        existing.setupStrength
    ) {
      map.set(
        key,
        setup
      );
    }
  }

  return Array.from(
    map.values()
  );
}


// =========================================================
// SORT SETUPS
// =========================================================

function sortSetups<
  T extends {
    setupStrength: number;
    decisionScore: number;
    confirmationCount: number;
    tp1R: number;
  }
>(
  setups: T[]
): T[] {
  return setups.sort(
    (a, b) => {
      if (
        b.setupStrength !==
        a.setupStrength
      ) {
        return (
          b.setupStrength -
          a.setupStrength
        );
      }

      if (
        Math.abs(
          b.decisionScore
        ) !==
        Math.abs(
          a.decisionScore
        )
      ) {
        return (
          Math.abs(
            b.decisionScore
          ) -
          Math.abs(
            a.decisionScore
          )
        );
      }

      if (
        b.confirmationCount !==
        a.confirmationCount
      ) {
        return (
          b.confirmationCount -
          a.confirmationCount
        );
      }

      return (
        b.tp1R -
        a.tp1R
      );
    }
  );
}


// =========================================================
// BEST TIMEFRAME PER SYMBOL
// =========================================================

function chooseBestPerSymbol(
  setups: RankedSetup[]
): RankedSetup[] {
  const map =
    new Map<
      string,
      RankedSetup
    >();

  const timeframePriority:
    Record<string, number> = {
      "15m": 3,
      "1h": 2,
      "4h": 1,
    };

  for (const setup of setups) {
    const existing =
      map.get(
        setup.symbol
      );

    if (!existing) {
      map.set(
        setup.symbol,
        setup
      );

      continue;
    }

    // 1. Higher setup strength.
    if (
      setup.setupStrength >
      existing.setupStrength
    ) {
      map.set(
        setup.symbol,
        setup
      );

      continue;
    }

    if (
      setup.setupStrength <
      existing.setupStrength
    ) {
      continue;
    }

    // 2. Higher absolute decision score.
    if (
      Math.abs(
        setup.decisionScore
      ) >
      Math.abs(
        existing.decisionScore
      )
    ) {
      map.set(
        setup.symbol,
        setup
      );

      continue;
    }

    if (
      Math.abs(
        setup.decisionScore
      ) <
      Math.abs(
        existing.decisionScore
      )
    ) {
      continue;
    }

    // 3. More confirmation layers.
    if (
      setup.confirmationCount >
      existing.confirmationCount
    ) {
      map.set(
        setup.symbol,
        setup
      );

      continue;
    }

    if (
      setup.confirmationCount <
      existing.confirmationCount
    ) {
      continue;
    }

    // 4. If still tied, prefer the more immediately
    // actionable timeframe.
    const newPriority =
      timeframePriority[
        setup.interval
      ] ?? 0;

    const existingPriority =
      timeframePriority[
        existing.interval
      ] ?? 0;

    if (
      newPriority >
      existingPriority
    ) {
      map.set(
        setup.symbol,
        setup
      );
    }
  }

  const unique =
    Array.from(
      map.values()
    );

  sortSetups(unique);

  return unique.map(
    (
      setup,
      index
    ): RankedSetup => ({
      ...setup,
      rank: index + 1,
    })
  );
}


// =========================================================
// GET SCANNER
// =========================================================

export async function GET(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    const baseUrl =
      request.nextUrl.origin;

    const requestedLimit =
      finiteNumber(
        request.nextUrl
          .searchParams
          .get("limit")
      ) ??
      DEFAULT_SYMBOL_LIMIT;

    const symbolLimit =
      clamp(
        Math.floor(
          requestedLimit
        ),
        5,
        MAX_SYMBOL_LIMIT
      );


    // =====================================================
    // STAGE 1
    // LOAD SYMBOLS
    // =====================================================

    const symbols =
      await loadSymbols(
        baseUrl,
        symbolLimit
      );


    // =====================================================
    // STAGE 2
    // CREATE SYMBOL + TIMEFRAME JOBS
    // =====================================================

    const scanJobs: Array<{
      symbol: string;
      interval: ScanInterval;
    }> = [];

    for (
      const symbol of symbols
    ) {
      for (
        const interval of
        SCAN_INTERVALS
      ) {
        scanJobs.push({
          symbol,
          interval,
        });
      }
    }


    // =====================================================
    // STAGE 3
    // TECHNICAL PRE-SCAN
    // =====================================================

    const preScanResults =
      await mapWithConcurrency(
        scanJobs,
        PRE_SCAN_CONCURRENCY,
        async (job) =>
          runTechnicalPreScan(
            baseUrl,
            job.symbol,
            job.interval
          )
      );

    const qualifyingPreScan =
      preScanResults
        .filter(
          (
            candidate
          ): candidate is PreScanCandidate =>
            candidate !== null
        )
        .sort(
          (a, b) =>
            b.preRankScore -
            a.preRankScore
        );


    // =====================================================
    // STAGE 4
    // KEEP STRONGEST SYMBOL/TIMEFRAME COMBINATIONS
    //
    // IMPORTANT:
    // We DO NOT collapse to one timeframe per coin here.
    // =====================================================

    const finalCandidates =
      qualifyingPreScan.slice(
        0,
        MAX_FINAL_CANDIDATES
      );


    // =====================================================
    // STAGE 5
    // RUN FULL FINAL-V2 ENGINE
    // =====================================================

    const fullResults =
      await mapWithConcurrency(
        finalCandidates,
        FINAL_SCAN_CONCURRENCY,
        async (
          candidate
        ) =>
          runFinalAnalysis(
            baseUrl,
            candidate
          )
      );

    const validFullResults =
      fullResults.filter(
        (
          setup
        ): setup is Omit<
          RankedSetup,
          "rank"
        > =>
          setup !== null
      );


    // =====================================================
    // STAGE 6
    // REMOVE EXACT DUPLICATES
    // =====================================================

    const uniqueFullResults =
      deduplicateSetups(
        validFullResults
      );


    // =====================================================
    // STAGE 7
    // RANK ALL TIMEFRAME SETUPS
    // =====================================================

    sortSetups(
      uniqueFullResults
    );

    const allTimeframeSetups:
      RankedSetup[] =
      uniqueFullResults
        .slice(
          0,
          MAX_RESULTS
        )
        .map(
          (
            setup,
            index
          ) => ({
            ...setup,
            rank:
              index + 1,
          })
        );


    // =====================================================
    // STAGE 8
    // ONE BEST TIMEFRAME PER COIN
    // =====================================================

    const bestBySymbol =
      chooseBestPerSymbol(
        allTimeframeSetups
      );


    // =====================================================
    // STAGE 9
    // BEST OVERALL TRADE
    // =====================================================

    const bestTrade =
      bestBySymbol[0] ??
      null;


    // =====================================================
    // STAGE 10
    // TOP LONGS
    // =====================================================

    const topLongs =
      bestBySymbol
        .filter(
          (setup) =>
            setup.decision ===
            "LONG"
        )
        .slice(
          0,
          5
        );


    // =====================================================
    // STAGE 11
    // TOP SHORTS
    // =====================================================

    const topShorts =
      bestBySymbol
        .filter(
          (setup) =>
            setup.decision ===
            "SHORT"
        )
        .slice(
          0,
          5
        );


    // =====================================================
    // RESPONSE
    // =====================================================

    const elapsedMs =
      Date.now() -
      startedAt;

    return NextResponse.json({
      success: true,

      version:
        SCANNER_VERSION,

      scannedAt:
        new Date()
          .toISOString(),

      elapsedMs,

      configuration: {
        symbolLimit,

        intervals:
          SCAN_INTERVALS,

        preScanConcurrency:
          PRE_SCAN_CONCURRENCY,

        finalScanConcurrency:
          FINAL_SCAN_CONCURRENCY,

        maxFinalCandidates:
          MAX_FINAL_CANDIDATES,

        maxResults:
          MAX_RESULTS,

        minPreScanScore:
          MIN_PRE_SCAN_SCORE,

        minFinalDecisionScore:
          MIN_FINAL_DECISION_SCORE,
      },

      statistics: {
        symbolsLoaded:
          symbols.length,

        technicalScans:
          scanJobs.length,

        technicalCandidates:
          qualifyingPreScan.length,

        fullAnalysesRequested:
          finalCandidates.length,

        fullAnalysesCompleted:
          validFullResults.length,

        qualifyingFinalSetups:
          allTimeframeSetups.length,

        uniqueTradeOptions:
          bestBySymbol.length,

        longSetups:
          bestBySymbol.filter(
            (setup) =>
              setup.decision ===
              "LONG"
          ).length,

        shortSetups:
          bestBySymbol.filter(
            (setup) =>
              setup.decision ===
              "SHORT"
          ).length,
      },


      // ===================================================
      // PRIMARY DASHBOARD DATA
      // ===================================================

      bestTrade,

      topLongs,

      topShorts,

      // One recommended timeframe per coin.
      setups:
        bestBySymbol,


      // ===================================================
      // DEBUG / DEEP ANALYSIS DATA
      // ===================================================

      // Includes multiple timeframes for the same coin.
      allTimeframeSetups,

      preScanCandidates:
        finalCandidates.map(
          (candidate) => ({
            symbol:
              candidate.symbol,

            interval:
              candidate.interval,

            direction:
              candidate.direction,

            technicalScore:
              candidate
                .technicalScore,

            confidence:
              candidate
                .confidence,

            preRankScore:
              candidate
                .preRankScore,
          })
        ),

      note:
        "Setup Strength is a ranking score, not a calibrated win probability.",
    });
  } catch (error) {
    console.error(
      "[trading/scanner]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        version:
          SCANNER_VERSION,

        error:
          error instanceof Error
            ? error.message
            : "Trading scanner failed.",

        elapsedMs:
          Date.now() -
          startedAt,
      },
      {
        status: 500,
      }
    );
  }
}