import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUTURES_BASE =
  "https://fapi.binance.com";

type PremiumIndexResponse = {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
  time: number;
};

type OpenInterestResponse = {
  openInterest: string;
  symbol: string;
  time: number;
};

type DepthResponse = {
  lastUpdateId: number;
  E?: number;
  T?: number;

  bids: [
    string,
    string
  ][];

  asks: [
    string,
    string
  ][];
};

type OpenInterestHistory = {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}[];

type TakerRatioHistory = {
  buySellRatio: string;
  buyVol: string;
  sellVol: string;
  timestamp: number;
}[];

type PositioningHistory = {
  symbol: string;
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
  timestamp: number;
}[];

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
      value *
        factor
    ) /
    factor
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

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response =
    await fetch(
      url,
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
    let message =
      `Binance Futures request failed: ${response.status}`;

    try {
      const body =
        await response.json();

      if (
        body &&
        typeof body.msg ===
          "string"
      ) {
        message =
          body.msg;
      }
    } catch {
      // Ignore parsing failure.
    }

    throw new Error(
      message
    );
  }

  return (
    await response.json()
  ) as T;
}

async function optionalFetch<T>(
  url: string
): Promise<T | null> {
  try {
    return await fetchJson<T>(
      url
    );
  } catch (
    error
  ) {
    console.warn(
      "Optional futures request failed:",
      url,
      error
    );

    return null;
  }
}

function calculateLiquidity(
  levels: [
    string,
    string
  ][]
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

      const quantity =
        safeNumber(
          level[1]
        );

      return (
        total +
        price *
          quantity
      );
    },
    0
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;

    /*
     * No 5-coin restriction.
     *
     * DOGEUSDT, ADAUSDT,
     * LINKUSDT, SUIUSDT etc.
     * can pass directly.
     */

    const symbol =
      normalizeTradingSymbol(
        searchParams.get(
          "symbol"
        ),
        "BTCUSDT"
      );

    /*
     * Required endpoints.
     */

    const premiumUrl =
      `${FUTURES_BASE}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(
        symbol
      )}`;

    const openInterestUrl =
      `${FUTURES_BASE}/fapi/v1/openInterest?symbol=${encodeURIComponent(
        symbol
      )}`;

    const depthUrl =
      `${FUTURES_BASE}/fapi/v1/depth?symbol=${encodeURIComponent(
        symbol
      )}&limit=50`;

    /*
     * Optional historical/
     * positioning endpoints.
     *
     * If one endpoint is
     * temporarily unavailable,
     * the entire signal should
     * not fail.
     */

    const openInterestHistoryUrl =
      `${FUTURES_BASE}/futures/data/openInterestHist?symbol=${encodeURIComponent(
        symbol
      )}&period=5m&limit=13`;

    const takerRatioUrl =
      `${FUTURES_BASE}/futures/data/takerlongshortRatio?symbol=${encodeURIComponent(
        symbol
      )}&period=5m&limit=1`;

    const positioningUrl =
      `${FUTURES_BASE}/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(
        symbol
      )}&period=5m&limit=1`;

    const [
      premium,
      openInterest,
      depth,
      openInterestHistory,
      takerHistory,
      positioningHistory,
    ] =
      await Promise.all([
        fetchJson<PremiumIndexResponse>(
          premiumUrl
        ),

        fetchJson<OpenInterestResponse>(
          openInterestUrl
        ),

        fetchJson<DepthResponse>(
          depthUrl
        ),

        optionalFetch<OpenInterestHistory>(
          openInterestHistoryUrl
        ),

        optionalFetch<TakerRatioHistory>(
          takerRatioUrl
        ),

        optionalFetch<PositioningHistory>(
          positioningUrl
        ),
      ]);

    /*
     * Safety check.
     */

    if (
      premium.symbol !==
      symbol
    ) {
      throw new Error(
        `Derivatives symbol mismatch. Requested ${symbol}, received ${premium.symbol}.`
      );
    }

    /*
     * Prices
     */

    const markPrice =
      safeNumber(
        premium.markPrice
      );

    const indexPrice =
      safeNumber(
        premium.indexPrice
      );

    const basisPercent =
      indexPrice >
      0
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
     * Funding
     */

    const fundingRate =
      safeNumber(
        premium.lastFundingRate
      );

    const fundingPercent =
      fundingRate *
      100;

    /*
     * Open interest
     */

    const openInterestContracts =
      safeNumber(
        openInterest.openInterest
      );

    let openInterestNotional =
      openInterestContracts *
      markPrice;

    let openInterestChangePercent =
      0;

    if (
      openInterestHistory &&
      openInterestHistory.length >=
        2
    ) {
      const first =
        openInterestHistory[0];

      const last =
        openInterestHistory[
          openInterestHistory.length -
            1
        ];

      const firstValue =
        safeNumber(
          first.sumOpenInterestValue
        );

      const lastValue =
        safeNumber(
          last.sumOpenInterestValue
        );

      if (
        lastValue >
        0
      ) {
        openInterestNotional =
          lastValue;
      }

      if (
        firstValue >
        0
      ) {
        openInterestChangePercent =
          (
            (
              lastValue -
              firstValue
            ) /
            firstValue
          ) *
          100;
      }
    }

    /*
     * Order book
     */

    const bestBid =
      depth.bids.length >
      0
        ? safeNumber(
            depth.bids[0][0]
          )
        : 0;

    const bestAsk =
      depth.asks.length >
      0
        ? safeNumber(
            depth.asks[0][0]
          )
        : 0;

    const spread =
      bestAsk >
        0 &&
      bestBid >
        0
        ? bestAsk -
          bestBid
        : 0;

    const midpoint =
      bestAsk >
        0 &&
      bestBid >
        0
        ? (
            bestAsk +
            bestBid
          ) /
          2
        : 0;

    const spreadBps =
      midpoint >
      0
        ? (
            spread /
            midpoint
          ) *
          10000
        : 0;

    const bidLiquidityUsd =
      calculateLiquidity(
        depth.bids
      );

    const askLiquidityUsd =
      calculateLiquidity(
        depth.asks
      );

    const totalBookLiquidity =
      bidLiquidityUsd +
      askLiquidityUsd;

    const imbalancePercent =
      totalBookLiquidity >
      0
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
     * Aggressive taker flow
     */

    const latestTaker =
      takerHistory &&
      takerHistory.length >
        0
        ? takerHistory[
            takerHistory.length -
              1
          ]
        : null;

    const takerBuySellRatio =
      latestTaker
        ? safeNumber(
            latestTaker.buySellRatio,
            1
          )
        : 1;

    const takerBuyVolume =
      latestTaker
        ? safeNumber(
            latestTaker.buyVol
          )
        : 0;

    const takerSellVolume =
      latestTaker
        ? safeNumber(
            latestTaker.sellVol
          )
        : 0;

    /*
     * Global long/short
     * positioning.
     */

    const latestPositioning =
      positioningHistory &&
      positioningHistory.length >
        0
        ? positioningHistory[
            positioningHistory.length -
              1
          ]
        : null;

    const longShortRatio =
      latestPositioning
        ? safeNumber(
            latestPositioning.longShortRatio,
            1
          )
        : 1;

    const longAccountsPercent =
      latestPositioning
        ? safeNumber(
            latestPositioning.longAccount
          ) *
          100
        : 50;

    const shortAccountsPercent =
      latestPositioning
        ? safeNumber(
            latestPositioning.shortAccount
          ) *
          100
        : 50;

    /*
     * Derivatives scoring.
     */

    let score =
      0;

    const bullishReasons:
      string[] = [];

    const bearishReasons:
      string[] = [];

    const risks:
      string[] = [];

    /*
     * Order-book imbalance.
     */

    if (
      imbalancePercent >=
      20
    ) {
      score +=
        20;

      bullishReasons.push(
        "Futures order book is strongly bid-heavy."
      );
    } else if (
      imbalancePercent >=
      7
    ) {
      score +=
        10;

      bullishReasons.push(
        "Futures order book is moderately bid-heavy."
      );
    } else if (
      imbalancePercent <=
      -20
    ) {
      score -=
        20;

      bearishReasons.push(
        "Futures order book is strongly ask-heavy."
      );
    } else if (
      imbalancePercent <=
      -7
    ) {
      score -=
        10;

      bearishReasons.push(
        "Futures order book is moderately ask-heavy."
      );
    }

    /*
     * Aggressive taker flow.
     */

    if (
      takerBuySellRatio >=
      1.3
    ) {
      score +=
        20;

      bullishReasons.push(
        "Aggressive taker buying is significantly stronger than taker selling."
      );
    } else if (
      takerBuySellRatio >=
      1.08
    ) {
      score +=
        10;

      bullishReasons.push(
        "Aggressive taker buying is stronger than taker selling."
      );
    } else if (
      takerBuySellRatio <=
      0.7
    ) {
      score -=
        20;

      bearishReasons.push(
        "Aggressive taker selling is significantly stronger than taker buying."
      );
    } else if (
      takerBuySellRatio <=
      0.92
    ) {
      score -=
        10;

      bearishReasons.push(
        "Aggressive taker selling is stronger than taker buying."
      );
    }

    /*
     * Funding.
     *
     * Extremely positive funding
     * can indicate crowded longs.
     *
     * Extremely negative funding
     * can indicate crowded shorts.
     */

    if (
      fundingPercent >=
      0.05
    ) {
      score -=
        10;

      risks.push(
        "Funding is strongly positive, suggesting crowded long positioning."
      );
    } else if (
      fundingPercent >=
      0.03
    ) {
      score -=
        5;

      risks.push(
        "Funding is elevated and long positioning may be crowded."
      );
    }

    if (
      fundingPercent <=
      -0.05
    ) {
      score +=
        10;

      risks.push(
        "Funding is strongly negative, suggesting crowded short positioning and squeeze risk."
      );
    } else if (
      fundingPercent <=
      -0.03
    ) {
      score +=
        5;

      risks.push(
        "Funding is negative and short positioning may be crowded."
      );
    }

    /*
     * Global positioning.
     *
     * Treat extreme positioning
     * mainly as a risk signal,
     * not proof of direction.
     */

    if (
      longShortRatio >=
      2
    ) {
      score -=
        5;

      risks.push(
        "Trader positioning is heavily long, increasing long-squeeze risk."
      );
    }

    if (
      longShortRatio <=
      0.5
    ) {
      score +=
        5;

      risks.push(
        "Trader positioning is heavily short, increasing short-squeeze risk."
      );
    }

    /*
     * Futures basis.
     */

    if (
      basisPercent >=
      0.15
    ) {
      score +=
        5;

      bullishReasons.push(
        "Futures mark price is trading above the spot index."
      );
    }

    if (
      basisPercent <=
      -0.15
    ) {
      score -=
        5;

      bearishReasons.push(
        "Futures mark price is trading below the spot index."
      );
    }

    /*
     * Open interest is NOT
     * inherently bullish/bearish.
     */

    if (
      openInterestChangePercent >=
      5
    ) {
      risks.push(
        "Open interest is rising rapidly, indicating increased leverage and liquidation risk."
      );
    }

    if (
      openInterestChangePercent <=
      -5
    ) {
      risks.push(
        "Open interest is falling rapidly, suggesting leverage is being removed."
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
      score >=
      20
    ) {
      bias =
        "BULLISH";
    } else if (
      score <=
      -20
    ) {
      bias =
        "BEARISH";
    }

    /*
     * Heuristic confidence.
     */

    let confidence =
      48 +
      Math.abs(
        score
      ) *
        0.5;

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

    return NextResponse.json({
      success:
        true,

      symbol,

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

      /*
       * Funding
       */

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

        nextFundingTime:
          premium.nextFundingTime,
      },

      /*
       * Nested price object
       * retained for your older
       * signal/final routes.
       */

      prices: {
        markPrice:
          round(
            markPrice,
            markPrice <
              1
              ? 8
              : 4
          ),

        indexPrice:
          round(
            indexPrice,
            indexPrice <
              1
              ? 8
              : 4
          ),

        basisPercent:
          round(
            basisPercent,
            4
          ),
      },

      /*
       * Aliases for newer code.
       */

      markPrice:
        round(
          markPrice,
          markPrice <
            1
            ? 8
            : 4
        ),

      indexPrice:
        round(
          indexPrice,
          indexPrice <
            1
            ? 8
            : 4
        ),

      basisPercent:
        round(
          basisPercent,
          4
        ),

      /*
       * Open interest
       */

      openInterest: {
        contracts:
          round(
            openInterestContracts,
            4
          ),

        notionalUsd:
          round(
            openInterestNotional,
            2
          ),

        /*
         * Both names are
         * intentionally returned
         * for compatibility.
         */

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
      },

      /*
       * Order book
       */

      orderBook: {
        bestBid:
          round(
            bestBid,
            bestBid <
              1
              ? 8
              : 4
          ),

        bestAsk:
          round(
            bestAsk,
            bestAsk <
              1
              ? 8
              : 4
          ),

        spread:
          round(
            spread,
            8
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
       * Aggressive order flow
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
      },

      /*
       * Trader positioning
       */

      positioning: {
        longShortRatio:
          round(
            longShortRatio,
            3
          ),

        /*
         * Old field names
         */

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

        /*
         * New aliases
         */

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
      },

      /*
       * Reason arrays
       */

      bullishReasons,

      bearishReasons,

      reasons:
        combinedReasons,

      risks,

      dataAvailability: {
        premiumIndex:
          true,

        openInterest:
          true,

        orderBook:
          true,

        openInterestHistory:
          Boolean(
            openInterestHistory
          ),

        takerFlow:
          Boolean(
            takerHistory
          ),

        positioning:
          Boolean(
            positioningHistory
          ),
      },

      source:
        "Binance USD-M Futures",

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Derivatives analysis error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate derivatives analysis.",
      },
      {
        status:
          500,
      }
    );
  }
}