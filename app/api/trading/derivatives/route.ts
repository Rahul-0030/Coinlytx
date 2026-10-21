import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OKX_BASE =
  "https://openapi.okx.com";

type OkxResponse<T> = {
  code: string;
  msg: string;
  data: T[];
};

type FundingData = {
  instType?: string;
  instId?: string;
  fundingRate?: string;
  nextFundingTime?: string;
  fundingTime?: string;
};

type MarkPriceData = {
  instType?: string;
  instId?: string;
  markPx?: string;
  ts?: string;
};

type IndexTickerData = {
  instId?: string;
  idxPx?: string;
  high24h?: string;
  low24h?: string;
  open24h?: string;
  sodUtc0?: string;
  sodUtc8?: string;
  ts?: string;
};

type OpenInterestData = {
  instType?: string;
  instId?: string;
  oi?: string;
  oiCcy?: string;
  oiUsd?: string;
  ts?: string;
};

type BookData = {
  asks?: string[][];
  bids?: string[][];
  ts?: string;
};

type TradeData = {
  instId?: string;
  tradeId?: string;
  px?: string;
  sz?: string;
  side?:
    | "buy"
    | "sell"
    | string;
  ts?: string;
  source?: string;
};

type InstrumentData = {
  instType?: string;
  instId?: string;
  uly?: string;
  instFamily?: string;
  baseCcy?: string;
  quoteCcy?: string;
  settleCcy?: string;
  ctVal?: string;
  ctMult?: string;
  ctValCcy?: string;
  state?: string;
};

type BookBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

type LargeTradeBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

type BookLevel = {
  price: number;
  contracts: number;
  baseQuantity: number;
  notionalUsd: number;
  distancePercent: number;
};

type ExecutedTrade = {
  tradeId: string;
  side:
    | "buy"
    | "sell";
  price: number;
  contracts: number;
  baseQuantity: number;
  notionalUsd: number;
  timestamp: number;
};

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const result =
    Number(value);

  return Number.isFinite(
    result
  )
    ? result
    : fallback;
}

function round(
  value: number,
  decimals = 4
) {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
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

function average(
  values: number[]
) {
  if (
    values.length === 0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}

function median(
  values: number[]
) {
  if (
    values.length === 0
  ) {
    return 0;
  }

  const sorted = [
    ...values,
  ].sort(
    (a, b) =>
      a - b
  );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 ===
    0
  ) {
    return (
      (
        sorted[
          middle - 1
        ] +
        sorted[middle]
      ) /
      2
    );
  }

  return sorted[middle];
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

function priceDecimals(
  price: number
) {
  if (
    price < 0.0001
  ) {
    return 10;
  }

  if (
    price < 0.01
  ) {
    return 8;
  }

  if (
    price < 1
  ) {
    return 6;
  }

  if (
    price < 100
  ) {
    return 4;
  }

  return 2;
}

/* =========================================================
   SYMBOL HELPERS
   ========================================================= */

function toOkxSwapSymbol(
  symbol: string
) {
  const normalized =
    symbol.toUpperCase();

  if (
    !normalized.endsWith(
      "USDT"
    )
  ) {
    throw new Error(
      `Unsupported derivatives symbol: ${symbol}. Only USDT pairs are currently supported.`
    );
  }

  const base =
    normalized.slice(
      0,
      -4
    );

  if (!base) {
    throw new Error(
      `Invalid trading symbol: ${symbol}`
    );
  }

  return `${base}-USDT-SWAP`;
}

function toOkxIndexSymbol(
  symbol: string
) {
  const normalized =
    symbol.toUpperCase();

  const base =
    normalized.endsWith(
      "USDT"
    )
      ? normalized.slice(
          0,
          -4
        )
      : normalized;

  return `${base}-USDT`;
}

/* =========================================================
   OKX FETCH
   ========================================================= */

async function fetchOkx<T>(
  path: string
): Promise<
  OkxResponse<T>
> {
  const response =
    await fetch(
      `${OKX_BASE}${path}`,
      {
        cache: "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `OKX request failed: HTTP ${response.status}`
    );
  }

  const body =
    (await response.json()) as
      OkxResponse<T>;

  if (
    body.code !== "0"
  ) {
    throw new Error(
      body.msg ||
        `OKX API error ${body.code}`
    );
  }

  return body;
}

async function optionalFetch<T>(
  path: string
): Promise<
  OkxResponse<T> | null
> {
  try {
    return await fetchOkx<T>(
      path
    );
  } catch (error) {
    console.warn(
      "Optional OKX request failed:",
      path,
      error
    );

    return null;
  }
}

/* =========================================================
   CONTRACT CONVERSION
   ========================================================= */

function getContractBaseQuantity(
  contracts: number,
  contractValue: number,
  contractMultiplier: number
) {
  const multiplier =
    contractMultiplier > 0
      ? contractMultiplier
      : 1;

  const value =
    contractValue > 0
      ? contractValue
      : 1;

  return (
    contracts *
    value *
    multiplier
  );
}

/* =========================================================
   EXISTING BOOK LIQUIDITY
   ========================================================= */

function calculateBookLiquidity(
  levels: string[][],
  contractValue: number,
  contractMultiplier: number
) {
  return levels.reduce(
    (
      total,
      level
    ) => {
      const price =
        safeNumber(
          level[0]
        );

      const contracts =
        safeNumber(
          level[1]
        );

      const baseQuantity =
        getContractBaseQuantity(
          contracts,
          contractValue,
          contractMultiplier
        );

      return (
        total +
        price *
          baseQuantity
      );
    },
    0
  );
}

/* =========================================================
   EXISTING TAKER FLOW
   ========================================================= */

function calculateTradeFlow(
  trades: TradeData[],
  contractValue: number,
  contractMultiplier: number
) {
  let buyVolume = 0;
  let sellVolume = 0;

  let buyNotional = 0;
  let sellNotional = 0;

  for (
    const trade of trades
  ) {
    const contracts =
      safeNumber(
        trade.sz
      );

    const price =
      safeNumber(
        trade.px
      );

    const baseQuantity =
      getContractBaseQuantity(
        contracts,
        contractValue,
        contractMultiplier
      );

    const notional =
      baseQuantity *
      price;

    if (
      trade.side ===
      "buy"
    ) {
      buyVolume +=
        baseQuantity;

      buyNotional +=
        notional;
    }

    if (
      trade.side ===
      "sell"
    ) {
      sellVolume +=
        baseQuantity;

      sellNotional +=
        notional;
    }
  }

  const buySellRatio =
    sellNotional > 0
      ? buyNotional /
        sellNotional
      : buyNotional > 0
        ? 2
        : 1;

  return {
    buyVolume,
    sellVolume,
    buyNotional,
    sellNotional,
    buySellRatio,
  };
}

/* =========================================================
   ORDER BOOK LEVEL CONVERSION
   ========================================================= */

function convertBookLevels(
  levels: string[][],
  midpoint: number,
  contractValue: number,
  contractMultiplier: number
): BookLevel[] {
  return levels
    .map(
      (level) => {
        const price =
          safeNumber(
            level[0]
          );

        const contracts =
          safeNumber(
            level[1]
          );

        const baseQuantity =
          getContractBaseQuantity(
            contracts,
            contractValue,
            contractMultiplier
          );

        const notionalUsd =
          price *
          baseQuantity;

        const distancePercent =
          midpoint > 0
            ? (
                Math.abs(
                  price -
                    midpoint
                ) /
                midpoint
              ) *
              100
            : 0;

        return {
          price,
          contracts,
          baseQuantity,
          notionalUsd,
          distancePercent,
        };
      }
    )
    .filter(
      (level) =>
        level.price > 0 &&
        level.contracts > 0
    );
}

/* =========================================================
   ORDER BOOK DEPTH
   ========================================================= */

function calculateDepthBand({
  bids,
  asks,
  midpoint,
  percent,
}: {
  bids: BookLevel[];
  asks: BookLevel[];
  midpoint: number;
  percent: number;
}) {
  const bidLevels =
    bids.filter(
      (level) =>
        level.distancePercent <=
        percent
    );

  const askLevels =
    asks.filter(
      (level) =>
        level.distancePercent <=
        percent
    );

  const bidLiquidityUsd =
    bidLevels.reduce(
      (
        total,
        level
      ) =>
        total +
        level.notionalUsd,
      0
    );

  const askLiquidityUsd =
    askLevels.reduce(
      (
        total,
        level
      ) =>
        total +
        level.notionalUsd,
      0
    );

  const totalLiquidityUsd =
    bidLiquidityUsd +
    askLiquidityUsd;

  const imbalancePercent =
    totalLiquidityUsd > 0
      ? (
          (
            bidLiquidityUsd -
            askLiquidityUsd
          ) /
          totalLiquidityUsd
        ) *
        100
      : 0;

  /*
   * Coverage:
   *
   * If the furthest returned bid
   * and ask reach the requested
   * percentage band, then OKX's
   * 50-level snapshot covered it.
   */

  const furthestBidDistance =
    bids.length > 0
      ? Math.max(
          ...bids.map(
            (level) =>
              level.distancePercent
          )
        )
      : 0;

  const furthestAskDistance =
    asks.length > 0
      ? Math.max(
          ...asks.map(
            (level) =>
              level.distancePercent
          )
        )
      : 0;

  const coverageComplete =
    furthestBidDistance >=
      percent &&
    furthestAskDistance >=
      percent;

  return {
    percent,

    bidLiquidityUsd:
      round(
        bidLiquidityUsd,
        2
      ),

    askLiquidityUsd:
      round(
        askLiquidityUsd,
        2
      ),

    totalLiquidityUsd:
      round(
        totalLiquidityUsd,
        2
      ),

    imbalancePercent:
      round(
        imbalancePercent,
        2
      ),

    bidLevels:
      bidLevels.length,

    askLevels:
      askLevels.length,

    coverageComplete,

    midpoint:
      round(
        midpoint,
        priceDecimals(
          midpoint
        )
      ),
  };
}

/* =========================================================
   WALL FORMATTER
   ========================================================= */

function formatBookLevel(
  level:
    | BookLevel
    | null,
  decimals: number
) {
  if (!level) {
    return null;
  }

  return {
    price:
      round(
        level.price,
        decimals
      ),

    contracts:
      round(
        level.contracts,
        4
      ),

    baseQuantity:
      round(
        level.baseQuantity,
        8
      ),

    notionalUsd:
      round(
        level.notionalUsd,
        2
      ),

    distancePercent:
      round(
        level.distancePercent,
        4
      ),
  };
}

/* =========================================================
   ORDER BOOK INTELLIGENCE
   ========================================================= */

function calculateOrderBookIntelligence({
  bids,
  asks,
  midpoint,
  spread,
  spreadBps,
  contractValue,
  contractMultiplier,
}: {
  bids: string[][];
  asks: string[][];
  midpoint: number;
  spread: number;
  spreadBps: number;
  contractValue: number;
  contractMultiplier: number;
}) {
  const decimals =
    priceDecimals(
      midpoint
    );

  const bidLevels =
    convertBookLevels(
      bids,
      midpoint,
      contractValue,
      contractMultiplier
    );

  const askLevels =
    convertBookLevels(
      asks,
      midpoint,
      contractValue,
      contractMultiplier
    );

  const allLevels = [
    ...bidLevels,
    ...askLevels,
  ];

  const allNotionals =
    allLevels.map(
      (level) =>
        level.notionalUsd
    );

  const medianLevelUsd =
    median(
      allNotionals
    );

  const averageLevelUsd =
    average(
      allNotionals
    );

  /*
   * Dynamic wall threshold.
   *
   * A wall is judged relative
   * to this particular book,
   * not with a universal fixed
   * dollar threshold.
   */

  const wallThresholdUsd =
    Math.max(
      medianLevelUsd *
        2.5,
      averageLevelUsd *
        1.5
    );

  const sortedBids =
    [...bidLevels].sort(
      (a, b) =>
        b.notionalUsd -
        a.notionalUsd
    );

  const sortedAsks =
    [...askLevels].sort(
      (a, b) =>
        b.notionalUsd -
        a.notionalUsd
    );

  const largestBuyWall =
    sortedBids[0] ??
    null;

  const largestSellWall =
    sortedAsks[0] ??
    null;

  const topBuyWalls =
    sortedBids
      .slice(
        0,
        5
      );

  const topSellWalls =
    sortedAsks
      .slice(
        0,
        5
      );

  const majorBuyWalls =
    bidLevels
      .filter(
        (level) =>
          level.notionalUsd >=
          wallThresholdUsd
      )
      .sort(
        (a, b) =>
          a.distancePercent -
          b.distancePercent
      );

  const majorSellWalls =
    askLevels
      .filter(
        (level) =>
          level.notionalUsd >=
          wallThresholdUsd
      )
      .sort(
        (a, b) =>
          a.distancePercent -
          b.distancePercent
      );

  const nearestMajorBuyWall =
    majorBuyWalls[0] ??
    null;

  const nearestMajorSellWall =
    majorSellWalls[0] ??
    null;

  const totalBidLiquidityUsd =
    bidLevels.reduce(
      (
        total,
        level
      ) =>
        total +
        level.notionalUsd,
      0
    );

  const totalAskLiquidityUsd =
    askLevels.reduce(
      (
        total,
        level
      ) =>
        total +
        level.notionalUsd,
      0
    );

  const totalLiquidityUsd =
    totalBidLiquidityUsd +
    totalAskLiquidityUsd;

  const overallImbalancePercent =
    totalLiquidityUsd > 0
      ? (
          (
            totalBidLiquidityUsd -
            totalAskLiquidityUsd
          ) /
          totalLiquidityUsd
        ) *
        100
      : 0;

  const top5BidLiquidity =
    topBuyWalls.reduce(
      (
        total,
        level
      ) =>
        total +
        level.notionalUsd,
      0
    );

  const top5AskLiquidity =
    topSellWalls.reduce(
      (
        total,
        level
      ) =>
        total +
        level.notionalUsd,
      0
    );

  const bidWallConcentrationPercent =
    totalBidLiquidityUsd > 0
      ? (
          top5BidLiquidity /
          totalBidLiquidityUsd
        ) *
        100
      : 0;

  const askWallConcentrationPercent =
    totalAskLiquidityUsd > 0
      ? (
          top5AskLiquidity /
          totalAskLiquidityUsd
        ) *
        100
      : 0;

  const depth010 =
    calculateDepthBand({
      bids: bidLevels,
      asks: askLevels,
      midpoint,
      percent: 0.1,
    });

  const depth025 =
    calculateDepthBand({
      bids: bidLevels,
      asks: askLevels,
      midpoint,
      percent: 0.25,
    });

  const depth050 =
    calculateDepthBand({
      bids: bidLevels,
      asks: askLevels,
      midpoint,
      percent: 0.5,
    });

  const depth100 =
    calculateDepthBand({
      bids: bidLevels,
      asks: askLevels,
      midpoint,
      percent: 1,
    });

  let score = 0;

  const confirmations:
    string[] = [];

  const risks:
    string[] = [];

  /*
   * Near-market depth carries
   * more weight than distant
   * book levels.
   */

  if (
    depth010.imbalancePercent >=
    25
  ) {
    score += 25;

    confirmations.push(
      "Very near-market liquidity is strongly bid-heavy."
    );
  } else if (
    depth010.imbalancePercent >=
    10
  ) {
    score += 15;

    confirmations.push(
      "Near-market liquidity is bid-heavy."
    );
  } else if (
    depth010.imbalancePercent <=
    -25
  ) {
    score -= 25;

    confirmations.push(
      "Very near-market liquidity is strongly ask-heavy."
    );
  } else if (
    depth010.imbalancePercent <=
    -10
  ) {
    score -= 15;

    confirmations.push(
      "Near-market liquidity is ask-heavy."
    );
  }

  if (
    depth025.imbalancePercent >=
    20
  ) {
    score += 15;

    confirmations.push(
      "Liquidity within 0.25% of market favors bids."
    );
  } else if (
    depth025.imbalancePercent <=
    -20
  ) {
    score -= 15;

    confirmations.push(
      "Liquidity within 0.25% of market favors asks."
    );
  }

  if (
    overallImbalancePercent >=
    20
  ) {
    score += 10;
  } else if (
    overallImbalancePercent <=
    -20
  ) {
    score -= 10;
  }

  /*
   * Nearby major walls.
   */

  if (
    nearestMajorBuyWall &&
    nearestMajorBuyWall
      .distancePercent <=
      0.25
  ) {
    score += 15;

    confirmations.push(
      "A major buy wall is positioned close below market."
    );
  }

  if (
    nearestMajorSellWall &&
    nearestMajorSellWall
      .distancePercent <=
      0.25
  ) {
    score -= 15;

    confirmations.push(
      "A major sell wall is positioned close above market."
    );
  }

  /*
   * Compare strongest wall.
   */

  if (
    largestBuyWall &&
    largestSellWall
  ) {
    const buyWallUsd =
      largestBuyWall
        .notionalUsd;

    const sellWallUsd =
      largestSellWall
        .notionalUsd;

    if (
      sellWallUsd > 0 &&
      buyWallUsd /
        sellWallUsd >=
        1.75
    ) {
      score += 10;

      confirmations.push(
        "The strongest buy wall is substantially larger than the strongest sell wall."
      );
    }

    if (
      buyWallUsd > 0 &&
      sellWallUsd /
        buyWallUsd >=
        1.75
    ) {
      score -= 10;

      confirmations.push(
        "The strongest sell wall is substantially larger than the strongest buy wall."
      );
    }
  }

  /*
   * Concentration/manipulation risk.
   *
   * A book dominated by a few
   * levels can disappear quickly.
   */

  if (
    bidWallConcentrationPercent >=
    65
  ) {
    risks.push(
      "Bid liquidity is highly concentrated in a few large levels; support may disappear quickly."
    );
  }

  if (
    askWallConcentrationPercent >=
    65
  ) {
    risks.push(
      "Ask liquidity is highly concentrated in a few large levels; resistance may disappear quickly."
    );
  }

  if (
    spreadBps >= 10
  ) {
    risks.push(
      "Bid-ask spread is relatively wide, increasing execution and liquidity risk."
    );
  }

  if (
    !depth050.coverageComplete
  ) {
    risks.push(
      "The 50-level snapshot does not fully cover ±0.50% depth."
    );
  }

  if (
    !depth100.coverageComplete
  ) {
    risks.push(
      "The 50-level snapshot does not fully cover ±1.00% depth."
    );
  }

  /*
   * Single snapshot cannot prove
   * spoofing. We only flag
   * concentration / spoof-like risk.
   */

  const largestLevelUsd =
    Math.max(
      largestBuyWall
        ?.notionalUsd ??
        0,
      largestSellWall
        ?.notionalUsd ??
        0
    );

  if (
    medianLevelUsd > 0 &&
    largestLevelUsd /
      medianLevelUsd >=
      10
  ) {
    risks.push(
      "An unusually large wall exists relative to typical book levels. Persistence must be checked before treating it as genuine liquidity."
    );
  }

  score =
    clamp(
      score,
      -100,
      100
    );

  let bias:
    BookBias =
    "NEUTRAL";

  if (
    score >= 20
  ) {
    bias =
      "BULLISH";
  } else if (
    score <= -20
  ) {
    bias =
      "BEARISH";
  }

  return {
    bias,

    score:
      round(
        score,
        1
      ),

    midpoint:
      round(
        midpoint,
        decimals
      ),

    spread:
      round(
        spread,
        decimals
      ),

    spreadBps:
      round(
        spreadBps,
        3
      ),

    spreadPercent:
      round(
        spreadBps /
          100,
        4
      ),

    levelsAnalyzed: {
      bids:
        bidLevels.length,

      asks:
        askLevels.length,
    },

    liquidity: {
      bidLiquidityUsd:
        round(
          totalBidLiquidityUsd,
          2
        ),

      askLiquidityUsd:
        round(
          totalAskLiquidityUsd,
          2
        ),

      totalLiquidityUsd:
        round(
          totalLiquidityUsd,
          2
        ),

      imbalancePercent:
        round(
          overallImbalancePercent,
          2
        ),
    },

    wallDetection: {
      method:
        "relative-to-current-book",

      medianLevelUsd:
        round(
          medianLevelUsd,
          2
        ),

      averageLevelUsd:
        round(
          averageLevelUsd,
          2
        ),

      wallThresholdUsd:
        round(
          wallThresholdUsd,
          2
        ),

      majorBuyWallCount:
        majorBuyWalls.length,

      majorSellWallCount:
        majorSellWalls.length,
    },

    largestBuyWall:
      formatBookLevel(
        largestBuyWall,
        decimals
      ),

    largestSellWall:
      formatBookLevel(
        largestSellWall,
        decimals
      ),

    nearestMajorBuyWall:
      formatBookLevel(
        nearestMajorBuyWall,
        decimals
      ),

    nearestMajorSellWall:
      formatBookLevel(
        nearestMajorSellWall,
        decimals
      ),

    topBuyWalls:
      topBuyWalls.map(
        (level) =>
          formatBookLevel(
            level,
            decimals
          )
      ),

    topSellWalls:
      topSellWalls.map(
        (level) =>
          formatBookLevel(
            level,
            decimals
          )
      ),

    bidWallConcentrationPercent:
      round(
        bidWallConcentrationPercent,
        2
      ),

    askWallConcentrationPercent:
      round(
        askWallConcentrationPercent,
        2
      ),

    depth: {
      percent010:
        depth010,

      percent025:
        depth025,

      percent050:
        depth050,

      percent100:
        depth100,
    },

    confirmations:
      uniqueStrings(
        confirmations
      ),

    risks:
      uniqueStrings(
        risks
      ),

    note:
      "This module analyzes one order-book snapshot. A single snapshot cannot prove spoofing or wall persistence.",
  };
}

/* =========================================================
   EXECUTED TRADE CONVERSION
   ========================================================= */

function convertExecutedTrades(
  trades: TradeData[],
  contractValue: number,
  contractMultiplier: number
): ExecutedTrade[] {
  return trades
    .map(
      (trade) => {
        const side =
          trade.side ===
            "buy" ||
          trade.side ===
            "sell"
            ? trade.side
            : null;

        if (!side) {
          return null;
        }

        const price =
          safeNumber(
            trade.px
          );

        const contracts =
          safeNumber(
            trade.sz
          );

        const baseQuantity =
          getContractBaseQuantity(
            contracts,
            contractValue,
            contractMultiplier
          );

        const notionalUsd =
          price *
          baseQuantity;

        if (
          price <= 0 ||
          contracts <= 0 ||
          notionalUsd <= 0
        ) {
          return null;
        }

        return {
          tradeId:
            trade.tradeId ??
            "",

          side,

          price,

          contracts,

          baseQuantity,

          notionalUsd,

          timestamp:
            safeNumber(
              trade.ts
            ),
        };
      }
    )
    .filter(
      (
        trade
      ): trade is ExecutedTrade =>
        trade !== null
    );
}

/* =========================================================
   LARGE TRADE FORMATTER
   ========================================================= */

function formatTrade(
  trade:
    | ExecutedTrade
    | null,
  decimals: number
) {
  if (!trade) {
    return null;
  }

  return {
    tradeId:
      trade.tradeId,

    side:
      trade.side,

    price:
      round(
        trade.price,
        decimals
      ),

    contracts:
      round(
        trade.contracts,
        4
      ),

    baseQuantity:
      round(
        trade.baseQuantity,
        8
      ),

    notionalUsd:
      round(
        trade.notionalUsd,
        2
      ),

    timestamp:
      trade.timestamp,
  };
}

/* =========================================================
   LARGE TRADE INTELLIGENCE
   ========================================================= */

function calculateLargeTradeIntelligence({
  trades,
  contractValue,
  contractMultiplier,
  markPrice,
}: {
  trades: TradeData[];
  contractValue: number;
  contractMultiplier: number;
  markPrice: number;
}) {
  const decimals =
    priceDecimals(
      markPrice
    );

  const executedTrades =
    convertExecutedTrades(
      trades,
      contractValue,
      contractMultiplier
    );

  if (
    executedTrades.length ===
    0
  ) {
    return {
      available: false,

      bias:
        "NEUTRAL" as LargeTradeBias,

      score: 0,

      thresholdUsd: 0,

      tradesAnalyzed: 0,

      largeBuyCount: 0,
      largeSellCount: 0,

      largeBuyNotionalUsd: 0,
      largeSellNotionalUsd: 0,

      largeTradeBuySellRatio:
        1,

      largestBuyTrade:
        null,

      largestSellTrade:
        null,

      topLargeBuys: [],

      topLargeSells: [],

      confirmations: [],

      risks: [
        "Recent executed trade data is unavailable.",
      ],

      note:
        "Large-trade intelligence uses actual recent OKX perpetual trades when available.",
    };
  }

  const notionals =
    executedTrades.map(
      (trade) =>
        trade.notionalUsd
    );

  const medianNotional =
    median(
      notionals
    );

  const averageNotional =
    average(
      notionals
    );

  const sortedNotionals = [
    ...notionals,
  ].sort(
    (a, b) =>
      a - b
  );

  const percentileIndex =
    Math.min(
      sortedNotionals.length -
        1,
      Math.floor(
        sortedNotionals.length *
          0.9
      )
    );

  const percentile90 =
    sortedNotionals[
      percentileIndex
    ] || 0;

  /*
   * Adaptive threshold.
   *
   * We use the strongest of:
   * - 90th percentile
   * - 3x median
   * - 1.5x average
   *
   * Therefore "large" adapts to
   * BTC, ETH and smaller coins.
   */

  const thresholdUsd =
    Math.max(
      percentile90,
      medianNotional *
        3,
      averageNotional *
        1.5
    );

  const largeTrades =
    executedTrades.filter(
      (trade) =>
        trade.notionalUsd >=
        thresholdUsd
    );

  const largeBuys =
    largeTrades
      .filter(
        (trade) =>
          trade.side ===
          "buy"
      )
      .sort(
        (a, b) =>
          b.notionalUsd -
          a.notionalUsd
      );

  const largeSells =
    largeTrades
      .filter(
        (trade) =>
          trade.side ===
          "sell"
      )
      .sort(
        (a, b) =>
          b.notionalUsd -
          a.notionalUsd
      );

  const largeBuyNotionalUsd =
    largeBuys.reduce(
      (
        total,
        trade
      ) =>
        total +
        trade.notionalUsd,
      0
    );

  const largeSellNotionalUsd =
    largeSells.reduce(
      (
        total,
        trade
      ) =>
        total +
        trade.notionalUsd,
      0
    );

  const largeTradeBuySellRatio =
    largeSellNotionalUsd > 0
      ? largeBuyNotionalUsd /
        largeSellNotionalUsd
      : largeBuyNotionalUsd > 0
        ? 2
        : 1;

  const largestBuyTrade =
    largeBuys[0] ??
    null;

  const largestSellTrade =
    largeSells[0] ??
    null;

  const totalLargeNotional =
    largeBuyNotionalUsd +
    largeSellNotionalUsd;

  const largeBuySharePercent =
    totalLargeNotional > 0
      ? (
          largeBuyNotionalUsd /
          totalLargeNotional
        ) *
        100
      : 50;

  const largeSellSharePercent =
    totalLargeNotional > 0
      ? (
          largeSellNotionalUsd /
          totalLargeNotional
        ) *
        100
      : 50;

  let score = 0;

  const confirmations:
    string[] = [];

  const risks:
    string[] = [];

  if (
    largeTradeBuySellRatio >=
    2
  ) {
    score += 35;

    confirmations.push(
      "Large aggressive buy notional is at least twice large aggressive sell notional."
    );
  } else if (
    largeTradeBuySellRatio >=
    1.4
  ) {
    score += 20;

    confirmations.push(
      "Large executed trades favor aggressive buyers."
    );
  } else if (
    largeTradeBuySellRatio <=
    0.5
  ) {
    score -= 35;

    confirmations.push(
      "Large aggressive sell notional is at least twice large aggressive buy notional."
    );
  } else if (
    largeTradeBuySellRatio <=
    0.71
  ) {
    score -= 20;

    confirmations.push(
      "Large executed trades favor aggressive sellers."
    );
  }

  if (
    largeBuySharePercent >=
    70
  ) {
    score += 15;

    confirmations.push(
      "At least 70% of large-trade notional is buyer initiated."
    );
  }

  if (
    largeSellSharePercent >=
    70
  ) {
    score -= 15;

    confirmations.push(
      "At least 70% of large-trade notional is seller initiated."
    );
  }

  if (
    largeTrades.length <
    3
  ) {
    risks.push(
      "Only a small number of trades crossed the adaptive large-trade threshold."
    );
  }

  if (
    executedTrades.length <
    100
  ) {
    risks.push(
      "Recent trade sample is smaller than expected, so large-trade evidence is less reliable."
    );
  }

  score =
    clamp(
      score,
      -100,
      100
    );

  let bias:
    LargeTradeBias =
    "NEUTRAL";

  if (
    score >= 20
  ) {
    bias =
      "BULLISH";
  } else if (
    score <= -20
  ) {
    bias =
      "BEARISH";
  }

  return {
    available: true,

    bias,

    score:
      round(
        score,
        1
      ),

    method:
      "adaptive-relative-threshold",

    tradesAnalyzed:
      executedTrades.length,

    medianTradeNotionalUsd:
      round(
        medianNotional,
        2
      ),

    averageTradeNotionalUsd:
      round(
        averageNotional,
        2
      ),

    percentile90NotionalUsd:
      round(
        percentile90,
        2
      ),

    thresholdUsd:
      round(
        thresholdUsd,
        2
      ),

    largeTradeCount:
      largeTrades.length,

    largeBuyCount:
      largeBuys.length,

    largeSellCount:
      largeSells.length,

    largeBuyNotionalUsd:
      round(
        largeBuyNotionalUsd,
        2
      ),

    largeSellNotionalUsd:
      round(
        largeSellNotionalUsd,
        2
      ),

    largeTradeBuySellRatio:
      round(
        largeTradeBuySellRatio,
        3
      ),

    largeBuySharePercent:
      round(
        largeBuySharePercent,
        2
      ),

    largeSellSharePercent:
      round(
        largeSellSharePercent,
        2
      ),

    largestBuyTrade:
      formatTrade(
        largestBuyTrade,
        decimals
      ),

    largestSellTrade:
      formatTrade(
        largestSellTrade,
        decimals
      ),

    topLargeBuys:
      largeBuys
        .slice(
          0,
          5
        )
        .map(
          (trade) =>
            formatTrade(
              trade,
              decimals
            )
        ),

    topLargeSells:
      largeSells
        .slice(
          0,
          5
        )
        .map(
          (trade) =>
            formatTrade(
              trade,
              decimals
            )
        ),

    confirmations:
      uniqueStrings(
        confirmations
      ),

    risks:
      uniqueStrings(
        risks
      ),

    note:
      "Trade side comes from actual OKX recent perpetual trades. Large-trade classification is relative to the current trade sample.",
  };
}

/* =========================================================
   API
   ========================================================= */

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

    const okxSymbol =
      toOkxSwapSymbol(
        symbol
      );

    const indexSymbol =
      toOkxIndexSymbol(
        symbol
      );

    /*
     * Required OKX public data.
     */

    const markPricePath =
      `/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(
        okxSymbol
      )}`;

    const openInterestPath =
      `/api/v5/public/open-interest?instType=SWAP&instId=${encodeURIComponent(
        okxSymbol
      )}`;

    const orderBookPath =
      `/api/v5/market/books?instId=${encodeURIComponent(
        okxSymbol
      )}&sz=50`;

    const instrumentPath =
      `/api/v5/public/instruments?instType=SWAP&instId=${encodeURIComponent(
        okxSymbol
      )}`;

    /*
     * Optional data.
     */

    const fundingPath =
      `/api/v5/public/funding-rate?instId=${encodeURIComponent(
        okxSymbol
      )}`;

    const indexPath =
      `/api/v5/market/index-tickers?instId=${encodeURIComponent(
        indexSymbol
      )}`;

    const tradesPath =
      `/api/v5/market/trades?instId=${encodeURIComponent(
        okxSymbol
      )}&limit=500`;

    const [
      markResponse,
      openInterestResponse,
      bookResponse,
      instrumentResponse,
      fundingResponse,
      indexResponse,
      tradesResponse,
    ] =
      await Promise.all([
        fetchOkx<MarkPriceData>(
          markPricePath
        ),

        fetchOkx<OpenInterestData>(
          openInterestPath
        ),

        fetchOkx<BookData>(
          orderBookPath
        ),

        fetchOkx<InstrumentData>(
          instrumentPath
        ),

        optionalFetch<FundingData>(
          fundingPath
        ),

        optionalFetch<IndexTickerData>(
          indexPath
        ),

        optionalFetch<TradeData>(
          tradesPath
        ),
      ]);

    const markData =
      markResponse.data[0];

    const oiData =
      openInterestResponse
        .data[0];

    const bookData =
      bookResponse.data[0];

    const instrument =
      instrumentResponse
        .data[0];

    if (
      !markData ||
      !oiData ||
      !bookData ||
      !instrument
    ) {
      throw new Error(
        `OKX derivatives market ${okxSymbol} is unavailable or unsupported.`
      );
    }

    if (
      instrument.state &&
      instrument.state !==
        "live"
    ) {
      throw new Error(
        `OKX derivatives market ${okxSymbol} is not currently live.`
      );
    }

    /*
     * Contract specification.
     */

    const contractValue =
      safeNumber(
        instrument.ctVal,
        1
      );

    const contractMultiplier =
      safeNumber(
        instrument.ctMult,
        1
      );

    /*
     * Prices.
     */

    const markPrice =
      safeNumber(
        markData.markPx
      );

    const indexData =
      indexResponse
        ?.data?.[0] ??
      null;

    const indexPrice =
      indexData
        ? safeNumber(
            indexData.idxPx,
            markPrice
          )
        : markPrice;

    const basisPercent =
      indexPrice > 0
        ? (
            (
              markPrice -
              indexPrice
            ) /
            indexPrice
          ) *
          100
        : 0;

    /*
     * Funding.
     */

    const fundingData =
      fundingResponse
        ?.data?.[0] ??
      null;

    const fundingRate =
      fundingData
        ? safeNumber(
            fundingData
              .fundingRate
          )
        : 0;

    const fundingPercent =
      fundingRate *
      100;

    const nextFundingTime =
      fundingData
        ? safeNumber(
            fundingData
              .nextFundingTime
          )
        : 0;

    /*
     * Open interest.
     */

    const openInterestContracts =
      safeNumber(
        oiData.oi
      );

    const openInterestBase =
      safeNumber(
        oiData.oiCcy
      );

    let openInterestNotional =
      safeNumber(
        oiData.oiUsd
      );

    if (
      openInterestNotional <=
        0 &&
      openInterestBase > 0
    ) {
      openInterestNotional =
        openInterestBase *
        markPrice;
    }

    if (
      openInterestNotional <=
      0
    ) {
      const baseQuantity =
        getContractBaseQuantity(
          openInterestContracts,
          contractValue,
          contractMultiplier
        );

      openInterestNotional =
        baseQuantity *
        markPrice;
    }

    /*
     * No fabricated historical OI.
     */

    const openInterestChangePercent =
      0;

    /*
     * Order book.
     */

    const bids =
      Array.isArray(
        bookData.bids
      )
        ? bookData.bids
        : [];

    const asks =
      Array.isArray(
        bookData.asks
      )
        ? bookData.asks
        : [];

    const bestBid =
      bids.length > 0
        ? safeNumber(
            bids[0][0]
          )
        : 0;

    const bestAsk =
      asks.length > 0
        ? safeNumber(
            asks[0][0]
          )
        : 0;

    const spread =
      bestAsk > 0 &&
      bestBid > 0
        ? bestAsk -
          bestBid
        : 0;

    const midpoint =
      bestAsk > 0 &&
      bestBid > 0
        ? (
            bestAsk +
            bestBid
          ) /
          2
        : markPrice;

    const spreadBps =
      midpoint > 0
        ? (
            spread /
            midpoint
          ) *
          10000
        : 0;

    const bidLiquidityUsd =
      calculateBookLiquidity(
        bids,
        contractValue,
        contractMultiplier
      );

    const askLiquidityUsd =
      calculateBookLiquidity(
        asks,
        contractValue,
        contractMultiplier
      );

    const totalBookLiquidity =
      bidLiquidityUsd +
      askLiquidityUsd;

    const imbalancePercent =
      totalBookLiquidity > 0
        ? (
            (
              bidLiquidityUsd -
              askLiquidityUsd
            ) /
            totalBookLiquidity
          ) *
          100
        : 0;

    /*
     * Recent actual OKX trades.
     */

    const trades =
      tradesResponse
        ?.data ??
      [];

    const tradeFlow =
      calculateTradeFlow(
        trades,
        contractValue,
        contractMultiplier
      );

    const takerBuySellRatio =
      tradeFlow
        .buySellRatio;

    const takerBuyVolume =
      tradeFlow
        .buyVolume;

    const takerSellVolume =
      tradeFlow
        .sellVolume;

    /*
     * =====================================================
     * NEW: ADVANCED ORDER BOOK
     * =====================================================
     */

    const orderBookIntelligence =
      calculateOrderBookIntelligence({
        bids,
        asks,
        midpoint,
        spread,
        spreadBps,
        contractValue,
        contractMultiplier,
      });

    /*
     * =====================================================
     * NEW: LARGE EXECUTED TRADES
     * =====================================================
     */

    const largeTradeIntelligence =
      calculateLargeTradeIntelligence({
        trades,
        contractValue,
        contractMultiplier,
        markPrice,
      });

    /*
     * Compatibility positioning.
     *
     * We do not fabricate unavailable
     * global long/short positioning.
     */

    const longShortRatio =
      1;

    const longAccountsPercent =
      50;

    const shortAccountsPercent =
      50;

    /*
     * =====================================================
     * EXISTING DERIVATIVES SCORE
     * =====================================================
     *
     * IMPORTANT:
     * orderBookIntelligence.score and
     * largeTradeIntelligence.score are
     * NOT added here yet.
     */

    let score = 0;

    const bullishReasons:
      string[] = [];

    const bearishReasons:
      string[] = [];

    const risks:
      string[] = [];

    /*
     * Basic order-book imbalance.
     */

    if (
      imbalancePercent >=
      20
    ) {
      score += 20;

      bullishReasons.push(
        "Perpetual order book is strongly bid-heavy."
      );
    } else if (
      imbalancePercent >=
      7
    ) {
      score += 10;

      bullishReasons.push(
        "Perpetual order book is moderately bid-heavy."
      );
    } else if (
      imbalancePercent <=
      -20
    ) {
      score -= 20;

      bearishReasons.push(
        "Perpetual order book is strongly ask-heavy."
      );
    } else if (
      imbalancePercent <=
      -7
    ) {
      score -= 10;

      bearishReasons.push(
        "Perpetual order book is moderately ask-heavy."
      );
    }

    /*
     * Existing aggressive taker flow.
     */

    if (
      trades.length > 0
    ) {
      if (
        takerBuySellRatio >=
        1.3
      ) {
        score += 20;

        bullishReasons.push(
          "Recent aggressive taker buying is significantly stronger than taker selling."
        );
      } else if (
        takerBuySellRatio >=
        1.08
      ) {
        score += 10;

        bullishReasons.push(
          "Recent aggressive taker buying is stronger than taker selling."
        );
      } else if (
        takerBuySellRatio <=
        0.7
      ) {
        score -= 20;

        bearishReasons.push(
          "Recent aggressive taker selling is significantly stronger than taker buying."
        );
      } else if (
        takerBuySellRatio <=
        0.92
      ) {
        score -= 10;

        bearishReasons.push(
          "Recent aggressive taker selling is stronger than taker buying."
        );
      }
    }

    /*
     * Funding crowding.
     */

    if (
      fundingData
    ) {
      if (
        fundingPercent >=
        0.05
      ) {
        score -= 10;

        risks.push(
          "Funding is strongly positive, suggesting crowded long positioning."
        );
      } else if (
        fundingPercent >=
        0.03
      ) {
        score -= 5;

        risks.push(
          "Funding is elevated and long positioning may be crowded."
        );
      }

      if (
        fundingPercent <=
        -0.05
      ) {
        score += 10;

        risks.push(
          "Funding is strongly negative, suggesting crowded short positioning and squeeze risk."
        );
      } else if (
        fundingPercent <=
        -0.03
      ) {
        score += 5;

        risks.push(
          "Funding is negative and short positioning may be crowded."
        );
      }
    }

    /*
     * Basis.
     */

    if (
      indexData
    ) {
      if (
        basisPercent >=
        0.15
      ) {
        score += 5;

        bullishReasons.push(
          "Perpetual mark price is trading above the underlying index."
        );
      }

      if (
        basisPercent <=
        -0.15
      ) {
        score -= 5;

        bearishReasons.push(
          "Perpetual mark price is trading below the underlying index."
        );
      }
    }

    /*
     * Data-quality risks.
     */

    if (
      openInterestNotional <=
      0
    ) {
      risks.push(
        "Open-interest notional is currently unavailable."
      );
    }

    if (
      !fundingData
    ) {
      risks.push(
        "Funding-rate data is temporarily unavailable."
      );
    }

    if (
      !indexData
    ) {
      risks.push(
        "Index-price data is temporarily unavailable, so basis scoring was skipped."
      );
    }

    if (
      trades.length ===
      0
    ) {
      risks.push(
        "Recent taker-flow data is temporarily unavailable."
      );
    }

    score =
      clamp(
        score,
        -100,
        100
      );

    let bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL" =
      "NEUTRAL";

    if (
      score >= 20
    ) {
      bias =
        "BULLISH";
    } else if (
      score <= -20
    ) {
      bias =
        "BEARISH";
    }

    /*
     * Existing heuristic confidence.
     */

    let confidence =
      48 +
      Math.abs(
        score
      ) *
        0.5;

    let missingOptional =
      0;

    if (
      !fundingData
    ) {
      missingOptional +=
        1;
    }

    if (
      !indexData
    ) {
      missingOptional +=
        1;
    }

    if (
      trades.length ===
      0
    ) {
      missingOptional +=
        1;
    }

    confidence -=
      missingOptional *
      4;

    confidence =
      clamp(
        confidence,
        40,
        88
      );

    const combinedReasons = [
      ...bullishReasons,
      ...bearishReasons,
    ];

    const decimals =
      priceDecimals(
        markPrice
      );

    return NextResponse.json({
      success: true,

      version:
        "derivatives-v2-orderbook-large-trades",

      symbol,

      providerSymbol:
        okxSymbol,

      bias,

      derivativesScore:
        round(
          score,
          1
        ),

      confidence:
        round(
          confidence,
          1
        ),

      confidenceType:
        "heuristic",

      funding: {
        rate:
          round(
            fundingRate,
            8
          ),

        percent:
          round(
            fundingPercent,
            5
          ),

        nextFundingTime,
      },

      prices: {
        markPrice:
          round(
            markPrice,
            decimals
          ),

        indexPrice:
          round(
            indexPrice,
            decimals
          ),

        basisPercent:
          round(
            basisPercent,
            4
          ),
      },

      /*
       * Compatibility top-level fields.
       */

      markPrice:
        round(
          markPrice,
          decimals
        ),

      indexPrice:
        round(
          indexPrice,
          decimals
        ),

      basisPercent:
        round(
          basisPercent,
          4
        ),

      openInterest: {
        contracts:
          round(
            openInterestContracts,
            4
          ),

        baseCurrency:
          round(
            openInterestBase,
            4
          ),

        notionalUsd:
          round(
            openInterestNotional,
            2
          ),

        changeApprox1hPercent:
          round(
            openInterestChangePercent,
            2
          ),

        changePercent:
          round(
            openInterestChangePercent,
            2
          ),

        historyAvailable:
          false,

        note:
          "Current OI is real. Historical OI change is not inferred without stored snapshots.",
      },

      /*
       * Existing orderBook object preserved.
       */

      orderBook: {
        bestBid:
          round(
            bestBid,
            decimals
          ),

        bestAsk:
          round(
            bestAsk,
            decimals
          ),

        midpoint:
          round(
            midpoint,
            decimals
          ),

        spread:
          round(
            spread,
            decimals
          ),

        spreadBps:
          round(
            spreadBps,
            3
          ),

        bidLiquidityUsd:
          round(
            bidLiquidityUsd,
            2
          ),

        askLiquidityUsd:
          round(
            askLiquidityUsd,
            2
          ),

        imbalancePercent:
          round(
            imbalancePercent,
            2
          ),
      },

      /*
       * =====================================================
       * NEW
       * =====================================================
       */

      orderBookIntelligence,

      /*
       * Existing takerFlow preserved.
       */

      takerFlow: {
        buySellRatio:
          round(
            takerBuySellRatio,
            3
          ),

        buyVolume:
          round(
            takerBuyVolume,
            4
          ),

        sellVolume:
          round(
            takerSellVolume,
            4
          ),

        buyNotionalUsd:
          round(
            tradeFlow
              .buyNotional,
            2
          ),

        sellNotionalUsd:
          round(
            tradeFlow
              .sellNotional,
            2
          ),

        tradesAnalyzed:
          trades.length,
      },

      /*
       * =====================================================
       * NEW
       * =====================================================
       */

      largeTradeIntelligence,

      positioning: {
        longShortRatio:
          round(
            longShortRatio,
            3
          ),

        longAccountsPercent:
          round(
            longAccountsPercent,
            2
          ),

        shortAccountsPercent:
          round(
            shortAccountsPercent,
            2
          ),

        longAccountPercent:
          round(
            longAccountsPercent,
            2
          ),

        shortAccountPercent:
          round(
            shortAccountsPercent,
            2
          ),

        available:
          false,

        note:
          "Global long/short account positioning is not inferred from unavailable data.",
      },

      bullishReasons,

      bearishReasons,

      reasons:
        combinedReasons,

      risks,

      /*
       * Explicit module status.
       */

      modules: {
        derivatives:
          true,

        basicOrderBook:
          true,

        advancedOrderBookIntelligence:
          true,

        takerFlow:
          trades.length > 0,

        largeTradeIntelligence:
          trades.length > 0,

        openInterestHistory:
          false,

        newIntelligenceIntegratedIntoDerivativesScore:
          false,
      },

      dataAvailability: {
        premiumIndex:
          Boolean(
            markData &&
            indexData
          ),

        markPrice:
          true,

        indexPrice:
          Boolean(
            indexData
          ),

        funding:
          Boolean(
            fundingData
          ),

        openInterest:
          true,

        orderBook:
          true,

        orderBookLevels:
          bids.length +
          asks.length,

        openInterestHistory:
          false,

        takerFlow:
          trades.length > 0,

        largeTrades:
          trades.length > 0,

        positioning:
          false,
      },

      contract: {
        instId:
          okxSymbol,

        ctVal:
          contractValue,

        ctMult:
          contractMultiplier,

        ctValCcy:
          instrument
            .ctValCcy ??
          "",

        settleCcy:
          instrument
            .settleCcy ??
          "",
      },

      source:
        "OKX USDT Perpetual Swap",

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "Derivatives analysis error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate derivatives analysis.",

        source:
          "OKX USDT Perpetual Swap",
      },
      {
        status: 500,
      }
    );
  }
}