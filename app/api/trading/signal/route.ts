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

type DirectionalBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

type TechnicalResponse = {
  success: boolean;

  symbol: string;
  interval: string;

  signal: TradeSignal;

  technicalScore?: number;
  score?: number;

  confidence: number;

  currentPrice: number;

  indicators: {
    ema20: number;
    ema50: number;
    ema200: number;

    rsi: number;

    macd: number;
    macdSignal: number;
    macdHistogram: number;

    atr: number;
    vwap: number;

    support: number;
    resistance: number;
  };

  marketStructure?: {
    support: number;
    resistance: number;

    atr: number;
    rsi: number;

    candlePattern: string;
  };

  candlePattern: string;

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

  bullishReasons: string[];
  bearishReasons: string[];
  risks: string[];

  error?: string;
};

type DerivativesResponse = {
  success: boolean;

  symbol: string;

  bias:
    DirectionalBias;

  derivativesScore: number;

  confidence: number;

  funding: {
    rate: number;
    percent: number;
    nextFundingTime?: number;
  };

  prices?: {
    markPrice: number;
    indexPrice: number;
    basisPercent: number;
  };

  markPrice?: number;
  indexPrice?: number;
  basisPercent?: number;

  openInterest: {
    contracts: number;
    notionalUsd: number;

    changeApprox1hPercent?: number;
    changePercent?: number;
  };

  orderBook: {
    bestBid: number;
    bestAsk: number;

    spread: number;
    spreadBps: number;

    bidLiquidityUsd: number;
    askLiquidityUsd: number;

    imbalancePercent: number;
  };

  takerFlow: {
    buySellRatio: number;
    buyVolume: number;
    sellVolume: number;
  };

  positioning: {
    longShortRatio: number;

    longAccountsPercent?: number;
    shortAccountsPercent?: number;

    longAccountPercent?: number;
    shortAccountPercent?: number;
  };

  bullishReasons?: string[];
  bearishReasons?: string[];

  reasons?: string[];

  risks: string[];

  error?: string;
};

type WhaleResponse = {
  success: boolean;

  summary: {
    totalEvents: number;

    ethEvents: number;
    btcEvents: number;

    exchangeInflows: number;
    exchangeOutflows: number;

    exchangeToExchange: number;

    exchangeInflowUsd: number;
    exchangeOutflowUsd: number;

    netExchangeFlowUsd: number;

    totalObservedUsd: number;
    largestTransferUsd: number;

    whaleScore: number;

    directionalBias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";
  };

  error?: string;
};

type StablecoinResponse = {
  success: boolean;

  thresholdUsd: number;

  summary: {
    totalEvents: number;

    usdtEvents: number;
    usdcEvents: number;

    exchangeInflows: number;
    exchangeOutflows: number;

    exchangeToExchange: number;
    unclassified: number;

    exchangeInflowUsd: number;
    exchangeOutflowUsd: number;

    netExchangeLiquidityUsd: number;

    totalObservedUsd: number;

    stablecoinScore: number;

    liquidityBias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";
  };

  error?: string;
};

type Erc20WhaleResponse = {
  success: boolean;
  supported: boolean;
  symbol: string;
  bias?: DirectionalBias | "NOT_SUPPORTED";
  whaleScore?: number;
  meaningfulFlow?: boolean;
  summary?: {
    totalEvents: number;
    directionalEvents: number;
    classifiedEvents: number;
    unclassifiedEvents: number;
    classificationCoveragePercent: number;
    exchangeInflows: number;
    exchangeOutflows: number;
    exchangeToExchange: number;
    walletToWallet: number;
    exchangeInflowUsd: number;
    exchangeOutflowUsd: number;
    netExchangeFlowUsd: number;
    totalObservedUsd: number;
    largestTransferUsd: number;
  };
  error?: string;
};

type CatalystResponse = {
  success: boolean;
  symbol: string;
  bias: DirectionalBias;
  catalystScore: number;
  confidence: number;
  confidenceType?: string;
  meaningfulCatalyst: boolean;
  conflict: boolean;
  strongConflict: boolean;
  dataQuality:
    | "GOOD"
    | "PARTIAL"
    | "LOW";
  scores: {
    news: number;
    newsContribution: number;
    announcements: number;
    announcementContribution: number;
    coinSpecific?: number;
    marketWide?: number;
    marketWideEffectiveContribution?: number;
  };
  weights?: { news?: number; announcements?: number; coinSpecificLayer?: number; marketWideLayer?: number; };
  marketWide?: { available: boolean; requestSucceeded: boolean; meaningful: boolean; bias: DirectionalBias; score: number; effectiveLayerWeight: number; matchedArticles: number; bullishArticles: number; bearishArticles: number; neutralArticles: number; highImpactArticles: number; availableSources: number; totalSources: number; sourceFailures?: Array<{ source: string; error: string }>; };
  layers?: { coinSpecific?: { available: boolean; meaningful: boolean; score: number; bias: DirectionalBias; effectiveWeight: number; newsWeight: number; announcementWeight: number; }; marketWide?: { available: boolean; meaningful: boolean; score: number; bias: DirectionalBias; effectiveWeight: number; }; };
  news: {
    available: boolean;
    requestSucceeded: boolean;
    bias: DirectionalBias;
    score: number;
    meaningful: boolean;
    matchedArticles: number;
    highImpactArticles: number;
  };
  announcements: {
    available: boolean;
    requestSucceeded: boolean;
    bias: DirectionalBias;
    score: number;
    meaningful: boolean;
    matchedEvents: number;
    highImpactEvents: number;
  };
  summary: {
    totalCatalysts: number;
    coinSpecificCatalysts?: number;
    marketWideCatalysts?: number;
    bullishCatalysts: number;
    bearishCatalysts: number;
    neutralCatalysts: number;
    highImpactCatalysts: number;
    mediumImpactCatalysts: number;
  };
  confirmations?: string[];
  risks?: string[];
  modules?: {
    cryptoNews?: boolean;
    binanceAnnouncements?: boolean;
    catalystFusion?: boolean;
    tradingWeightEnabled?: boolean;
  };
  error?: string;
};

type MacroResponse = {
  success: boolean;
  routeVersion?: string;

  regime:
    | "RISK_ON"
    | "RISK_OFF"
    | "NEUTRAL";

  regimeScore: number;
  confidence: number;
  confidenceType?: string;

  dataQuality:
    | "GOOD"
    | "PARTIAL"
    | "LOW";

  availableSources: number;
  totalSources: number;
  traditionalMacroSourcesAvailable?: number;

  weights: {
    cryptoMarket: number;
    btcMomentum: number;
    vix: number;
    dollar: number;
    tenYearYield: number;
  };

  scores: {
    cryptoMarket: number;
    btcMomentum: number;
    vix: number;
    dollar: number;
    tenYearYield: number;
  };

  cryptoMarket: {
    available: boolean;
    provider?: string;
    totalMarketCapUsd?: number;
    totalVolume24hUsd?: number;
    marketCapChange24hPercent?: number;
    btcDominancePercent?: number;
    btcDominanceRegime?: string;
    activeCryptocurrencies?: number;
    updatedAt?: string | null;
  };

  btc: {
    available: boolean;
    price?: number;
    change24hPercent?: number;
    quoteVolume24hUsd?: number;
  };

  vix: {
    available: boolean;
    value?: number;
    previousValue?: number;
    changePercent?: number;
    observationDate?: string;
  };

  dollarIndex: {
    available: boolean;
    series?: string;
    value?: number;
    previousValue?: number;
    changePercent?: number;
    observationDate?: string;
  };

  tenYearYield: {
    available: boolean;
    valuePercent?: number;
    previousValuePercent?: number;
    changeBps?: number;
    observationDate?: string;
  };

  riskOnReasons?: string[];
  riskOffReasons?: string[];
  warnings?: string[];

  sourceFailures?: Array<{
    source: string;
    error: string;
  }>;

  error?: string;
};

const ERC20_WHALE_SYMBOLS = new Set([
  "LINKUSDT",
  "UNIUSDT",
  "AAVEUSDT",
  "SHIBUSDT",
  "PEPEUSDT",
]);

let stablecoinCache:
  | {
      expiresAt: number;

      data:
        StablecoinResponse;
    }
  | null = null;

const catalystCache =
  new Map<
    string,
    {
      expiresAt: number;
      data: CatalystResponse;
    }
  >();

let macroCache:
  | {
      expiresAt: number;
      data: MacroResponse;
    }
  | null = null;

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function round(
  value: number,
  decimals = 2
) {
  if (
    !Number.isFinite(
      value
    )
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

function isAllowedInterval(
  value: string
): value is AllowedInterval {
  return (
    ALLOWED_INTERVALS as readonly string[]
  ).includes(value);
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

async function fetchStablecoinData(
  origin: string
) {
  const now =
    Date.now();

  /*
   * Stablecoin whale scanning is
   * much heavier than price
   * analysis.
   *
   * Reuse it for 60 seconds.
   */

  if (
    stablecoinCache &&
    stablecoinCache.expiresAt >
      now
  ) {
    return stablecoinCache.data;
  }

  const url =
    new URL(
      "/api/trading/stablecoin-whales",
      origin
    );

  /*
   * $100k threshold gives us
   * more information while the
   * scoring logic still favors
   * larger transfers.
   */

  url.searchParams.set(
    "minUsd",
    "100000"
  );

  const data =
    await fetchJson<StablecoinResponse>(
      url.toString()
    );

  if (
    data.success
  ) {
    stablecoinCache = {
      expiresAt:
        now +
        60_000,

      data,
    };
  }

  return data;
}

async function fetchCatalystData(
  origin: string,
  symbol: string
) {
  const now =
    Date.now();

  const cached =
    catalystCache.get(
      symbol
    );

  /*
   * News and announcement feeds
   * do not need to refresh on
   * every 15-second dashboard
   * request. Reuse coin-specific
   * catalyst data for 60 seconds.
   */

  if (
    cached &&
    cached.expiresAt >
      now
  ) {
    return cached.data;
  }

  const url =
    new URL(
      "/api/trading/catalyst",
      origin
    );

  url.searchParams.set(
    "symbol",
    symbol
  );

  const data =
    await fetchJson<CatalystResponse>(
      url.toString()
    );

  if (
    data.success &&
    data.symbol ===
      symbol
  ) {
    catalystCache.set(
      symbol,
      {
        expiresAt:
          now +
          60_000,
        data,
      }
    );
  }

  return data;
}

async function fetchMacroData(
  origin: string
) {
  const now =
    Date.now();

  /*
   * /api/trading/macro already has
   * its own five-minute source cache.
   * Reuse the normalized response here
   * for 60 seconds to avoid unnecessary
   * internal HTTP calls from the dashboard.
   */

  if (
    macroCache &&
    macroCache.expiresAt >
      now
  ) {
    return macroCache.data;
  }

  const url =
    new URL(
      "/api/trading/macro",
      origin
    );

  const data =
    await fetchJson<MacroResponse>(
      url.toString()
    );

  if (
    data.success
  ) {
    macroCache = {
      expiresAt:
        now +
        60_000,

      data,
    };
  }

  return data;
}

function buildCatalystIntelligence(
  symbol: string,
  catalyst:
    CatalystResponse | null
) {
  if (
    !catalyst ||
    !catalyst.success ||
    catalyst.symbol !==
      symbol
  ) {
    return {
      available:
        false,

      meaningfulCatalyst:
        false,

      bias:
        "NEUTRAL" as const,

      score:
        0,

      rawScore:
        0,

      confidence:
        0,

      dataQuality:
        "LOW" as const,

      conflict:
        false,

      strongConflict:
        false,

      newsAvailable:
        false,

      newsRequestSucceeded:
        false,

      newsScore:
        0,

      newsMatchedArticles:
        0,

      announcementAvailable:
        false,

      announcementRequestSucceeded:
        false,

      announcementScore:
        0,

      announcementMatchedEvents:
        0,

      coinSpecificScore: 0,
      coinSpecificBias: "NEUTRAL" as const,
      coinSpecificAvailable: false,
      coinSpecificMeaningful: false,
      coinSpecificEffectiveWeight: 0,
      marketWideAvailable: false,
      marketWideRequestSucceeded: false,
      marketWideMeaningful: false,
      marketWideBias: "NEUTRAL" as const,
      marketWideScore: 0,
      marketWideEffectiveContribution: 0,
      marketWideEffectiveWeight: 0,
      marketWideMatchedArticles: 0,
      marketWideBullishArticles: 0,
      marketWideBearishArticles: 0,
      marketWideNeutralArticles: 0,
      marketWideHighImpactArticles: 0,
      marketWideAvailableSources: 0,
      marketWideTotalSources: 0,
      marketWideSourceFailures: [] as Array<{ source: string; error: string }>,

      totalCatalysts:
        0,
      coinSpecificCatalysts: 0,
      marketWideCatalysts: 0,

      highImpactCatalysts:
        0,

      bullishCatalysts:
        0,

      bearishCatalysts:
        0,

      neutralCatalysts:
        0,

      confirmations:
        [] as string[],

      risks:
        [] as string[],
    };
  }

  const rawScore =
    clamp(
      safeNumber(
        catalyst.catalystScore
      ),
      -100,
      100
    );

  /*
   * Catalyst intelligence is an
   * auxiliary layer. Cap the score
   * before applying its small
   * portfolio weight so one headline
   * cannot overpower market data.
   */

  const cappedScore =
    clamp(
      rawScore,
      -60,
      60
    );

  const totalCatalysts =
    safeNumber(
      catalyst.summary
        ?.totalCatalysts
    );

  const dataQuality =
    catalyst.dataQuality ===
      "GOOD" ||
    catalyst.dataQuality ===
      "PARTIAL"
      ? catalyst.dataQuality
      : "LOW";

  const meaningfulCatalyst =
    Boolean(
      catalyst.meaningfulCatalyst
    ) &&
    totalCatalysts >
      0 &&
    dataQuality !==
      "LOW";

  return {
    available:
      true,

    meaningfulCatalyst,

    bias:
      catalyst.bias,

    score:
      round(
        cappedScore,
        1
      ),

    rawScore:
      round(
        rawScore,
        1
      ),

    confidence:
      round(
        clamp(
          safeNumber(
            catalyst.confidence
          ),
          0,
          100
        ),
        1
      ),

    dataQuality,

    conflict:
      Boolean(
        catalyst.conflict
      ),

    strongConflict:
      Boolean(
        catalyst.strongConflict
      ),

    newsAvailable:
      Boolean(
        catalyst.news
          ?.available
      ),

    newsRequestSucceeded:
      Boolean(
        catalyst.news
          ?.requestSucceeded
      ),

    newsScore:
      round(
        safeNumber(
          catalyst.scores
            ?.news
        ),
        1
      ),

    newsMatchedArticles:
      safeNumber(
        catalyst.news
          ?.matchedArticles
      ),

    announcementAvailable:
      Boolean(
        catalyst.announcements
          ?.available
      ),

    announcementRequestSucceeded:
      Boolean(
        catalyst.announcements
          ?.requestSucceeded
      ),

    announcementScore:
      round(
        safeNumber(
          catalyst.scores
            ?.announcements
        ),
        1
      ),

    announcementMatchedEvents:
      safeNumber(
        catalyst.announcements
          ?.matchedEvents
      ),

    coinSpecificScore: round(safeNumber(catalyst.layers?.coinSpecific?.score, catalyst.scores?.coinSpecific ?? 0), 1),
    coinSpecificBias: catalyst.layers?.coinSpecific?.bias ?? "NEUTRAL",
    coinSpecificAvailable: Boolean(catalyst.layers?.coinSpecific?.available),
    coinSpecificMeaningful: Boolean(catalyst.layers?.coinSpecific?.meaningful),
    coinSpecificEffectiveWeight: safeNumber(catalyst.layers?.coinSpecific?.effectiveWeight, catalyst.weights?.coinSpecificLayer ?? 0),
    marketWideAvailable: Boolean(catalyst.marketWide?.available),
    marketWideRequestSucceeded: Boolean(catalyst.marketWide?.requestSucceeded),
    marketWideMeaningful: Boolean(catalyst.marketWide?.meaningful),
    marketWideBias: catalyst.marketWide?.bias ?? "NEUTRAL",
    marketWideScore: round(safeNumber(catalyst.marketWide?.score, catalyst.scores?.marketWide ?? 0), 1),
    marketWideEffectiveContribution: round(safeNumber(catalyst.scores?.marketWideEffectiveContribution), 2),
    marketWideEffectiveWeight: safeNumber(catalyst.marketWide?.effectiveLayerWeight, catalyst.layers?.marketWide?.effectiveWeight ?? catalyst.weights?.marketWideLayer ?? 0),
    marketWideMatchedArticles: safeNumber(catalyst.marketWide?.matchedArticles),
    marketWideBullishArticles: safeNumber(catalyst.marketWide?.bullishArticles),
    marketWideBearishArticles: safeNumber(catalyst.marketWide?.bearishArticles),
    marketWideNeutralArticles: safeNumber(catalyst.marketWide?.neutralArticles),
    marketWideHighImpactArticles: safeNumber(catalyst.marketWide?.highImpactArticles),
    marketWideAvailableSources: safeNumber(catalyst.marketWide?.availableSources),
    marketWideTotalSources: safeNumber(catalyst.marketWide?.totalSources),
    marketWideSourceFailures: catalyst.marketWide?.sourceFailures ?? [],

    totalCatalysts,
    coinSpecificCatalysts: safeNumber(catalyst.summary?.coinSpecificCatalysts),
    marketWideCatalysts: safeNumber(catalyst.summary?.marketWideCatalysts),

    highImpactCatalysts:
      safeNumber(
        catalyst.summary
          ?.highImpactCatalysts
      ),

    bullishCatalysts:
      safeNumber(
        catalyst.summary
          ?.bullishCatalysts
      ),

    bearishCatalysts:
      safeNumber(
        catalyst.summary
          ?.bearishCatalysts
      ),

    neutralCatalysts:
      safeNumber(
        catalyst.summary
          ?.neutralCatalysts
      ),

    confirmations:
      catalyst.confirmations ||
      [],

    risks:
      catalyst.risks ||
      [],
  };
}

function observationAgeDays(
  observationDate:
    string | undefined
) {
  if (
    !observationDate
  ) {
    return null;
  }

  const timestamp =
    Date.parse(
      `${observationDate}T00:00:00Z`
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    (
      Date.now() -
      timestamp
    ) /
      86_400_000
  );
}

function macroRegimeFromScore(
  score: number
) {
  if (
    score >=
    20
  ) {
    return "RISK_ON" as const;
  }

  if (
    score <=
    -20
  ) {
    return "RISK_OFF" as const;
  }

  return "NEUTRAL" as const;
}

function buildMacroIntelligence(
  symbol: string,
  macro:
    MacroResponse | null
) {
  if (
    !macro ||
    !macro.success
  ) {
    return {
      available:
        false,

      meaningfulRegime:
        false,

      regime:
        "NEUTRAL" as const,

      rawRegime:
        "NEUTRAL" as const,

      score:
        0,

      rawScore:
        0,

      confidence:
        0,

      dataQuality:
        "LOW" as const,

      availableSources:
        0,

      totalSources:
        0,

      btcMomentumExcluded:
        symbol ===
        "BTCUSDT",

      btcDominancePercent:
        0,

      btcDominanceRegime:
        "UNKNOWN",

      cryptoMarketChange24hPercent:
        0,

      btcChange24hPercent:
        0,

      vix:
        0,

      dollarChangePercent:
        0,

      tenYearYieldPercent:
        0,

      tenYearYieldChangeBps:
        0,

      riskOnReasons:
        [] as string[],

      riskOffReasons:
        [] as string[],

      warnings:
        [] as string[],

      sourceFailures:
        [] as Array<{
          source: string;
          error: string;
        }>,
    };
  }

  const btcMomentumExcluded =
    symbol ===
    "BTCUSDT";

  /*
   * FRED inputs are daily observations.
   * Five calendar days allows normal
   * weekends/holidays while preventing
   * genuinely stale macro observations
   * from receiving full trading weight.
   */

  const maxMacroAgeDays =
    5;

  const vixAge =
    observationAgeDays(
      macro.vix
        ?.observationDate
    );

  const dollarAge =
    observationAgeDays(
      macro.dollarIndex
        ?.observationDate
    );

  const yieldAge =
    observationAgeDays(
      macro.tenYearYield
        ?.observationDate
    );

  const vixFresh =
    Boolean(
      macro.vix
        ?.available
    ) &&
    vixAge !==
      null &&
    vixAge <=
      maxMacroAgeDays;

  const dollarFresh =
    Boolean(
      macro.dollarIndex
        ?.available
    ) &&
    dollarAge !==
      null &&
    dollarAge <=
      maxMacroAgeDays;

  const yieldFresh =
    Boolean(
      macro.tenYearYield
        ?.available
    ) &&
    yieldAge !==
      null &&
    yieldAge <=
      maxMacroAgeDays;

  const warnings = [
    ...(
      macro.warnings ||
      []
    ),
  ];

  if (
    btcMomentumExcluded
  ) {
    warnings.push(
      "BTC 24h momentum is excluded from the macro score for BTCUSDT to avoid double-counting BTC price action already represented in technical analysis."
    );
  }

  if (
    macro.vix
      ?.available &&
    !vixFresh
  ) {
    warnings.push(
      `VIX macro observation is stale${
        vixAge === null
          ? ""
          : ` by approximately ${Math.round(vixAge)} day(s)`
      } and is excluded from trading weight.`
    );
  }

  if (
    macro.dollarIndex
      ?.available &&
    !dollarFresh
  ) {
    warnings.push(
      `U.S. dollar macro observation is stale${
        dollarAge === null
          ? ""
          : ` by approximately ${Math.round(dollarAge)} day(s)`
      } and is excluded from trading weight.`
    );
  }

  if (
    macro.tenYearYield
      ?.available &&
    !yieldFresh
  ) {
    warnings.push(
      `U.S. 10-year yield observation is stale${
        yieldAge === null
          ? ""
          : ` by approximately ${Math.round(yieldAge)} day(s)`
      } and is excluded from trading weight.`
    );
  }

  const components = [
    {
      key:
        "cryptoMarket",

      available:
        Boolean(
          macro.cryptoMarket
            ?.available
        ),

      weight:
        safeNumber(
          macro.weights
            ?.cryptoMarket
        ),

      score:
        safeNumber(
          macro.scores
            ?.cryptoMarket
        ),
    },
    {
      key:
        "btcMomentum",

      available:
        Boolean(
          macro.btc
            ?.available
        ) &&
        !btcMomentumExcluded,

      weight:
        safeNumber(
          macro.weights
            ?.btcMomentum
        ),

      score:
        safeNumber(
          macro.scores
            ?.btcMomentum
        ),
    },
    {
      key:
        "vix",

      available:
        vixFresh,

      weight:
        safeNumber(
          macro.weights
            ?.vix
        ),

      score:
        safeNumber(
          macro.scores
            ?.vix
        ),
    },
    {
      key:
        "dollar",

      available:
        dollarFresh,

      weight:
        safeNumber(
          macro.weights
            ?.dollar
        ),

      score:
        safeNumber(
          macro.scores
            ?.dollar
        ),
    },
    {
      key:
        "tenYearYield",

      available:
        yieldFresh,

      weight:
        safeNumber(
          macro.weights
            ?.tenYearYield
        ),

      score:
        safeNumber(
          macro.scores
            ?.tenYearYield
        ),
    },
  ];

  const activeComponents =
    components.filter(
      (
        component
      ) =>
        component.available &&
        component.weight >
          0
    );

  const activeWeight =
    activeComponents.reduce(
      (
        total,
        component
      ) =>
        total +
        component.weight,
      0
    );

  const adjustedRawScore =
    activeWeight >
    0
      ? activeComponents.reduce(
          (
            total,
            component
          ) =>
            total +
            component.score *
              component.weight,
          0
        ) /
        activeWeight
      : 0;

  const regime =
    macroRegimeFromScore(
      adjustedRawScore
    );

  const effectiveSourceCount =
    activeComponents.length;

  const effectiveTotalSources =
    Math.max(
      0,
      safeNumber(
        macro.totalSources,
        5
      ) -
        (
          btcMomentumExcluded
            ? 1
            : 0
        )
    );

  const dataQuality =
    effectiveSourceCount >=
    4
      ? "GOOD" as const
      : effectiveSourceCount >=
          2
        ? "PARTIAL" as const
        : "LOW" as const;

  const cappedScore =
    clamp(
      adjustedRawScore,
      -60,
      60
    );

  const meaningfulRegime =
    effectiveSourceCount >=
      2 &&
    dataQuality !==
      "LOW" &&
    regime !==
      "NEUTRAL" &&
    Math.abs(
      adjustedRawScore
    ) >=
      20;

  return {
    available:
      true,

    meaningfulRegime,

    regime,

    rawRegime:
      macro.regime ===
        "RISK_ON" ||
      macro.regime ===
        "RISK_OFF"
        ? macro.regime
        : "NEUTRAL" as const,

    score:
      round(
        cappedScore,
        1
      ),

    rawScore:
      round(
        adjustedRawScore,
        1
      ),

    confidence:
      round(
        clamp(
          safeNumber(
            macro.confidence
          ),
          0,
          100
        ),
        1
      ),

    dataQuality,

    availableSources:
      effectiveSourceCount,

    totalSources:
      effectiveTotalSources,

    btcMomentumExcluded,

    btcDominancePercent:
      round(
        safeNumber(
          macro.cryptoMarket
            ?.btcDominancePercent
        ),
        2
      ),

    btcDominanceRegime:
      macro.cryptoMarket
        ?.btcDominanceRegime ||
      "UNKNOWN",

    cryptoMarketChange24hPercent:
      round(
        safeNumber(
          macro.cryptoMarket
            ?.marketCapChange24hPercent
        ),
        2
      ),

    btcChange24hPercent:
      round(
        safeNumber(
          macro.btc
            ?.change24hPercent
        ),
        2
      ),

    vix:
      round(
        safeNumber(
          macro.vix
            ?.value
        ),
        2
      ),

    dollarChangePercent:
      round(
        safeNumber(
          macro.dollarIndex
            ?.changePercent
        ),
        3
      ),

    tenYearYieldPercent:
      round(
        safeNumber(
          macro.tenYearYield
            ?.valuePercent
        ),
        3
      ),

    tenYearYieldChangeBps:
      round(
        safeNumber(
          macro.tenYearYield
            ?.changeBps
        ),
        1
      ),

    riskOnReasons:
      macro.riskOnReasons ||
      [],

    riskOffReasons:
      macro.riskOffReasons ||
      [],

    warnings:
      uniqueStrings(
        warnings
      ),

    sourceFailures:
      macro.sourceFailures ||
      [],
  };
}

function getTechnicalScore(
  technical:
    TechnicalResponse
) {
  if (
    typeof technical.technicalScore ===
      "number"
  ) {
    return technical.technicalScore;
  }

  if (
    typeof technical.score ===
      "number"
  ) {
    return technical.score;
  }

  return 0;
}

function buildStablecoinIntelligence(
  stablecoins:
    StablecoinResponse | null
) {
  if (
    !stablecoins ||
    !stablecoins.success
  ) {
    return {
      available:
        false,

      meaningfulFlow:
        false,

      bias:
        "NEUTRAL" as const,

      score:
        0,

      rawScore:
        0,

      totalEvents:
        0,

      directionalEvents:
        0,

      classifiedEvents:
        0,

      unclassifiedEvents:
        0,

      classificationCoveragePercent:
        0,

      exchangeInflows:
        0,

      exchangeOutflows:
        0,

      exchangeInflowUsd:
        0,

      exchangeOutflowUsd:
        0,

      netExchangeLiquidityUsd:
        0,

      totalObservedUsd:
        0,
    };
  }

  const summary =
    stablecoins.summary;

  const totalEvents =
    safeNumber(
      summary.totalEvents
    );

  const inflows =
    safeNumber(
      summary.exchangeInflows
    );

  const outflows =
    safeNumber(
      summary.exchangeOutflows
    );

  const exchangeToExchange =
    safeNumber(
      summary.exchangeToExchange
    );

  const unclassified =
    safeNumber(
      summary.unclassified
    );

  const directionalEvents =
    inflows +
    outflows;

  const classifiedEvents =
    inflows +
    outflows +
    exchangeToExchange;

  const classificationCoveragePercent =
    totalEvents >
    0
      ? (
          classifiedEvents /
          totalEvents
        ) *
        100
      : 0;

  const rawScore =
    clamp(
      safeNumber(
        summary.stablecoinScore
      ),
      -100,
      100
    );

  /*
   * Do not allow stablecoins
   * to dominate the engine.
   *
   * Cap the directional score
   * before applying its small
   * portfolio weight.
   */

  const cappedScore =
    clamp(
      rawScore,
      -40,
      40
    );

  /*
   * Require at least two
   * directional exchange events.
   */

  const meaningfulFlow =
    directionalEvents >=
      2 &&
    Math.abs(
      cappedScore
    ) >=
      5;

  return {
    available:
      true,

    meaningfulFlow,

    bias:
      summary.liquidityBias,

    score:
      round(
        cappedScore,
        1
      ),

    rawScore:
      round(
        rawScore,
        1
      ),

    totalEvents,

    directionalEvents,

    classifiedEvents,

    unclassifiedEvents:
      unclassified,

    classificationCoveragePercent:
      round(
        classificationCoveragePercent,
        1
      ),

    exchangeInflows:
      inflows,

    exchangeOutflows:
      outflows,

    exchangeInflowUsd:
      round(
        safeNumber(
          summary.exchangeInflowUsd
        ),
        2
      ),

    exchangeOutflowUsd:
      round(
        safeNumber(
          summary.exchangeOutflowUsd
        ),
        2
      ),

    netExchangeLiquidityUsd:
      round(
        safeNumber(
          summary.netExchangeLiquidityUsd
        ),
        2
      ),

    totalObservedUsd:
      round(
        safeNumber(
          summary.totalObservedUsd
        ),
        2
      ),
  };
}

function getNativeEthWhaleIntelligence(
  symbol: string,
  whales: WhaleResponse | null
) {
  if (
    symbol !== "ETHUSDT" ||
    !whales ||
    !whales.success
  ) {
    return null;
  }

  const summary = whales.summary;
  const exchangeInflows = safeNumber(summary.exchangeInflows);
  const exchangeOutflows = safeNumber(summary.exchangeOutflows);

  return {
    supportedForSymbol: true,
    source: "ETH_NATIVE" as const,
    meaningfulFlow:
      exchangeInflows > 0 || exchangeOutflows > 0,
    bias: summary.directionalBias,
    whaleScore: clamp(safeNumber(summary.whaleScore), -100, 100),
    exchangeInflows,
    exchangeOutflows,
    exchangeInflowUsd: safeNumber(summary.exchangeInflowUsd),
    exchangeOutflowUsd: safeNumber(summary.exchangeOutflowUsd),
    netExchangeFlowUsd: safeNumber(summary.netExchangeFlowUsd),
    largestTransferUsd: safeNumber(summary.largestTransferUsd),
    observedEvents: safeNumber(summary.ethEvents),
    directionalEvents: exchangeInflows + exchangeOutflows,
    classificationCoveragePercent: 100,
  };
}

function getErc20WhaleIntelligence(
  symbol: string,
  erc20: Erc20WhaleResponse | null
) {
  if (
    !ERC20_WHALE_SYMBOLS.has(symbol) ||
    !erc20 ||
    !erc20.success ||
    !erc20.supported ||
    !erc20.summary
  ) {
    return null;
  }

  const summary = erc20.summary;
  const coverage = clamp(
    safeNumber(summary.classificationCoveragePercent),
    0,
    100
  );
  const exchangeInflows = safeNumber(summary.exchangeInflows);
  const exchangeOutflows = safeNumber(summary.exchangeOutflows);
  const score = clamp(safeNumber(erc20.whaleScore), -100, 100);

  /*
   * ERC-20 whale flow only becomes directional when the scanner itself
   * marks it meaningful AND at least 20% of returned large transfers
   * can be attributed. This keeps weak wallet labeling from steering trades.
   */
  const meaningfulFlow =
    Boolean(erc20.meaningfulFlow) &&
    coverage >= 20 &&
    Math.abs(score) >= 8 &&
    exchangeInflows + exchangeOutflows >= 1;

  return {
    supportedForSymbol: true,
    source: "ERC20" as const,
    meaningfulFlow,
    bias: erc20.bias || "NEUTRAL",
    whaleScore: score,
    exchangeInflows,
    exchangeOutflows,
    exchangeInflowUsd: safeNumber(summary.exchangeInflowUsd),
    exchangeOutflowUsd: safeNumber(summary.exchangeOutflowUsd),
    netExchangeFlowUsd: safeNumber(summary.netExchangeFlowUsd),
    largestTransferUsd: safeNumber(summary.largestTransferUsd),
    observedEvents: safeNumber(summary.totalEvents),
    directionalEvents: safeNumber(summary.directionalEvents),
    classificationCoveragePercent: round(coverage, 1),
  };
}

function getWhaleIntelligence(
  symbol: string,
  whales: WhaleResponse | null,
  erc20: Erc20WhaleResponse | null
) {
  const nativeEth = getNativeEthWhaleIntelligence(symbol, whales);
  if (nativeEth) return nativeEth;

  const erc20Whales = getErc20WhaleIntelligence(symbol, erc20);
  if (erc20Whales) return erc20Whales;

  return {
    supportedForSymbol: false,
    source: "NONE" as const,
    meaningfulFlow: false,
    bias: "NOT_SUPPORTED" as const,
    whaleScore: 0,
    exchangeInflows: 0,
    exchangeOutflows: 0,
    exchangeInflowUsd: 0,
    exchangeOutflowUsd: 0,
    netExchangeFlowUsd: 0,
    largestTransferUsd: 0,
    observedEvents: 0,
    directionalEvents: 0,
    classificationCoveragePercent: 0,
  };
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

    const technicalUrl =
      new URL(
        "/api/trading/technical",
        origin
      );

    technicalUrl.searchParams.set(
      "symbol",
      symbol
    );

    technicalUrl.searchParams.set(
      "interval",
      interval
    );

    const derivativesUrl =
      new URL(
        "/api/trading/derivatives",
        origin
      );

    derivativesUrl.searchParams.set(
      "symbol",
      symbol
    );

    /*
     * Required modules.
     */

    const technicalPromise =
      fetchJson<TechnicalResponse>(
        technicalUrl.toString()
      );

    const derivativesPromise =
      fetchJson<DerivativesResponse>(
        derivativesUrl.toString()
      );

    /*
     * Stablecoin liquidity is
     * market-wide and applies to
     * every selected asset.
     */

    const stablecoinPromise =
      fetchStablecoinData(
        origin
      ).catch(
        () =>
          null
      );

    /*
     * Catalyst intelligence combines
     * crypto-news and official Binance
     * announcements. It is optional:
     * a feed failure must never break
     * the core trading engine.
     */

    const catalystPromise =
      fetchCatalystData(
        origin,
        symbol
      ).catch(
        () =>
          null
      );

    /*
     * Macro regime intelligence is
     * optional and fail-open. A FRED,
     * CoinGecko or other upstream failure
     * must never break core market analysis.
     */

    const macroPromise =
      fetchMacroData(
        origin
      ).catch(
        () =>
          null
      );

    /*
     * Native ETH whale flow is used for ETH.
     * Verified ERC-20 whale flow is used for LINK, UNI, AAVE, SHIB and PEPE.
     * Unsupported assets do not trigger either whale scanner.
     */

    let whalePromise: Promise<WhaleResponse | null>;
    let erc20WhalePromise: Promise<Erc20WhaleResponse | null>;

    if (symbol === "ETHUSDT") {
      const whaleUrl = new URL(
        "/api/trading/whales",
        origin
      );

      whaleUrl.searchParams.set(
        "minUsd",
        "500000"
      );

      whalePromise = fetchJson<WhaleResponse>(
        whaleUrl.toString()
      ).catch(() => null);
    } else {
      whalePromise = Promise.resolve(null);
    }

    if (ERC20_WHALE_SYMBOLS.has(symbol)) {
      const erc20WhaleUrl = new URL(
        "/api/trading/erc20-whales",
        origin
      );

      erc20WhaleUrl.searchParams.set(
        "symbol",
        symbol
      );

      erc20WhaleUrl.searchParams.set(
        "minUsd",
        "100000"
      );

      erc20WhaleUrl.searchParams.set(
        "lookback",
        "500"
      );

      erc20WhalePromise = fetchJson<Erc20WhaleResponse>(
        erc20WhaleUrl.toString()
      ).catch(() => null);
    } else {
      erc20WhalePromise = Promise.resolve(null);
    }

    const [
      technical,
      derivatives,
      whales,
      erc20Whales,
      stablecoins,
      catalyst,
      macro,
    ] =
      await Promise.all([
        technicalPromise,
        derivativesPromise,
        whalePromise,
        erc20WhalePromise,
        stablecoinPromise,
        catalystPromise,
        macroPromise,
      ]);

    if (
      !technical.success
    ) {
      throw new Error(
        technical.error ||
          "Technical analysis failed."
      );
    }

    if (
      !derivatives.success
    ) {
      throw new Error(
        derivatives.error ||
          "Derivatives analysis failed."
      );
    }

    /*
     * Prevent hidden BTC fallback.
     */

    if (
      technical.symbol !==
      symbol
    ) {
      throw new Error(
        `Technical symbol mismatch. Requested ${symbol}, received ${technical.symbol}.`
      );
    }

    if (
      derivatives.symbol !==
      symbol
    ) {
      throw new Error(
        `Derivatives symbol mismatch. Requested ${symbol}, received ${derivatives.symbol}.`
      );
    }

    const technicalScore =
      clamp(
        getTechnicalScore(
          technical
        ),
        -100,
        100
      );

    const derivativesScore =
      clamp(
        safeNumber(
          derivatives.derivativesScore
        ),
        -100,
        100
      );

    const whaleIntelligence =
      getWhaleIntelligence(
        symbol,
        whales,
        erc20Whales
      );

    const stablecoinLiquidity =
      buildStablecoinIntelligence(
        stablecoins
      );

    const whaleEnabled =
      whaleIntelligence.supportedForSymbol &&
      whaleIntelligence.meaningfulFlow;

    const stablecoinEnabled =
      stablecoinLiquidity.available &&
      stablecoinLiquidity.meaningfulFlow;

    const catalystIntelligence =
      buildCatalystIntelligence(
        symbol,
        catalyst
      );

    const catalystEnabled =
      catalystIntelligence.available &&
      catalystIntelligence.meaningfulCatalyst &&
      !catalystIntelligence.strongConflict;

    const macroIntelligence =
      buildMacroIntelligence(
        symbol,
        macro
      );

    const macroEnabled =
      macroIntelligence.available &&
      macroIntelligence.meaningfulRegime &&
      macroIntelligence.dataQuality !==
        "LOW";

    const whaleWeight =
      whaleEnabled
        ? whaleIntelligence.source === "ETH_NATIVE"
          ? 20
          : whaleIntelligence.classificationCoveragePercent >= 40
            ? 12
            : 8
        : 0;

    /*
     * Dynamic weighting.
     *
     * ETH native whale intelligence can receive up to 20%.
     * ERC-20 whale intelligence receives only 8-12%, depending on
     * exchange-wallet attribution coverage. Stablecoin liquidity remains 5%.
     *
     * Catalyst intelligence receives at most 8%:
     *   GOOD data quality    -> 8%
     *   PARTIAL data quality -> 5%
     *   conflicting sources  -> 4%
     *   strong conflict/LOW  -> 0%
     *
     * Catalyst weight is taken proportionally from technical + derivatives.
     * Whale and stablecoin weights are not increased or double-counted.
     */

    let weights = {
      technical: 65,
      derivatives: 35,
      whale: 0,
      stablecoin: 0,
      catalyst: 0,
      macro: 0,
    };

    if (stablecoinEnabled) {
      weights = {
        technical: 60,
        derivatives: 35,
        whale: 0,
        stablecoin: 5,
        catalyst: 0,
        macro: 0,
      };
    }

    if (whaleEnabled) {
      if (whaleWeight === 20) {
        weights = {
          technical: stablecoinEnabled ? 47 : 50,
          derivatives: stablecoinEnabled ? 28 : 30,
          whale: 20,
          stablecoin: stablecoinEnabled ? 5 : 0,
          catalyst: 0,
          macro: 0,
        };
      } else if (whaleWeight === 12) {
        weights = {
          technical: stablecoinEnabled ? 52 : 55,
          derivatives: stablecoinEnabled ? 31 : 33,
          whale: 12,
          stablecoin: stablecoinEnabled ? 5 : 0,
          catalyst: 0,
          macro: 0,
        };
      } else {
        weights = {
          technical: stablecoinEnabled ? 55 : 58,
          derivatives: stablecoinEnabled ? 32 : 34,
          whale: 8,
          stablecoin: stablecoinEnabled ? 5 : 0,
          catalyst: 0,
          macro: 0,
        };
      }
    }

    let catalystWeight =
      0;

    if (
      catalystEnabled
    ) {
      if (
        catalystIntelligence.conflict
      ) {
        catalystWeight =
          4;
      } else if (
        catalystIntelligence.dataQuality ===
          "GOOD"
      ) {
        catalystWeight =
          8;
      } else if (
        catalystIntelligence.dataQuality ===
          "PARTIAL"
      ) {
        catalystWeight =
          5;
      }
    }

    if (
      catalystWeight >
      0
    ) {
      const coreWeight =
        weights.technical +
        weights.derivatives;

      const targetCoreWeight =
        coreWeight -
        catalystWeight;

      const adjustedDerivatives =
        round(
          weights.derivatives *
            (
              targetCoreWeight /
              coreWeight
            ),
          1
        );

      const adjustedTechnical =
        round(
          targetCoreWeight -
            adjustedDerivatives,
          1
        );

      weights = {
        ...weights,
        technical:
          adjustedTechnical,
        derivatives:
          adjustedDerivatives,
        catalyst:
          catalystWeight,
      };
    }

    /*
     * Macro receives only a small
     * controlled weight when the
     * effective regime is directional.
     *
     * GOOD effective data    -> 6%
     * PARTIAL effective data -> 4%
     * LOW/NEUTRAL            -> 0%
     *
     * The weight is taken only from
     * technical + derivatives after
     * catalyst allocation. Whale,
     * stablecoin and catalyst weights
     * are preserved.
     */

    let macroWeight =
      0;

    if (
      macroEnabled
    ) {
      macroWeight =
        macroIntelligence.dataQuality ===
        "GOOD"
          ? 6
          : macroIntelligence.dataQuality ===
              "PARTIAL"
            ? 4
            : 0;
    }

    if (
      macroWeight >
      0
    ) {
      const coreWeight =
        weights.technical +
        weights.derivatives;

      const targetCoreWeight =
        coreWeight -
        macroWeight;

      if (
        coreWeight >
        0 &&
        targetCoreWeight >=
        0
      ) {
        const adjustedDerivatives =
          round(
            weights.derivatives *
              (
                targetCoreWeight /
                coreWeight
              ),
            1
          );

        const adjustedTechnical =
          round(
            targetCoreWeight -
              adjustedDerivatives,
            1
          );

        weights = {
          ...weights,
          technical:
            adjustedTechnical,
          derivatives:
            adjustedDerivatives,
          macro:
            macroWeight,
        };
      }
    }

    const technicalContribution =
      technicalScore *
      (
        weights.technical /
        100
      );

    const derivativesContribution =
      derivativesScore *
      (
        weights.derivatives /
        100
      );

    const whaleContribution =
      whaleIntelligence.whaleScore *
      (
        weights.whale /
        100
      );

    const stablecoinContribution =
      stablecoinLiquidity.score *
      (
        weights.stablecoin /
        100
      );

    const catalystContribution =
      catalystIntelligence.score *
      (
        weights.catalyst /
        100
      );

    const macroContribution =
      macroIntelligence.score *
      (
        weights.macro /
        100
      );

    let combinedScore =
      technicalContribution +
      derivativesContribution +
      whaleContribution +
      stablecoinContribution +
      catalystContribution +
      macroContribution;

    const confirmationReasons:
      string[] = [];

    const warnings:
      string[] = [];

    const netStablecoinLiquidity =
      stablecoinLiquidity
        .netExchangeLiquidityUsd;

    let conflict =
      false;

    let aligned =
      false;

    /*
     * Technical +
     * derivatives agreement.
     */

    if (
      technical.signal ===
        "LONG" &&
      derivatives.bias ===
        "BULLISH"
    ) {
      aligned =
        true;

      combinedScore +=
        6;

      confirmationReasons.push(
        "Technical analysis and derivatives/order flow are both bullish."
      );
    }

    if (
      technical.signal ===
        "SHORT" &&
      derivatives.bias ===
        "BEARISH"
    ) {
      aligned =
        true;

      combinedScore -=
        6;

      confirmationReasons.push(
        "Technical analysis and derivatives/order flow are both bearish."
      );
    }

    /*
     * Strong conflict.
     */

    if (
      technical.signal ===
        "LONG" &&
      derivativesScore <=
        -30
    ) {
      conflict =
        true;

      warnings.push(
        "Technical structure is bullish but derivatives/order flow is strongly bearish."
      );
    }

    if (
      technical.signal ===
        "SHORT" &&
      derivativesScore >=
        30
    ) {
      conflict =
        true;

      warnings.push(
        "Technical structure is bearish but derivatives/order flow is strongly bullish."
      );
    }

    /*
     * ETH whale
     * confirmation.
     */

    if (
      whaleEnabled &&
      whaleIntelligence.bias ===
        "BULLISH"
    ) {
      combinedScore +=
        2;

      confirmationReasons.push(
        `${symbol.replace("USDT", "")} exchange-wallet whale activity currently leans bullish.`
      );
    }

    if (
      whaleEnabled &&
      whaleIntelligence.bias ===
        "BEARISH"
    ) {
      combinedScore -=
        2;

      confirmationReasons.push(
        `${symbol.replace("USDT", "")} exchange-wallet whale activity currently leans bearish.`
      );
    }

    /*
     * Stablecoin liquidity
     * confirmation.
     *
     * Never more than a small
     * adjustment.
     */

    if (
      stablecoinEnabled &&
      stablecoinLiquidity.bias ===
        "BULLISH"
    ) {
      combinedScore +=
        1;
    }

    if (
      stablecoinEnabled &&
      stablecoinLiquidity.bias ===
        "BEARISH"
    ) {
      combinedScore -=
        1;
    }

    /*
     * Net dollar flow and weighted
     * stablecoin score are separate
     * measurements.
     *
     * Use the actual net dollar
     * flow sign for descriptive
     * liquidity text.
     */

    if (
      stablecoinLiquidity.available &&
      netStablecoinLiquidity >
        0
    ) {
      confirmationReasons.push(
        `Net stablecoin exchange liquidity increased by approximately $${Math.round(
          netStablecoinLiquidity
        ).toLocaleString(
          "en-US"
        )}.`
      );
    }

    if (
      stablecoinLiquidity.available &&
      netStablecoinLiquidity <
        0
    ) {
      confirmationReasons.push(
        `Net stablecoin exchange liquidity decreased by approximately $${Math.abs(
          Math.round(
            netStablecoinLiquidity
          )
        ).toLocaleString(
          "en-US"
        )}.`
      );
    }

    /*
     * A weighted event score can
     * disagree with raw net dollar
     * flow because transfer sizes
     * and wallet-attribution
     * confidence are scored
     * separately.
     */

    if (
      stablecoinEnabled &&
      (
        (
          stablecoinLiquidity.bias ===
            "BULLISH" &&
          netStablecoinLiquidity <
            0
        ) ||
        (
          stablecoinLiquidity.bias ===
            "BEARISH" &&
          netStablecoinLiquidity >
            0
        )
      )
    ) {
      warnings.push(
        "Weighted stablecoin flow score and raw net exchange liquidity point in opposite directions, so stablecoin evidence is mixed."
      );
    }

    if (
      whaleIntelligence.source === "ERC20" &&
      whaleIntelligence.supportedForSymbol &&
      whaleIntelligence.observedEvents > 0 &&
      whaleIntelligence.classificationCoveragePercent < 40
    ) {
      warnings.push(
        `Only ${whaleIntelligence.classificationCoveragePercent}% of recent large ${symbol.replace("USDT", "")} transfers were attributed to known exchange wallets, so ERC-20 whale influence is reduced.`
      );
    }

    /*
     * Low attribution coverage
     * should be visible as a
     * quality warning.
     */

    if (
      stablecoinLiquidity.available &&
      stablecoinLiquidity.totalEvents >
        0 &&
      stablecoinLiquidity.classificationCoveragePercent <
        25
    ) {
      warnings.push(
        `Only ${stablecoinLiquidity.classificationCoveragePercent}% of recent large stablecoin transfers were attributed to known exchange wallets, so the stablecoin signal is low-weight confirmation only.`
      );
    }

    /*
     * Catalyst intelligence contributes
     * through its controlled weight only.
     * Do not add a second directional
     * score bonus here.
     */

    if (
      catalystEnabled &&
      catalystIntelligence.bias !==
        "NEUTRAL"
    ) {
      confirmationReasons.push(
        `Catalyst intelligence currently leans ${catalystIntelligence.bias.toLowerCase()} with score ${catalystIntelligence.rawScore}.`
      );
    }

    if (
      catalystIntelligence.highImpactCatalysts >
      0
    ) {
      confirmationReasons.push(
        `${catalystIntelligence.highImpactCatalysts} high-impact news/announcement catalyst${
          catalystIntelligence.highImpactCatalysts === 1
            ? ""
            : "s"
        } detected for ${symbol.replace("USDT", "")}.`
      );
    }

    if (
      catalystIntelligence.conflict
    ) {
      warnings.push(
        "Crypto-news and official Binance announcements currently point in different directions, so catalyst influence is reduced."
      );
    }

    if (
      catalystIntelligence.strongConflict
    ) {
      warnings.push(
        "Strong catalyst conflict detected. Catalyst weight is disabled until the news/announcement disagreement resolves."
      );
    }

    /*
     * Macro contributes only through
     * its controlled portfolio weight.
     * Do not add a second directional
     * score bonus here.
     */

    if (
      macroEnabled &&
      macroIntelligence.regime !==
        "NEUTRAL"
    ) {
      confirmationReasons.push(
        `Macro/market regime is ${macroIntelligence.regime.replace(
          "_",
          "-"
        )} with adjusted score ${macroIntelligence.rawScore}.`
      );
    }

    if (
      macroIntelligence.available &&
      macroIntelligence.dataQuality !==
        "GOOD"
    ) {
      warnings.push(
        `Effective macro data quality is ${macroIntelligence.dataQuality.toLowerCase()}, so macro influence is reduced or disabled.`
      );
    }

    combinedScore =
      clamp(
        combinedScore,
        -100,
        100
      );

    let finalSignal:
      TradeSignal =
      "WAIT";

    if (
      !conflict &&
      combinedScore >=
        30
    ) {
      finalSignal =
        "LONG";
    } else if (
      !conflict &&
      combinedScore <=
        -30
    ) {
      finalSignal =
        "SHORT";
    }

    /*
     * Heuristic confidence.
     */

    let confidence =
      50 +
      Math.abs(
        combinedScore
      ) *
        0.42;

    if (
      aligned
    ) {
      confidence +=
        4;
    }

    if (
      whaleEnabled
    ) {
      if (
        finalSignal ===
          "LONG" &&
        whaleIntelligence.bias ===
          "BULLISH"
      ) {
        confidence +=
          3;
      }

      if (
        finalSignal ===
          "SHORT" &&
        whaleIntelligence.bias ===
          "BEARISH"
      ) {
        confidence +=
          3;
      }
    }

    if (
      stablecoinEnabled
    ) {
      if (
        finalSignal ===
          "LONG" &&
        stablecoinLiquidity.bias ===
          "BULLISH"
      ) {
        confidence +=
          1;
      }

      if (
        finalSignal ===
          "SHORT" &&
        stablecoinLiquidity.bias ===
          "BEARISH"
      ) {
        confidence +=
          1;
      }
    }

    if (
      catalystEnabled &&
      finalSignal !==
        "WAIT"
    ) {
      if (
        (
          finalSignal ===
            "LONG" &&
          catalystIntelligence.bias ===
            "BULLISH"
        ) ||
        (
          finalSignal ===
            "SHORT" &&
          catalystIntelligence.bias ===
            "BEARISH"
        )
      ) {
        confidence +=
          2;
      } else if (
        catalystIntelligence.bias !==
          "NEUTRAL"
      ) {
        confidence -=
          2;
      }
    }

    if (
      catalystIntelligence.conflict
    ) {
      confidence -=
        2;
    }

    if (
      macroEnabled &&
      finalSignal !==
        "WAIT"
    ) {
      if (
        (
          finalSignal ===
            "LONG" &&
          macroIntelligence.regime ===
            "RISK_ON"
        ) ||
        (
          finalSignal ===
            "SHORT" &&
          macroIntelligence.regime ===
            "RISK_OFF"
        )
      ) {
        confidence +=
          1;
      } else if (
        macroIntelligence.regime !==
          "NEUTRAL"
      ) {
        confidence -=
          1;
      }
    }

    if (
      conflict
    ) {
      confidence -=
        18;
    }

    if (
      finalSignal ===
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

    const price =
      safeNumber(
        technical.currentPrice
      );

    const atr =
      safeNumber(
        technical.indicators.atr
      );

    const support =
      safeNumber(
        technical.indicators.support
      );

    const resistance =
      safeNumber(
        technical.indicators.resistance
      );

    const bullishReasons = [
      ...(
        technical.bullishReasons ||
        []
      ),

      ...(
        derivatives.bullishReasons ||
        []
      ),
    ];

    const bearishReasons = [
      ...(
        technical.bearishReasons ||
        []
      ),

      ...(
        derivatives.bearishReasons ||
        []
      ),
    ];

    if (
      whaleEnabled &&
      whaleIntelligence.bias ===
        "BULLISH"
    ) {
      bullishReasons.push(
        `Labeled ${symbol.replace("USDT", "")} exchange-wallet activity currently shows net whale outflow pressure.`
      );
    }

    if (
      whaleEnabled &&
      whaleIntelligence.bias ===
        "BEARISH"
    ) {
      bearishReasons.push(
        `Labeled ${symbol.replace("USDT", "")} exchange-wallet activity currently shows net whale inflow pressure.`
      );
    }

    if (
      stablecoinEnabled &&
      stablecoinLiquidity.bias ===
        "BULLISH"
    ) {
      bullishReasons.push(
        "Weighted USDT/USDC exchange-flow scoring currently leans bullish."
      );
    }

    if (
      stablecoinEnabled &&
      stablecoinLiquidity.bias ===
        "BEARISH"
    ) {
      bearishReasons.push(
        "Weighted USDT/USDC exchange-flow scoring currently leans bearish."
      );
    }

    if (
      catalystEnabled &&
      catalystIntelligence.bias ===
        "BULLISH"
    ) {
      bullishReasons.push(
        `Catalyst intelligence (coin-specific plus controlled market-wide context) currently leans bullish with catalyst score ${catalystIntelligence.rawScore}.`
      );
    }

    if (
      catalystEnabled &&
      catalystIntelligence.bias ===
        "BEARISH"
    ) {
      bearishReasons.push(
        `Catalyst intelligence (coin-specific plus controlled market-wide context) currently leans bearish with catalyst score ${catalystIntelligence.rawScore}.`
      );
    }

    if (
      macroEnabled &&
      macroIntelligence.regime ===
        "RISK_ON"
    ) {
      bullishReasons.push(
        `Macro and broad-market conditions currently lean risk-on with adjusted regime score ${macroIntelligence.rawScore}.`
      );
    }

    if (
      macroEnabled &&
      macroIntelligence.regime ===
        "RISK_OFF"
    ) {
      bearishReasons.push(
        `Macro and broad-market conditions currently lean risk-off with adjusted regime score ${macroIntelligence.rawScore}.`
      );
    }

    const risks = [
      ...(
        technical.risks ||
        []
      ),

      ...(
        derivatives.risks ||
        []
      ),

      ...(
        catalystIntelligence.risks ||
        []
      ),

      ...warnings,
    ];

    /*
     * Only expose a trade plan
     * when final signal permits
     * a trade.
     */

    const tradePlan =
      finalSignal ===
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
        : technical.tradePlan;

    const derivativesBasis =
      typeof derivatives.basisPercent ===
        "number"
        ? derivatives.basisPercent
        : safeNumber(
            derivatives.prices
              ?.basisPercent
          );

    const openInterestChange =
      typeof derivatives
        .openInterest
        .changePercent ===
        "number"
        ? derivatives.openInterest
            .changePercent
        : safeNumber(
            derivatives
              .openInterest
              .changeApprox1hPercent
          );

    return NextResponse.json({
      success:
        true,

      symbol,

      interval,

      finalSignal,

      combinedScore:
        round(
          combinedScore,
          2
        ),

      confidence:
        round(
          confidence,
          1
        ),

      confidenceType:
        "heuristic",

      aligned,

      conflict,

      currentPrice:
        price,

      weights: {
        technical:
          weights.technical,

        derivatives:
          weights.derivatives,

        whale:
          weights.whale,

        stablecoin:
          weights.stablecoin,

        catalyst:
          weights.catalyst,

        macro:
          weights.macro,
      },

      scores: {
        technical:
          round(
            technicalScore,
            1
          ),

        technicalContribution:
          round(
            technicalContribution,
            2
          ),

        derivatives:
          round(
            derivativesScore,
            1
          ),

        derivativesContribution:
          round(
            derivativesContribution,
            2
          ),

        whale:
          round(
            whaleIntelligence.whaleScore,
            1
          ),

        whaleContribution:
          round(
            whaleContribution,
            2
          ),

        stablecoin:
          round(
            stablecoinLiquidity.score,
            1
          ),

        stablecoinContribution:
          round(
            stablecoinContribution,
            2
          ),

        catalyst:
          round(
            catalystIntelligence.score,
            1
          ),

        catalystRaw:
          round(
            catalystIntelligence.rawScore,
            1
          ),

        catalystContribution:
          round(
            catalystContribution,
            2
          ),

        macro:
          round(
            macroIntelligence.score,
            1
          ),

        macroRaw:
          round(
            macroIntelligence.rawScore,
            1
          ),

        macroContribution:
          round(
            macroContribution,
            2
          ),
      },

      whaleIntelligence,

      stablecoinLiquidity,

      catalystIntelligence,

      macroIntelligence,

      tradePlan,

      marketStructure: {
        support,

        resistance,

        atr,

        rsi:
          safeNumber(
            technical.indicators.rsi
          ),

        candlePattern:
          technical.candlePattern ||
          "NONE",
      },

      derivatives: {
        bias:
          derivatives.bias,

        fundingPercent:
          safeNumber(
            derivatives.funding
              .percent
          ),

        openInterestChangePercent:
          openInterestChange,

        orderBookImbalancePercent:
          safeNumber(
            derivatives.orderBook
              .imbalancePercent
          ),

        takerBuySellRatio:
          safeNumber(
            derivatives.takerFlow
              .buySellRatio
          ),

        longShortRatio:
          safeNumber(
            derivatives.positioning
              .longShortRatio
          ),

        basisPercent:
          derivativesBasis,
      },

      confirmationReasons:
        uniqueStrings(
          confirmationReasons
        ),

      bullishReasons:
        uniqueStrings(
          bullishReasons
        ),

      bearishReasons:
        uniqueStrings(
          bearishReasons
        ),

      risks:
        uniqueStrings(
          risks
        ),

      modules: {
        technical:
          true,

        derivatives:
          true,

        orderBook:
          true,

        takerFlow:
          true,

        whales:
          whaleIntelligence.supportedForSymbol,

        ethExchangeFlow:
          symbol ===
            "ETHUSDT",

        stablecoinLiquidity:
          stablecoinLiquidity.available,

        usdt:
          stablecoinLiquidity.available,

        usdc:
          stablecoinLiquidity.available,

        btcExchangeFlow:
          false,

        solanaWhales:
          false,

        erc20Whales:
          whaleIntelligence.source ===
            "ERC20",

        news:
          catalystIntelligence.newsRequestSucceeded,

        announcements:
          catalystIntelligence.announcementRequestSucceeded,

        catalyst:
          catalystIntelligence.available,

        catalystWeighted:
          weights.catalyst >
            0,

        macro:
          macroIntelligence.available,

        macroWeighted:
          weights.macro >
            0,

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
      "Trading signal API error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate trading signal.",
      },
      {
        status:
          500,
      }
    );
  }
}