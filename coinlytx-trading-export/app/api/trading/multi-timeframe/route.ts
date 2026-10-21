import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEFRAMES = [
  {
    interval: "1m",
    weight: 5,
  },
  {
    interval: "5m",
    weight: 10,
  },
  {
    interval: "15m",
    weight: 15,
  },
  {
    interval: "1h",
    weight: 20,
  },
  {
    interval: "4h",
    weight: 25,
  },
  {
    interval: "1d",
    weight: 25,
  },
] as const;

type TradeSignal =
  | "LONG"
  | "SHORT"
  | "WAIT";

type Trend =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

type Alignment =
  | "STRONG_BULLISH"
  | "BULLISH"
  | "MIXED"
  | "BEARISH"
  | "STRONG_BEARISH";

type TechnicalResponse = {
  success: boolean;

  symbol: string;

  interval: string;

  signal:
    TradeSignal;

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

  bullishReasons?: string[];

  bearishReasons?: string[];

  risks?: string[];

  error?: string;
};

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

function getTechnicalScore(
  data: TechnicalResponse
) {
  if (
    typeof data.technicalScore ===
      "number"
  ) {
    return data.technicalScore;
  }

  if (
    typeof data.score ===
      "number"
  ) {
    return data.score;
  }

  return 0;
}

async function fetchTechnical(
  url: string
): Promise<TechnicalResponse> {
  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as
      TechnicalResponse;

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.error ||
        `Technical request failed: ${response.status}`
    );
  }

  return data;
}

function getTrend(
  score: number
): Trend {
  if (
    score >=
    20
  ) {
    return "BULLISH";
  }

  if (
    score <=
    -20
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;

    /*
     * IMPORTANT:
     *
     * No hardcoded
     * BTC / ETH / SOL /
     * XRP / BNB list.
     */

    const symbol =
      normalizeTradingSymbol(
        searchParams.get(
          "symbol"
        ),
        "BTCUSDT"
      );

    const origin =
      request.nextUrl.origin;

    /*
     * Analyze all six
     * timeframes in parallel.
     */

    const results =
      await Promise.all(
        TIMEFRAMES.map(
          async (
            timeframe
          ) => {
            try {
              const url =
                new URL(
                  "/api/trading/technical",
                  origin
                );

              url.searchParams.set(
                "symbol",
                symbol
              );

              url.searchParams.set(
                "interval",
                timeframe.interval
              );

              const data =
                await fetchTechnical(
                  url.toString()
                );

              /*
               * Prevent hidden
               * BTC fallback.
               */

              if (
                data.symbol !==
                symbol
              ) {
                throw new Error(
                  `Technical symbol mismatch for ${timeframe.interval}. Requested ${symbol}, received ${data.symbol}.`
                );
              }

              if (
                data.interval !==
                timeframe.interval
              ) {
                throw new Error(
                  `Technical interval mismatch. Requested ${timeframe.interval}, received ${data.interval}.`
                );
              }

              return {
                success:
                  true as const,

                interval:
                  timeframe.interval,

                weight:
                  timeframe.weight,

                data,
              };
            } catch (
              error
            ) {
              return {
                success:
                  false as const,

                interval:
                  timeframe.interval,

                weight:
                  timeframe.weight,

                data:
                  null,

                error:
                  error instanceof Error
                    ? error.message
                    : "Unable to analyze timeframe.",
              };
            }
          }
        )
      );

    const validResults =
      results.filter(
        (
          result
        ): result is Extract<
          (typeof results)[number],
          {
            success: true;
          }
        > =>
          result.success &&
          result.data !==
            null
      );

    if (
      validResults.length ===
      0
    ) {
      const errors =
        results
          .filter(
            (
              item
            ) =>
              !item.success
          )
          .map(
            (
              item
            ) =>
              `${item.interval}: ${
                "error" in item
                  ? item.error
                  : "Unknown error"
              }`
          );

      throw new Error(
        `No timeframe data available. ${errors.join(
          " | "
        )}`
      );
    }

    /*
     * Weighted technical
     * consensus.
     */

    let weightedTotal =
      0;

    let availableWeight =
      0;

    let bullishWeight =
      0;

    let bearishWeight =
      0;

    let neutralWeight =
      0;

    let longCount =
      0;

    let shortCount =
      0;

    let waitCount =
      0;

    for (
      const result of
      validResults
    ) {
      const score =
        getTechnicalScore(
          result.data
        );

      weightedTotal +=
        score *
        result.weight;

      availableWeight +=
        result.weight;

      if (
        result.data.signal ===
        "LONG"
      ) {
        longCount +=
          1;

        bullishWeight +=
          result.weight;
      } else if (
        result.data.signal ===
        "SHORT"
      ) {
        shortCount +=
          1;

        bearishWeight +=
          result.weight;
      } else {
        waitCount +=
          1;

        neutralWeight +=
          result.weight;
      }
    }

    const weightedScore =
      availableWeight >
      0
        ? weightedTotal /
          availableWeight
        : 0;

    /*
     * Short-term:
     *
     * 1m + 5m + 15m
     */

    const shortTermResults =
      validResults.filter(
        (
          result
        ) =>
          [
            "1m",
            "5m",
            "15m",
          ].includes(
            result.interval
          )
      );

    const shortTermWeight =
      shortTermResults.reduce(
        (
          total,
          result
        ) =>
          total +
          result.weight,
        0
      );

    const shortTermWeightedScore =
      shortTermWeight >
      0
        ? shortTermResults.reduce(
            (
              total,
              result
            ) =>
              total +
              getTechnicalScore(
                result.data
              ) *
                result.weight,
            0
          ) /
          shortTermWeight
        : 0;

    const shortTermTrend =
      getTrend(
        shortTermWeightedScore
      );

    /*
     * Higher timeframe:
     *
     * 1h + 4h + 1d
     */

    const higherResults =
      validResults.filter(
        (
          result
        ) =>
          [
            "1h",
            "4h",
            "1d",
          ].includes(
            result.interval
          )
      );

    const higherWeight =
      higherResults.reduce(
        (
          total,
          result
        ) =>
          total +
          result.weight,
        0
      );

    const higherWeightedScore =
      higherWeight >
      0
        ? higherResults.reduce(
            (
              total,
              result
            ) =>
              total +
              getTechnicalScore(
                result.data
              ) *
                result.weight,
            0
          ) /
          higherWeight
        : 0;

    const higherTrend =
      getTrend(
        higherWeightedScore
      );

    /*
     * Overall alignment.
     */

    let alignment:
      Alignment =
      "MIXED";

    const bullishWeightPercent =
      availableWeight >
      0
        ? (
            bullishWeight /
            availableWeight
          ) *
          100
        : 0;

    const bearishWeightPercent =
      availableWeight >
      0
        ? (
            bearishWeight /
            availableWeight
          ) *
          100
        : 0;

    if (
      bullishWeightPercent >=
      70
    ) {
      alignment =
        "STRONG_BULLISH";
    } else if (
      bullishWeightPercent >=
      50
    ) {
      alignment =
        "BULLISH";
    } else if (
      bearishWeightPercent >=
      70
    ) {
      alignment =
        "STRONG_BEARISH";
    } else if (
      bearishWeightPercent >=
      50
    ) {
      alignment =
        "BEARISH";
    }

    /*
     * Consensus signal.
     */

    let consensusSignal:
      TradeSignal =
      "WAIT";

    if (
      weightedScore >=
      30
    ) {
      consensusSignal =
        "LONG";
    } else if (
      weightedScore <=
      -30
    ) {
      consensusSignal =
        "SHORT";
    }

    /*
     * Short-term versus
     * higher-timeframe conflict.
     */

    let trendConflict =
      false;

    const warnings:
      string[] = [];

    if (
      shortTermTrend ===
        "BULLISH" &&
      higherTrend ===
        "BEARISH"
    ) {
      trendConflict =
        true;

      warnings.push(
        "Short-term momentum is bullish while the 1h/4h/1d structure is bearish."
      );
    }

    if (
      shortTermTrend ===
        "BEARISH" &&
      higherTrend ===
        "BULLISH"
    ) {
      trendConflict =
        true;

      warnings.push(
        "Short-term momentum is bearish while the 1h/4h/1d structure is bullish."
      );
    }

    /*
     * Block consensus against
     * a strongly opposing
     * higher-timeframe trend.
     */

    if (
      consensusSignal ===
        "LONG" &&
      higherWeightedScore <=
        -35
    ) {
      consensusSignal =
        "WAIT";

      trendConflict =
        true;

      warnings.push(
        "LONG consensus blocked because higher-timeframe structure is strongly bearish."
      );
    }

    if (
      consensusSignal ===
        "SHORT" &&
      higherWeightedScore >=
        35
    ) {
      consensusSignal =
        "WAIT";

      trendConflict =
        true;

      warnings.push(
        "SHORT consensus blocked because higher-timeframe structure is strongly bullish."
      );
    }

    /*
     * Heuristic confidence.
     */

    let confidence =
      48 +
      Math.abs(
        weightedScore
      ) *
        0.4;

    if (
      alignment ===
        "STRONG_BULLISH" ||
      alignment ===
        "STRONG_BEARISH"
    ) {
      confidence +=
        8;
    }

    if (
      trendConflict
    ) {
      confidence -=
        10;
    }

    if (
      consensusSignal ===
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
     * UI-friendly timeframe
     * results.
     */

    const timeframeResults =
      results.map(
        (
          result
        ) => {
          if (
            !result.success ||
            !result.data
          ) {
            return {
              interval:
                result.interval,

              weight:
                result.weight,

              success:
                false,

              signal:
                "WAIT" as const,

              score:
                0,

              confidence:
                0,

              currentPrice:
                null,

              rsi:
                null,

              ema20:
                null,

              ema50:
                null,

              ema200:
                null,

              macd:
                null,

              macdHistogram:
                null,

              support:
                null,

              resistance:
                null,

              atr:
                null,

              candlePattern:
                "NONE",

              error:
                "error" in result
                  ? result.error
                  : "No data",
            };
          }

          const score =
            getTechnicalScore(
              result.data
            );

          return {
            interval:
              result.interval,

            weight:
              result.weight,

            success:
              true,

            signal:
              result.data
                .signal,

            score:
              round(
                score,
                1
              ),

            confidence:
              round(
                result.data
                  .confidence,
                1
              ),

            currentPrice:
              result.data
                .currentPrice,

            rsi:
              result.data
                .indicators
                .rsi,

            ema20:
              result.data
                .indicators
                .ema20,

            ema50:
              result.data
                .indicators
                .ema50,

            ema200:
              result.data
                .indicators
                .ema200,

            macd:
              result.data
                .indicators
                .macd,

            macdHistogram:
              result.data
                .indicators
                .macdHistogram,

            support:
              result.data
                .indicators
                .support,

            resistance:
              result.data
                .indicators
                .resistance,

            atr:
              result.data
                .indicators
                .atr,

            candlePattern:
              result.data
                .candlePattern ||
              "NONE",
          };
        }
      );

    return NextResponse.json({
      success:
        true,

      symbol,

      consensusSignal,

      weightedScore:
        round(
          weightedScore,
          1
        ),

      confidence:
        round(
          confidence,
          1
        ),

      confidenceType:
        "heuristic",

      alignment,

      trendConflict,

      shortTerm: {
        trend:
          shortTermTrend,

        averageScore:
          round(
            shortTermWeightedScore,
            1
          ),
      },

      higherTimeframe: {
        trend:
          higherTrend,

        averageScore:
          round(
            higherWeightedScore,
            1
          ),
      },

      distribution: {
        longTimeframes:
          longCount,

        shortTimeframes:
          shortCount,

        waitTimeframes:
          waitCount,

        bullishWeight:
          round(
            bullishWeightPercent,
            1
          ),

        bearishWeight:
          round(
            bearishWeightPercent,
            1
          ),

        neutralWeight:
          round(
            availableWeight >
              0
              ? (
                  neutralWeight /
                  availableWeight
                ) *
                  100
              : 0,
            1
          ),
      },

      timeframes:
        timeframeResults,

      warnings,

      methodology: {
        timeframes: {
          "1m":
            "5%",

          "5m":
            "10%",

          "15m":
            "15%",

          "1h":
            "20%",

          "4h":
            "25%",

          "1d":
            "25%",
        },

        shortTerm:
          "1m + 5m + 15m",

        higherTimeframe:
          "1h + 4h + 1d",

        source:
          "Coinlytx technical engine",
      },

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Multi-timeframe analysis error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to perform multi-timeframe analysis.",
      },
      {
        status:
          500,
      }
    );
  }
}