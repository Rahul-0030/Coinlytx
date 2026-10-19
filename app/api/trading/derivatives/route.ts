import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OKX_BASE = "https://openapi.okx.com";

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
  side?: "buy" | "sell" | string;
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

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
}

function round(
  value: number,
  decimals = 4
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
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
    Math.min(max, value)
  );
}

function toOkxSwapSymbol(
  symbol: string
) {
  const normalized =
    symbol.toUpperCase();

  if (
    !normalized.endsWith("USDT")
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
    normalized.endsWith("USDT")
      ? normalized.slice(0, -4)
      : normalized;

  return `${base}-USDT`;
}

async function fetchOkx<T>(
  path: string
): Promise<OkxResponse<T>> {
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

  if (!response.ok) {
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
        safeNumber(level[0]);

      const contracts =
        safeNumber(level[1]);

      const baseQuantity =
        getContractBaseQuantity(
          contracts,
          contractValue,
          contractMultiplier
        );

      return (
        total +
        price * baseQuantity
      );
    },
    0
  );
}

function calculateTradeFlow(
  trades: TradeData[],
  contractValue: number,
  contractMultiplier: number
) {
  let buyVolume = 0;
  let sellVolume = 0;

  let buyNotional = 0;
  let sellNotional = 0;

  for (const trade of trades) {
    const contracts =
      safeNumber(trade.sz);

    const price =
      safeNumber(trade.px);

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
      trade.side === "buy"
    ) {
      buyVolume +=
        baseQuantity;

      buyNotional +=
        notional;
    }

    if (
      trade.side === "sell"
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
     * Required OKX public
     * derivatives data.
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
     *
     * A temporary failure in one
     * of these should not crash
     * the entire derivatives
     * engine.
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
     * Mark + index price.
     */

    const markPrice =
      safeNumber(
        markData.markPx
      );

    const indexData =
      indexResponse?.data?.[0] ??
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
      fundingResponse?.data?.[0] ??
      null;

    const fundingRate =
      fundingData
        ? safeNumber(
            fundingData.fundingRate
          )
        : 0;

    const fundingPercent =
      fundingRate * 100;

    const nextFundingTime =
      fundingData
        ? safeNumber(
            fundingData.nextFundingTime
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
     * We do NOT fabricate a
     * historical OI change.
     *
     * Current OKX OI is real,
     * but this route does not
     * currently maintain an
     * hourly OI snapshot store.
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
        : 0;

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
     * Taker flow from recent
     * OKX public SWAP trades.
     */

    const trades =
      tradesResponse?.data ??
      [];

    const tradeFlow =
      calculateTradeFlow(
        trades,
        contractValue,
        contractMultiplier
      );

    const takerBuySellRatio =
      tradeFlow.buySellRatio;

    const takerBuyVolume =
      tradeFlow.buyVolume;

    const takerSellVolume =
      tradeFlow.sellVolume;

    /*
     * Binance previously supplied
     * a global long/short account
     * ratio.
     *
     * We deliberately DO NOT
     * manufacture this metric.
     *
     * Neutral compatibility values
     * are returned so existing
     * signal/final/dashboard code
     * continues working.
     */

    const longShortRatio =
      1;

    const longAccountsPercent =
      50;

    const shortAccountsPercent =
      50;

    /*
     * Derivatives scoring.
     */

    let score = 0;

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
     * Aggressive taker flow.
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

    if (fundingData) {
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

    if (indexData) {
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
     * OI level is useful, but
     * direction is not inferred
     * without historical data.
     */

    if (
      openInterestNotional <=
      0
    ) {
      risks.push(
        "Open-interest notional is currently unavailable."
      );
    }

    /*
     * Missing optional data should
     * reduce confidence rather than
     * create fake neutral evidence.
     */

    if (!fundingData) {
      risks.push(
        "Funding-rate data is temporarily unavailable."
      );
    }

    if (!indexData) {
      risks.push(
        "Index-price data is temporarily unavailable, so basis scoring was skipped."
      );
    }

    if (
      trades.length === 0
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
     *
     * This is NOT win probability.
     */

    let confidence =
      48 +
      Math.abs(score) *
        0.5;

    let missingOptional =
      0;

    if (!fundingData) {
      missingOptional += 1;
    }

    if (!indexData) {
      missingOptional += 1;
    }

    if (
      trades.length === 0
    ) {
      missingOptional += 1;
    }

    confidence -=
      missingOptional * 4;

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
      success: true,

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
            markPrice < 1
              ? 8
              : 4
          ),

        indexPrice:
          round(
            indexPrice,
            indexPrice < 1
              ? 8
              : 4
          ),

        basisPercent:
          round(
            basisPercent,
            4
          ),
      },

      markPrice:
        round(
          markPrice,
          markPrice < 1
            ? 8
            : 4
        ),

      indexPrice:
        round(
          indexPrice,
          indexPrice < 1
            ? 8
            : 4
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
      },

      orderBook: {
        bestBid:
          round(
            bestBid,
            bestBid < 1
              ? 8
              : 4
          ),

        bestAsk:
          round(
            bestAsk,
            bestAsk < 1
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
            tradeFlow.buyNotional,
            2
          ),

        sellNotionalUsd:
          round(
            tradeFlow.sellNotional,
            2
          ),

        tradesAnalyzed:
          trades.length,
      },

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

        available: false,

        note:
          "Global long/short account positioning is not inferred from unavailable data.",
      },

      bullishReasons,

      bearishReasons,

      reasons:
        combinedReasons,

      risks,

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

        openInterestHistory:
          false,

        takerFlow:
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
          instrument.ctValCcy ??
          "",

        settleCcy:
          instrument.settleCcy ??
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