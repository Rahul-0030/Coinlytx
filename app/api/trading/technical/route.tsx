import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BASE =
  "https://data-api.binance.vision";

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

type Candle = {
  openTime: number;

  open: number;
  high: number;
  low: number;
  close: number;

  volume: number;

  closeTime: number;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

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
      `Binance request failed: ${response.status}`;

    try {
      const error =
        await response.json();

      if (
        error &&
        typeof error.msg ===
          "string"
      ) {
        message =
          error.msg;
      }
    } catch {
      // Ignore JSON parsing error.
    }

    throw new Error(
      message
    );
  }

  return (
    await response.json()
  ) as T;
}

function emaSeries(
  values: number[],
  period: number
) {
  if (
    values.length ===
    0
  ) {
    return [];
  }

  const multiplier =
    2 /
    (period + 1);

  const result:
    number[] = [];

  let previous =
    values[0];

  result.push(
    previous
  );

  for (
    let i = 1;
    i <
    values.length;
    i += 1
  ) {
    const current =
      (
        values[i] -
        previous
      ) *
        multiplier +
      previous;

    result.push(
      current
    );

    previous =
      current;
  }

  return result;
}

function calculateEMA(
  values: number[],
  period: number
) {
  const series =
    emaSeries(
      values,
      period
    );

  return (
    series[
      series.length -
        1
    ] || 0
  );
}

function calculateRSI(
  values: number[],
  period = 14
) {
  if (
    values.length <=
    period
  ) {
    return 50;
  }

  let gains =
    0;

  let losses =
    0;

  for (
    let i = 1;
    i <=
    period;
    i += 1
  ) {
    const difference =
      values[i] -
      values[i - 1];

    if (
      difference >=
      0
    ) {
      gains +=
        difference;
    } else {
      losses +=
        Math.abs(
          difference
        );
    }
  }

  let averageGain =
    gains /
    period;

  let averageLoss =
    losses /
    period;

  for (
    let i =
      period + 1;
    i <
    values.length;
    i += 1
  ) {
    const difference =
      values[i] -
      values[i - 1];

    const gain =
      difference >
      0
        ? difference
        : 0;

    const loss =
      difference <
      0
        ? Math.abs(
            difference
          )
        : 0;

    averageGain =
      (
        averageGain *
          (period - 1) +
        gain
      ) /
      period;

    averageLoss =
      (
        averageLoss *
          (period - 1) +
        loss
      ) /
      period;
  }

  if (
    averageLoss ===
    0
  ) {
    return 100;
  }

  const rs =
    averageGain /
    averageLoss;

  return (
    100 -
    100 /
      (1 + rs)
  );
}

function calculateMACD(
  values: number[]
) {
  const ema12 =
    emaSeries(
      values,
      12
    );

  const ema26 =
    emaSeries(
      values,
      26
    );

  const macdSeries =
    values.map(
      (
        _value,
        index
      ) =>
        (
          ema12[index] ||
          0
        ) -
        (
          ema26[index] ||
          0
        )
    );

  const signalSeries =
    emaSeries(
      macdSeries,
      9
    );

  const last =
    macdSeries.length -
    1;

  const macd =
    macdSeries[last] ||
    0;

  const signal =
    signalSeries[last] ||
    0;

  return {
    macd,

    signal,

    histogram:
      macd -
      signal,
  };
}

function calculateATR(
  candles: Candle[],
  period = 14
) {
  if (
    candles.length <
    2
  ) {
    return 0;
  }

  const trueRanges:
    number[] = [];

  for (
    let i = 1;
    i <
    candles.length;
    i += 1
  ) {
    const candle =
      candles[i];

    const previous =
      candles[i - 1];

    const highLow =
      candle.high -
      candle.low;

    const highClose =
      Math.abs(
        candle.high -
          previous.close
      );

    const lowClose =
      Math.abs(
        candle.low -
          previous.close
      );

    trueRanges.push(
      Math.max(
        highLow,
        highClose,
        lowClose
      )
    );
  }

  const recent =
    trueRanges.slice(
      -period
    );

  if (
    recent.length ===
    0
  ) {
    return 0;
  }

  return (
    recent.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    recent.length
  );
}

function calculateVWAP(
  candles: Candle[],
  period = 50
) {
  const recent =
    candles.slice(
      -period
    );

  let weighted =
    0;

  let totalVolume =
    0;

  for (
    const candle of
    recent
  ) {
    const typicalPrice =
      (
        candle.high +
        candle.low +
        candle.close
      ) /
      3;

    weighted +=
      typicalPrice *
      candle.volume;

    totalVolume +=
      candle.volume;
  }

  if (
    totalVolume ===
    0
  ) {
    return (
      recent[
        recent.length -
          1
      ]?.close ||
      0
    );
  }

  return (
    weighted /
    totalVolume
  );
}

function calculateSupportResistance(
  candles: Candle[],
  period = 30
) {
  const recent =
    candles.slice(
      -period
    );

  if (
    recent.length ===
    0
  ) {
    return {
      support: 0,
      resistance: 0,
    };
  }

  const support =
    Math.min(
      ...recent.map(
        (candle) =>
          candle.low
      )
    );

  const resistance =
    Math.max(
      ...recent.map(
        (candle) =>
          candle.high
      )
    );

  return {
    support,
    resistance,
  };
}

function detectCandlePattern(
  candles: Candle[]
) {
  if (
    candles.length <
    2
  ) {
    return "NONE";
  }

  const current =
    candles[
      candles.length -
        1
    ];

  const previous =
    candles[
      candles.length -
        2
    ];

  const body =
    Math.abs(
      current.close -
        current.open
    );

  const range =
    current.high -
    current.low;

  const upperWick =
    current.high -
    Math.max(
      current.open,
      current.close
    );

  const lowerWick =
    Math.min(
      current.open,
      current.close
    ) -
    current.low;

  const currentBullish =
    current.close >
    current.open;

  const currentBearish =
    current.close <
    current.open;

  const previousBullish =
    previous.close >
    previous.open;

  const previousBearish =
    previous.close <
    previous.open;

  if (
    range >
      0 &&
    body /
      range <=
      0.1
  ) {
    return "DOJI";
  }

  if (
    previousBearish &&
    currentBullish &&
    current.open <=
      previous.close &&
    current.close >=
      previous.open
  ) {
    return "BULLISH_ENGULFING";
  }

  if (
    previousBullish &&
    currentBearish &&
    current.open >=
      previous.close &&
    current.close <=
      previous.open
  ) {
    return "BEARISH_ENGULFING";
  }

  if (
    body >
      0 &&
    lowerWick >=
      body *
        2 &&
    upperWick <=
      body
  ) {
    return "HAMMER";
  }

  if (
    body >
      0 &&
    upperWick >=
      body *
        2 &&
    lowerWick <=
      body
  ) {
    return "SHOOTING_STAR";
  }

  return "NONE";
}

function buildTradePlan({
  signal,
  price,
  atr,
  support,
  resistance,
}: {
  signal:
    TradeSignal;

  price:
    number;

  atr:
    number;

  support:
    number;

  resistance:
    number;
}) {
  if (
    signal ===
      "WAIT" ||
    atr <=
      0
  ) {
    return {
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
    };
  }

  if (
    signal ===
    "LONG"
  ) {
    const entryLow =
      Math.max(
        support,
        price -
          atr *
            0.35
      );

    const entryHigh =
      price;

    const atrStop =
      price -
      atr *
        1.8;

    const structuralStop =
      support -
      atr *
        0.3;

    let stopLoss =
      Math.max(
        atrStop,
        structuralStop
      );

    if (
      stopLoss >=
      price
    ) {
      stopLoss =
        price -
        atr *
          1.5;
    }

    const risk =
      Math.max(
        price -
          stopLoss,
        atr *
          0.5
      );

    return {
      entryLow,

      entryHigh,

      stopLoss,

      tp1:
        price +
        risk *
          1.5,

      tp2:
        Math.max(
          resistance,
          price +
            risk *
              2.5
        ),

      tp3:
        price +
        risk *
          4,

      invalidation:
        stopLoss,

      riskReward:
        "1:2.5 target",
    };
  }

  const entryLow =
    price;

  const entryHigh =
    Math.min(
      resistance,
      price +
        atr *
          0.35
    );

  const atrStop =
    price +
    atr *
      1.8;

  const structuralStop =
    resistance +
    atr *
      0.3;

  let stopLoss =
    Math.min(
      atrStop,
      structuralStop
    );

  if (
    stopLoss <=
    price
  ) {
    stopLoss =
      price +
      atr *
        1.5;
  }

  const risk =
    Math.max(
      stopLoss -
        price,
      atr *
        0.5
    );

  return {
    entryLow,

    entryHigh,

    stopLoss,

    tp1:
      price -
      risk *
        1.5,

    tp2:
      Math.min(
        support,
        price -
          risk *
            2.5
      ),

    tp3:
      price -
      risk *
        4,

    invalidation:
      stopLoss,

    riskReward:
      "1:2.5 target",
  };
}

function priceDecimals(
  price: number
) {
  if (
    price <
    0.0001
  ) {
    return 10;
  }

  if (
    price <
    0.01
  ) {
    return 8;
  }

  if (
    price <
    1
  ) {
    return 6;
  }

  if (
    price <
    100
  ) {
    return 4;
  }

  return 2;
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;

    /*
     * No hardcoded 5-coin list.
     */

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

    const url =
      new URL(
        `${BINANCE_BASE}/api/v3/klines`
      );

    url.searchParams.set(
      "symbol",
      symbol
    );

    url.searchParams.set(
      "interval",
      interval
    );

    url.searchParams.set(
      "limit",
      "300"
    );

    const rawKlines =
      await fetchJson<
        BinanceKline[]
      >(
        url.toString()
      );

    if (
      !Array.isArray(
        rawKlines
      ) ||
      rawKlines.length <
        210
    ) {
      throw new Error(
        `Not enough ${symbol} candle data for technical analysis.`
      );
    }

    const candles:
      Candle[] =
      rawKlines.map(
        (
          item
        ) => ({
          openTime:
            Number(
              item[0]
            ),

          open:
            Number(
              item[1]
            ),

          high:
            Number(
              item[2]
            ),

          low:
            Number(
              item[3]
            ),

          close:
            Number(
              item[4]
            ),

          volume:
            Number(
              item[5]
            ),

          closeTime:
            Number(
              item[6]
            ),
        })
      );

    const closes =
      candles.map(
        (candle) =>
          candle.close
      );

    const current =
      candles[
        candles.length -
          1
      ];

    const price =
      current.close;

    const ema20 =
      calculateEMA(
        closes,
        20
      );

    const ema50 =
      calculateEMA(
        closes,
        50
      );

    const ema200 =
      calculateEMA(
        closes,
        200
      );

    const rsi =
      calculateRSI(
        closes,
        14
      );

    const macd =
      calculateMACD(
        closes
      );

    const atr =
      calculateATR(
        candles,
        14
      );

    const vwap =
      calculateVWAP(
        candles,
        50
      );

    const {
      support,
      resistance,
    } =
      calculateSupportResistance(
        candles,
        30
      );

    const candlePattern =
      detectCandlePattern(
        candles
      );

    let score =
      0;

    const bullishReasons:
      string[] = [];

    const bearishReasons:
      string[] = [];

    const risks:
      string[] = [];

    /*
     * Price vs EMA20
     */

    if (
      price >
      ema20
    ) {
      score +=
        15;

      bullishReasons.push(
        "Price is above EMA 20."
      );
    } else {
      score -=
        15;

      bearishReasons.push(
        "Price is below EMA 20."
      );
    }

    /*
     * EMA20 vs EMA50
     */

    if (
      ema20 >
      ema50
    ) {
      score +=
        15;

      bullishReasons.push(
        "EMA 20 is above EMA 50."
      );
    } else {
      score -=
        15;

      bearishReasons.push(
        "EMA 20 is below EMA 50."
      );
    }

    /*
     * EMA50 vs EMA200
     */

    if (
      ema50 >
      ema200
    ) {
      score +=
        20;

      bullishReasons.push(
        "EMA 50 is above EMA 200."
      );
    } else {
      score -=
        20;

      bearishReasons.push(
        "EMA 50 is below EMA 200."
      );
    }

    /*
     * RSI
     */

    if (
      rsi >=
        50 &&
      rsi <=
        68
    ) {
      score +=
        10;

      bullishReasons.push(
        "RSI shows bullish momentum without being extremely overbought."
      );
    } else if (
      rsi <
      42
    ) {
      score -=
        10;

      bearishReasons.push(
        "RSI shows weak bearish momentum."
      );
    }

    if (
      rsi >=
      70
    ) {
      risks.push(
        "RSI is overbought, increasing pullback risk."
      );
    }

    if (
      rsi <=
      30
    ) {
      risks.push(
        "RSI is oversold, increasing rebound risk."
      );
    }

    /*
     * MACD
     */

    if (
      macd.histogram >
      0
    ) {
      score +=
        15;

      bullishReasons.push(
        "MACD momentum is positive."
      );
    } else if (
      macd.histogram <
      0
    ) {
      score -=
        15;

      bearishReasons.push(
        "MACD momentum is negative."
      );
    }

    /*
     * VWAP
     */

    if (
      price >
      vwap
    ) {
      score +=
        10;

      bullishReasons.push(
        "Price is trading above VWAP."
      );
    } else {
      score -=
        10;

      bearishReasons.push(
        "Price is trading below VWAP."
      );
    }

    /*
     * Candle pattern
     */

    if (
      candlePattern ===
        "BULLISH_ENGULFING" ||
      candlePattern ===
        "HAMMER"
    ) {
      score +=
        10;

      bullishReasons.push(
        `Bullish candle pattern detected: ${candlePattern}.`
      );
    }

    if (
      candlePattern ===
        "BEARISH_ENGULFING" ||
      candlePattern ===
        "SHOOTING_STAR"
    ) {
      score -=
        10;

      bearishReasons.push(
        `Bearish candle pattern detected: ${candlePattern}.`
      );
    }

    if (
      candlePattern ===
      "DOJI"
    ) {
      risks.push(
        "Doji detected, showing short-term market indecision."
      );
    }

    /*
     * Resistance/support proximity.
     */

    if (
      resistance >
      0
    ) {
      const distanceToResistance =
        (
          resistance -
          price
        ) /
        price;

      if (
        distanceToResistance >=
          0 &&
        distanceToResistance <
          0.003
      ) {
        risks.push(
          "Price is very close to recent resistance."
        );
      }
    }

    if (
      support >
      0
    ) {
      const distanceToSupport =
        (
          price -
          support
        ) /
        price;

      if (
        distanceToSupport >=
          0 &&
        distanceToSupport <
          0.003
      ) {
        risks.push(
          "Price is very close to recent support."
        );
      }
    }

    score =
      clamp(
        score,
        -100,
        100
      );

    let signal:
      TradeSignal =
      "WAIT";

    if (
      score >=
      30
    ) {
      signal =
        "LONG";
    } else if (
      score <=
      -30
    ) {
      signal =
        "SHORT";
    }

    /*
     * Heuristic confidence only.
     */

    let confidence =
      48 +
      Math.abs(
        score
      ) *
        0.45;

    if (
      signal ===
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
        90
      );

    const tradePlan =
      buildTradePlan({
        signal,
        price,
        atr,
        support,
        resistance,
      });

    const decimals =
      priceDecimals(
        price
      );

    return NextResponse.json({
      success:
        true,

      symbol,

      interval,

      signal,

      /*
       * Return BOTH names.
       *
       * Existing Coinlytx routes
       * may use technicalScore,
       * while newer code may use
       * score.
       */

      technicalScore:
        round(
          score,
          1
        ),

      score:
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

      currentPrice:
        round(
          price,
          decimals
        ),

      indicators: {
        ema20:
          round(
            ema20,
            decimals
          ),

        ema50:
          round(
            ema50,
            decimals
          ),

        ema200:
          round(
            ema200,
            decimals
          ),

        rsi:
          round(
            rsi,
            2
          ),

        /*
         * Flat fields retained
         * for existing routes.
         */

        macd:
          round(
            macd.macd,
            decimals
          ),

        macdSignal:
          round(
            macd.signal,
            decimals
          ),

        macdHistogram:
          round(
            macd.histogram,
            decimals
          ),

        atr:
          round(
            atr,
            decimals
          ),

        vwap:
          round(
            vwap,
            decimals
          ),

        support:
          round(
            support,
            decimals
          ),

        resistance:
          round(
            resistance,
            decimals
          ),
      },

      marketStructure: {
        support:
          round(
            support,
            decimals
          ),

        resistance:
          round(
            resistance,
            decimals
          ),

        atr:
          round(
            atr,
            decimals
          ),

        rsi:
          round(
            rsi,
            2
          ),

        candlePattern,
      },

      candlePattern,

      tradePlan: {
        entryLow:
          tradePlan.entryLow ===
          null
            ? null
            : round(
                tradePlan.entryLow,
                decimals
              ),

        entryHigh:
          tradePlan.entryHigh ===
          null
            ? null
            : round(
                tradePlan.entryHigh,
                decimals
              ),

        stopLoss:
          tradePlan.stopLoss ===
          null
            ? null
            : round(
                tradePlan.stopLoss,
                decimals
              ),

        tp1:
          tradePlan.tp1 ===
          null
            ? null
            : round(
                tradePlan.tp1,
                decimals
              ),

        tp2:
          tradePlan.tp2 ===
          null
            ? null
            : round(
                tradePlan.tp2,
                decimals
              ),

        tp3:
          tradePlan.tp3 ===
          null
            ? null
            : round(
                tradePlan.tp3,
                decimals
              ),

        invalidation:
          tradePlan.invalidation ===
          null
            ? null
            : round(
                tradePlan.invalidation,
                decimals
              ),

        riskReward:
          tradePlan.riskReward,
      },

      bullishReasons,

      bearishReasons,

      risks,

      candle: {
        open:
          round(
            current.open,
            decimals
          ),

        high:
          round(
            current.high,
            decimals
          ),

        low:
          round(
            current.low,
            decimals
          ),

        close:
          round(
            current.close,
            decimals
          ),

        volume:
          round(
            current.volume,
            4
          ),

        openTime:
          current.openTime,

        closeTime:
          current.closeTime,
      },

      data: {
        candlesAnalyzed:
          candles.length,

        source:
          "Binance Spot",

        interval,
      },

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Technical analysis error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate technical analysis.",
      },
      {
        status:
          500,
      }
    );
  }
}