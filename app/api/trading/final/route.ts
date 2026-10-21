import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_INTERVALS = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as const;

type AllowedInterval =
  (typeof ALLOWED_INTERVALS)[number];

type TradeSignal =
  | "LONG"
  | "SHORT"
  | "WAIT";

type SignalResponse = {
  success: boolean;

  symbol: string;
  interval: string;

  finalSignal: TradeSignal;

  combinedScore: number;
  confidence: number;

  aligned: boolean;
  conflict: boolean;

  currentPrice: number;

  weights: {
    technical: number;
    derivatives: number;
    whale: number;
    stablecoin: number;
    catalyst: number;
    macro: number;
  };

  scores: {
    technical: number;
    technicalContribution: number;

    derivatives: number;
    derivativesContribution: number;

    whale: number;
    whaleContribution: number;

    stablecoin: number;
    stablecoinContribution: number;

    catalyst: number;
    catalystRaw: number;
    catalystContribution: number;

    macro: number;
    macroRaw: number;
    macroContribution: number;
  };

  whaleIntelligence: {
    supportedForSymbol: boolean;

    source:
      | "ETH_NATIVE"
      | "ERC20"
      | "NONE";

    meaningfulFlow: boolean;

    bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL"
      | "NOT_SUPPORTED";

    whaleScore: number;

    exchangeInflows: number;
    exchangeOutflows: number;

    exchangeInflowUsd: number;
    exchangeOutflowUsd: number;

    netExchangeFlowUsd: number;

    largestTransferUsd: number;

    observedEvents: number;
    directionalEvents: number;

    classificationCoveragePercent: number;
  };

  stablecoinLiquidity: {
    available: boolean;

    meaningfulFlow: boolean;

    bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    score: number;
    rawScore: number;

    totalEvents: number;

    directionalEvents: number;

    classifiedEvents: number;
    unclassifiedEvents: number;

    classificationCoveragePercent: number;

    exchangeInflows: number;
    exchangeOutflows: number;

    exchangeInflowUsd: number;
    exchangeOutflowUsd: number;

    netExchangeLiquidityUsd: number;

    totalObservedUsd: number;
  };

  catalystIntelligence: {
    available: boolean;

    meaningfulCatalyst: boolean;

    bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    score: number;
    rawScore: number;
    confidence: number;

    dataQuality:
      | "GOOD"
      | "PARTIAL"
      | "LOW";

    conflict: boolean;
    strongConflict: boolean;

    newsAvailable: boolean;
    newsRequestSucceeded: boolean;
    newsScore: number;
    newsMatchedArticles: number;

    announcementAvailable: boolean;
    announcementRequestSucceeded: boolean;
    announcementScore: number;
    announcementMatchedEvents: number;

    totalCatalysts: number;
    highImpactCatalysts: number;

    bullishCatalysts: number;
    bearishCatalysts: number;
    neutralCatalysts: number;

    confirmations: string[];
    risks: string[];
  };

  macroIntelligence: {
    available: boolean;

    meaningfulRegime: boolean;

    regime:
      | "RISK_ON"
      | "RISK_OFF"
      | "NEUTRAL";

    rawRegime:
      | "RISK_ON"
      | "RISK_OFF"
      | "NEUTRAL";

    score: number;
    rawScore: number;
    confidence: number;

    dataQuality:
      | "GOOD"
      | "PARTIAL"
      | "LOW";

    availableSources: number;
    totalSources: number;

    btcMomentumExcluded: boolean;

    btcDominancePercent: number;
    btcDominanceRegime: string;

    cryptoMarketChange24hPercent: number;
    btcChange24hPercent: number;

    vix: number;
    dollarChangePercent: number;

    tenYearYieldPercent: number;
    tenYearYieldChangeBps: number;

    riskOnReasons: string[];
    riskOffReasons: string[];
    warnings: string[];

    sourceFailures: Array<{
      source: string;
      error: string;
    }>;
  };

  tradePlan: {
    entryLow: number | null;
    entryHigh: number | null;

    stopLoss: number | null;

    tp1: number | null;
    tp2: number | null;
    tp3: number | null;

    invalidation: number | null;

    riskReward: string | null;
  };

  marketStructure: {
    support: number;
    resistance: number;

    atr: number;
    rsi: number;

    candlePattern: string;
  };

  derivatives: {
    bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    fundingPercent: number;

    openInterestChangePercent: number;

    orderBookImbalancePercent: number;

    takerBuySellRatio: number;

    longShortRatio: number;

    basisPercent: number;
  };

  confirmationReasons: string[];

  bullishReasons: string[];

  bearishReasons: string[];

  risks: string[];

  error?: string;
};

type MultiTimeframeItem = {
  interval: string;

  weight: number;

  success: boolean;

  signal?: TradeSignal;
  score?: number;

  confidence?: number;

  currentPrice?: number;

  rsi?: number;

  support?: number;
  resistance?: number;

  atr?: number;

  candlePattern?: string;

  error?: string;
};

type MultiTimeframeResponse = {
  success: boolean;

  symbol: string;

  consensusSignal: TradeSignal;

  weightedScore: number;

  confidence: number;

  alignment:
    | "STRONG_BULLISH"
    | "BULLISH"
    | "MIXED"
    | "BEARISH"
    | "STRONG_BEARISH";

  trendConflict: boolean;

  shortTerm: {
    trend:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    averageScore: number;
  };

  higherTimeframe: {
    trend:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    averageScore: number;
  };

  distribution: {
    longTimeframes: number;
    shortTimeframes: number;
    waitTimeframes: number;

    bullishWeight: number;
    bearishWeight: number;
    neutralWeight: number;
  };

  timeframes: MultiTimeframeItem[];

  warnings: string[];

  error?: string;
};

function isAllowedInterval(
  value: string
): value is AllowedInterval {
  return (
    ALLOWED_INTERVALS as readonly string[]
  ).includes(value);
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function round(
  value: number,
  decimals = 2
) {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value *
        multiplier
    ) /
    multiplier
  );
}

function uniqueStrings(
  values: string[]
) {
  return [
    ...new Set(
      values.filter(
        Boolean
      )
    ),
  ];
}

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as T & {
      error?: string;
    };

  if (
    !response.ok
  ) {
    throw new Error(
      data.error ||
        `Internal request failed: ${response.status}`
    );
  }

  return data;
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;

    const symbol =
      normalizeTradingSymbol(
        searchParams.get(
          "symbol"
        ),
        "BTCUSDT"
      );

    const rawInterval =
      (
        searchParams.get(
          "interval"
        ) ||
        "15m"
      ).toLowerCase();

    const interval:
      AllowedInterval =
      isAllowedInterval(
        rawInterval
      )
        ? rawInterval
        : "15m";

    const origin =
      request.nextUrl.origin;

    const signalUrl =
      new URL(
        "/api/trading/signal",
        origin
      );

    signalUrl.searchParams.set(
      "symbol",
      symbol
    );

    signalUrl.searchParams.set(
      "interval",
      interval
    );

    const multiTimeframeUrl =
      new URL(
        "/api/trading/multi-timeframe",
        origin
      );

    multiTimeframeUrl.searchParams.set(
      "symbol",
      symbol
    );

    const [
      selectedSignal,
      multiTimeframe,
    ] =
      await Promise.all([
        fetchJson<SignalResponse>(
          signalUrl.toString()
        ),

        fetchJson<MultiTimeframeResponse>(
          multiTimeframeUrl.toString()
        ),
      ]);

    if (
      !selectedSignal.success
    ) {
      throw new Error(
        selectedSignal.error ||
          "Selected timeframe signal failed."
      );
    }

    if (
      !multiTimeframe.success
    ) {
      throw new Error(
        multiTimeframe.error ||
          "Multi-timeframe analysis failed."
      );
    }

    /*
     * Prevent hidden symbol fallback.
     */

    if (
      selectedSignal.symbol !==
      symbol
    ) {
      throw new Error(
        `Signal symbol mismatch. Requested ${symbol}, received ${selectedSignal.symbol}.`
      );
    }

    if (
      multiTimeframe.symbol !==
      symbol
    ) {
      throw new Error(
        `Multi-timeframe symbol mismatch. Requested ${symbol}, received ${multiTimeframe.symbol}.`
      );
    }

    /*
     * Defensive intelligence fallbacks.
     */

    const stablecoinLiquidity =
      selectedSignal.stablecoinLiquidity ?? {
        available: false,
        meaningfulFlow: false,
        bias: "NEUTRAL" as const,
        score: 0,
        rawScore: 0,
        totalEvents: 0,
        directionalEvents: 0,
        classifiedEvents: 0,
        unclassifiedEvents: 0,
        classificationCoveragePercent: 0,
        exchangeInflows: 0,
        exchangeOutflows: 0,
        exchangeInflowUsd: 0,
        exchangeOutflowUsd: 0,
        netExchangeLiquidityUsd: 0,
        totalObservedUsd: 0,
      };

    const catalystIntelligence =
      selectedSignal.catalystIntelligence ?? {
        available: false,
        meaningfulCatalyst: false,
        bias: "NEUTRAL" as const,
        score: 0,
        rawScore: 0,
        confidence: 0,
        dataQuality: "LOW" as const,
        conflict: false,
        strongConflict: false,
        newsAvailable: false,
        newsRequestSucceeded: false,
        newsScore: 0,
        newsMatchedArticles: 0,
        announcementAvailable: false,
        announcementRequestSucceeded: false,
        announcementScore: 0,
        announcementMatchedEvents: 0,
        totalCatalysts: 0,
        highImpactCatalysts: 0,
        bullishCatalysts: 0,
        bearishCatalysts: 0,
        neutralCatalysts: 0,
        confirmations: [],
        risks: [],
      };

    const macroIntelligence =
      selectedSignal.macroIntelligence ?? {
        available: false,
        meaningfulRegime: false,
        regime: "NEUTRAL" as const,
        rawRegime: "NEUTRAL" as const,
        score: 0,
        rawScore: 0,
        confidence: 0,
        dataQuality: "LOW" as const,
        availableSources: 0,
        totalSources: 0,
        btcMomentumExcluded: false,
        btcDominancePercent: 0,
        btcDominanceRegime: "UNKNOWN",
        cryptoMarketChange24hPercent: 0,
        btcChange24hPercent: 0,
        vix: 0,
        dollarChangePercent: 0,
        tenYearYieldPercent: 0,
        tenYearYieldChangeBps: 0,
        riskOnReasons: [],
        riskOffReasons: [],
        warnings: [],
        sourceFailures: [],
      };

    /*
     * =========================================================
     * FINAL DECISION ENGINE V2
     * =========================================================
     *
     * Selected signal: 80%
     * Multi-timeframe: 20%
     *
     * Stablecoin, catalyst and macro are already represented
     * inside selectedSignal.combinedScore.
     *
     * Do not double-count them here.
     */

    const selectedSignalWeight =
      0.8;

    const multiTimeframeWeight =
      0.2;

    const selectedContribution =
      selectedSignal.combinedScore *
      selectedSignalWeight;

    const multiContribution =
      multiTimeframe.weightedScore *
      multiTimeframeWeight;

    let decisionScore =
      selectedContribution +
      multiContribution;

    const confirmations:
      string[] = [
        ...selectedSignal
          .confirmationReasons,
      ];

    const warnings:
      string[] = [];

    let strongConflict =
      false;

    /*
     * Selected signal + MTF consensus agreement.
     */

    if (
      selectedSignal.finalSignal ===
        "LONG" &&
      multiTimeframe.consensusSignal ===
        "LONG"
    ) {
      decisionScore += 5;

      confirmations.push(
        `${interval} signal and multi-timeframe consensus are both LONG.`
      );
    }

    if (
      selectedSignal.finalSignal ===
        "SHORT" &&
      multiTimeframe.consensusSignal ===
        "SHORT"
    ) {
      decisionScore -= 5;

      confirmations.push(
        `${interval} signal and multi-timeframe consensus are both SHORT.`
      );
    }

    /*
     * Strong MTF alignment.
     */

    if (
      multiTimeframe.alignment ===
      "STRONG_BULLISH"
    ) {
      decisionScore += 4;

      confirmations.push(
        "Weighted multi-timeframe structure is strongly bullish."
      );
    }

    if (
      multiTimeframe.alignment ===
      "STRONG_BEARISH"
    ) {
      decisionScore -= 4;

      confirmations.push(
        "Weighted multi-timeframe structure is strongly bearish."
      );
    }

    const higherTrend =
      multiTimeframe
        .higherTimeframe
        .trend;

    const higherScore =
      multiTimeframe
        .higherTimeframe
        .averageScore;

    /*
     * Strong higher-timeframe conflict.
     */

    if (
      selectedSignal.finalSignal ===
        "LONG" &&
      higherTrend ===
        "BEARISH" &&
      higherScore <= -30
    ) {
      strongConflict =
        true;

      warnings.push(
        `${interval} is LONG but 1h/4h/1d structure is strongly bearish.`
      );
    }

    if (
      selectedSignal.finalSignal ===
        "SHORT" &&
      higherTrend ===
        "BULLISH" &&
      higherScore >= 30
    ) {
      strongConflict =
        true;

      warnings.push(
        `${interval} is SHORT but 1h/4h/1d structure is strongly bullish.`
      );
    }

    if (
      selectedSignal.conflict
    ) {
      warnings.push(
        "Technical and derivatives intelligence contains a significant directional conflict."
      );
    }

    if (
      multiTimeframe.trendConflict
    ) {
      warnings.push(
        ...(
          multiTimeframe.warnings ||
          []
        )
      );
    }

    decisionScore =
      clamp(
        decisionScore,
        -100,
        100
      );

    /*
     * =========================================================
     * INDEPENDENT CONFIRMATION GATE
     * =========================================================
     *
     * A score by itself is no longer sufficient.
     */

    const longSelectedConfirmation =
      selectedSignal.finalSignal ===
      "LONG";

    const shortSelectedConfirmation =
      selectedSignal.finalSignal ===
      "SHORT";

    const longMtfConfirmation =
      multiTimeframe.consensusSignal ===
        "LONG" ||
      multiTimeframe.alignment ===
        "BULLISH" ||
      multiTimeframe.alignment ===
        "STRONG_BULLISH";

    const shortMtfConfirmation =
      multiTimeframe.consensusSignal ===
        "SHORT" ||
      multiTimeframe.alignment ===
        "BEARISH" ||
      multiTimeframe.alignment ===
        "STRONG_BEARISH";

    const longHigherTimeframeConfirmation =
      higherTrend ===
        "BULLISH" &&
      higherScore > 0;

    const shortHigherTimeframeConfirmation =
      higherTrend ===
        "BEARISH" &&
      higherScore < 0;

    const longConfirmationCount =
      [
        longSelectedConfirmation,
        longMtfConfirmation,
        longHigherTimeframeConfirmation,
      ].filter(Boolean).length;

    const shortConfirmationCount =
      [
        shortSelectedConfirmation,
        shortMtfConfirmation,
        shortHigherTimeframeConfirmation,
      ].filter(Boolean).length;

    /*
     * =========================================================
     * LONG / SHORT / WAIT
     * =========================================================
     *
     * Requirements:
     *
     * 1. Score crosses ±30.
     * 2. Selected timeframe agrees.
     * 3. At least 2/3 directional confirmation layers agree.
     * 4. No strong higher-timeframe conflict.
     */

    let finalDecision:
      TradeSignal =
      "WAIT";

    if (
      decisionScore >= 30 &&
      !strongConflict &&
      longSelectedConfirmation &&
      longConfirmationCount >= 2
    ) {
      finalDecision =
        "LONG";
    } else if (
      decisionScore <= -30 &&
      !strongConflict &&
      shortSelectedConfirmation &&
      shortConfirmationCount >= 2
    ) {
      finalDecision =
        "SHORT";
    }

    /*
     * Explain rejected high-score setups.
     */

    if (
      finalDecision === "WAIT" &&
      decisionScore >= 30
    ) {
      warnings.push(
        `Bullish score ${round(
          decisionScore,
          1
        )} rejected because directional confirmation was insufficient (${longConfirmationCount}/3).`
      );
    }

    if (
      finalDecision === "WAIT" &&
      decisionScore <= -30
    ) {
      warnings.push(
        `Bearish score ${round(
          decisionScore,
          1
        )} rejected because directional confirmation was insufficient (${shortConfirmationCount}/3).`
      );
    }

    /*
     * Hard higher-timeframe safety layer.
     */

    if (
      finalDecision ===
        "LONG" &&
      higherScore <= -35
    ) {
      finalDecision =
        "WAIT";

      strongConflict =
        true;

      warnings.push(
        "LONG blocked because higher-timeframe bearish pressure is too strong."
      );
    }

    if (
      finalDecision ===
        "SHORT" &&
      higherScore >= 35
    ) {
      finalDecision =
        "WAIT";

      strongConflict =
        true;

      warnings.push(
        "SHORT blocked because higher-timeframe bullish pressure is too strong."
      );
    }

    /*
     * =========================================================
     * HEURISTIC CONFIDENCE
     * =========================================================
     *
     * This is NOT calibrated win probability.
     */

    let confidence =
      48 +
      Math.abs(
        decisionScore
      ) *
        0.4;

    /*
     * Selected timeframe + MTF consensus.
     */

    if (
      finalDecision ===
        "LONG" &&
      selectedSignal.finalSignal ===
        "LONG" &&
      multiTimeframe.consensusSignal ===
        "LONG"
    ) {
      confidence += 6;
    }

    if (
      finalDecision ===
        "SHORT" &&
      selectedSignal.finalSignal ===
        "SHORT" &&
      multiTimeframe.consensusSignal ===
        "SHORT"
    ) {
      confidence += 6;
    }

    /*
     * Higher timeframe confirmation.
     */

    if (
      finalDecision ===
        "LONG" &&
      longHigherTimeframeConfirmation
    ) {
      confidence += 4;
    }

    if (
      finalDecision ===
        "SHORT" &&
      shortHigherTimeframeConfirmation
    ) {
      confidence += 4;
    }

    /*
     * Full 3/3 confirmation bonus.
     */

    if (
      finalDecision ===
        "LONG" &&
      longConfirmationCount === 3
    ) {
      confidence += 2;
    }

    if (
      finalDecision ===
        "SHORT" &&
      shortConfirmationCount === 3
    ) {
      confidence += 2;
    }

    /*
     * Stablecoin alignment:
     * tiny confidence adjustment only.
     */

    if (
      stablecoinLiquidity
        .meaningfulFlow
    ) {
      if (
        finalDecision ===
          "LONG" &&
        stablecoinLiquidity
          .bias ===
          "BULLISH"
      ) {
        confidence += 1;
      }

      if (
        finalDecision ===
          "SHORT" &&
        stablecoinLiquidity
          .bias ===
          "BEARISH"
      ) {
        confidence += 1;
      }
    }

    /*
     * Conflict penalties.
     */

    if (
      multiTimeframe.trendConflict
    ) {
      confidence -= 8;
    }

    if (
      selectedSignal.conflict
    ) {
      confidence -= 10;
    }

    if (
      strongConflict
    ) {
      confidence -= 15;
    }

    /*
     * WAIT should never look like a
     * high-confidence trade recommendation.
     */

    if (
      finalDecision ===
      "WAIT"
    ) {
      confidence =
        Math.min(
          confidence,
          65
        );
    }

    confidence =
      clamp(
        confidence,
        40,
        92
      );

    /*
     * Human-readable MTF confirmations.
     */

    if (
      higherTrend ===
      "BULLISH"
    ) {
      confirmations.push(
        `Higher-timeframe trend is bullish with average score ${round(
          higherScore,
          1
        )}.`
      );
    }

    if (
      higherTrend ===
      "BEARISH"
    ) {
      confirmations.push(
        `Higher-timeframe trend is bearish with average score ${round(
          higherScore,
          1
        )}.`
      );
    }

    if (
      multiTimeframe
        .shortTerm
        .trend ===
      "BULLISH"
    ) {
      confirmations.push(
        "1m, 5m and 15m momentum currently leans bullish."
      );
    }

    if (
      multiTimeframe
        .shortTerm
        .trend ===
      "BEARISH"
    ) {
      confirmations.push(
        "1m, 5m and 15m momentum currently leans bearish."
      );
    }

    /*
     * Dashboard timeframe format.
     */

    const timeframeSummary =
      multiTimeframe.timeframes.map(
        (
          timeframe
        ) => ({
          interval:
            timeframe.interval,

          signal:
            timeframe.signal ||
            "WAIT",

          score:
            timeframe.score ??
            0,

          confidence:
            timeframe.confidence ??
            0,

          rsi:
            timeframe.rsi ??
            null,

          support:
            timeframe.support ??
            null,

          resistance:
            timeframe.resistance ??
            null,

          pattern:
            timeframe.candlePattern ||
            "NONE",
        })
      );

    /*
     * Hide trade levels when WAIT.
     */

    const tradePlan =
      finalDecision ===
      "WAIT"
        ? {
            entryLow:
              null,

            entryHigh:
              null,

            stopLoss:
              null,

            tp1:
              null,

            tp2:
              null,

            tp3:
              null,

            invalidation:
              null,

            riskReward:
              null,
          }
        : selectedSignal
            .tradePlan;

    return NextResponse.json({
      success:
        true,

      version:
        "final-v2-confirmation-gated",

      symbol,

      interval,

      finalDecision,

      decisionScore:
        round(
          decisionScore,
          1
        ),

      confidence:
        round(
          confidence,
          1
        ),

      confidenceType:
        "heuristic",

      strongConflict,

      currentPrice:
        selectedSignal
          .currentPrice,

      /*
       * NEW:
       * Makes the V2 gate visible to the dashboard
       * and future performance analysis.
       */

      confirmationGate: {
        required:
          2,

        longConfirmationCount,

        shortConfirmationCount,

        selectedTimeframe: {
          long:
            longSelectedConfirmation,

          short:
            shortSelectedConfirmation,
        },

        multiTimeframe: {
          long:
            longMtfConfirmation,

          short:
            shortMtfConfirmation,
        },

        higherTimeframe: {
          long:
            longHigherTimeframeConfirmation,

          short:
            shortHigherTimeframeConfirmation,
        },

        passed:
          finalDecision !==
          "WAIT",
      },

      decisionWeights: {
        selectedSignal:
          80,

        multiTimeframe:
          20,
      },

      decisionContributions: {
        selectedSignalScore:
          selectedSignal
            .combinedScore,

        selectedSignalContribution:
          round(
            selectedContribution,
            1
          ),

        multiTimeframeScore:
          multiTimeframe
            .weightedScore,

        multiTimeframeContribution:
          round(
            multiContribution,
            1
          ),
      },

      /*
       * Internal selected-signal weights.
       */

      intelligenceWeights: {
        technical:
          selectedSignal
            .weights
            .technical,

        derivatives:
          selectedSignal
            .weights
            .derivatives,

        whale:
          selectedSignal
            .weights
            .whale,

        stablecoin:
          selectedSignal
            .weights
            .stablecoin,

        catalyst:
          (
            selectedSignal
              .weights
              .catalyst ??
            0
          ),

        macro:
          (
            selectedSignal
              .weights
              .macro ??
            0
          ),
      },

      intelligenceScores: {
        technical:
          selectedSignal
            .scores
            .technical,

        technicalContribution:
          selectedSignal
            .scores
            .technicalContribution,

        derivatives:
          selectedSignal
            .scores
            .derivatives,

        derivativesContribution:
          selectedSignal
            .scores
            .derivativesContribution,

        whale:
          selectedSignal
            .scores
            .whale,

        whaleContribution:
          selectedSignal
            .scores
            .whaleContribution,

        stablecoin:
          selectedSignal
            .scores
            .stablecoin,

        stablecoinContribution:
          selectedSignal
            .scores
            .stablecoinContribution,

        catalyst:
          (
            selectedSignal
              .scores
              .catalyst ??
            0
          ),

        catalystRaw:
          (
            selectedSignal
              .scores
              .catalystRaw ??
            0
          ),

        catalystContribution:
          (
            selectedSignal
              .scores
              .catalystContribution ??
            0
          ),

        macro:
          (
            selectedSignal
              .scores
              .macro ??
            0
          ),

        macroRaw:
          (
            selectedSignal
              .scores
              .macroRaw ??
            0
          ),

        macroContribution:
          (
            selectedSignal
              .scores
              .macroContribution ??
            0
          ),
      },

      selectedTimeframe: {
        interval,

        signal:
          selectedSignal
            .finalSignal,

        score:
          selectedSignal
            .combinedScore,

        confidence:
          selectedSignal
            .confidence,

        technicalScore:
          selectedSignal
            .scores
            .technical,

        derivativesScore:
          selectedSignal
            .scores
            .derivatives,

        whaleScore:
          selectedSignal
            .scores
            .whale,

        stablecoinScore:
          selectedSignal
            .scores
            .stablecoin,

        catalystScore:
          (
            selectedSignal
              .scores
              .catalyst ??
            0
          ),

        macroScore:
          (
            selectedSignal
              .scores
              .macro ??
            0
          ),
      },

      multiTimeframe: {
        consensusSignal:
          multiTimeframe
            .consensusSignal,

        weightedScore:
          multiTimeframe
            .weightedScore,

        confidence:
          multiTimeframe
            .confidence,

        alignment:
          multiTimeframe
            .alignment,

        trendConflict:
          multiTimeframe
            .trendConflict,

        shortTermTrend:
          multiTimeframe
            .shortTerm
            .trend,

        shortTermScore:
          multiTimeframe
            .shortTerm
            .averageScore,

        higherTimeframeTrend:
          higherTrend,

        higherTimeframeScore:
          round(
            higherScore,
            1
          ),

        distribution:
          multiTimeframe
            .distribution,

        timeframes:
          timeframeSummary,
      },

      tradePlan,

      marketStructure:
        selectedSignal
          .marketStructure,

      derivatives:
        selectedSignal
          .derivatives,

      whaleIntelligence:
        selectedSignal
          .whaleIntelligence,

      stablecoinLiquidity:
        stablecoinLiquidity,

      catalystIntelligence:
        catalystIntelligence,

      macroIntelligence:
        macroIntelligence,

      confirmations:
        uniqueStrings(
          confirmations
        ),

      bullishReasons:
        uniqueStrings(
          selectedSignal
            .bullishReasons
        ),

      bearishReasons:
        uniqueStrings(
          selectedSignal
            .bearishReasons
        ),

      risks:
        uniqueStrings([
          ...selectedSignal
            .risks,

          ...warnings,
        ]),

      modules: {
        technical:
          true,

        derivatives:
          true,

        orderBook:
          true,

        takerFlow:
          true,

        whaleTracking:
          selectedSignal
            .whaleIntelligence
            .supportedForSymbol,

        stablecoinLiquidity:
          stablecoinLiquidity
            .available,

        usdt:
          stablecoinLiquidity
            .available,

        usdc:
          stablecoinLiquidity
            .available,

        multiTimeframe:
          true,

        timeframesAnalyzed:
          6,

        erc20Whales:
          selectedSignal
            .whaleIntelligence
            .source ===
              "ERC20",

        news:
          catalystIntelligence
            .newsRequestSucceeded,

        announcements:
          catalystIntelligence
            .announcementRequestSucceeded,

        catalyst:
          catalystIntelligence
            .available,

        catalystWeighted:
          (
            selectedSignal
              .weights
              .catalyst ??
            0
          ) > 0,

        macro:
          macroIntelligence
            .available,

        macroWeighted:
          (
            selectedSignal
              .weights
              .macro ??
            0
          ) > 0,

        macroCalendar:
          false,

        machineLearning:
          false,
      },

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Final trading decision error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate final trading decision.",
      },
      {
        status:
          500,
      }
    );
  }
}