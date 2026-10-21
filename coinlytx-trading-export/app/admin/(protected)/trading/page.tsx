"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type IntervalType =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1d";

type TradeSignal =
  | "LONG"
  | "SHORT"
  | "WAIT";

type MarketItem = {
  symbol: string;
  baseAsset: string;
  price: number;
  change24h: number;
  quoteVolume24h: number;
  volume24h: number;
};

type MarketsResponse = {
  success: boolean;
  count: number;
  symbols: MarketItem[];
  updatedAt: string;
  error?: string;
};

type TimeframeResult = {
  interval: string;

  signal:
    | "LONG"
    | "SHORT"
    | "WAIT";

  score: number;
  confidence: number;

  rsi:
    | number
    | null;

  support:
    | number
    | null;

  resistance:
    | number
    | null;

  pattern: string;
};

type FinalResponse = {
  success: boolean;

  symbol: string;
  interval: string;

  finalDecision:
    TradeSignal;

  decisionScore: number;

  confidence: number;

  confidenceType: string;

  strongConflict: boolean;

  currentPrice: number;

  decisionWeights: {
    selectedSignal: number;
    multiTimeframe: number;
  };

  decisionContributions: {
    selectedSignalScore: number;

    selectedSignalContribution: number;

    multiTimeframeScore: number;

    multiTimeframeContribution: number;
  };

  intelligenceWeights: {
    technical: number;

    derivatives: number;

    whale: number;

    stablecoin: number;

    catalyst: number;

    macro: number;
  };

  intelligenceScores: {
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

  selectedTimeframe: {
    interval: string;

    signal:
      TradeSignal;

    score: number;

    confidence: number;

    technicalScore: number;

    derivativesScore: number;

    whaleScore: number;

    stablecoinScore: number;

    catalystScore: number;

    macroScore: number;
  };

  multiTimeframe: {
    consensusSignal:
      TradeSignal;

    weightedScore: number;

    confidence: number;

    alignment:
      | "STRONG_BULLISH"
      | "BULLISH"
      | "MIXED"
      | "BEARISH"
      | "STRONG_BEARISH";

    trendConflict: boolean;

    shortTermTrend:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    shortTermScore: number;

    higherTimeframeTrend:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    higherTimeframeScore: number;

    distribution: {
      longTimeframes: number;

      shortTimeframes: number;

      waitTimeframes: number;

      bullishWeight: number;

      bearishWeight: number;

      neutralWeight: number;
    };

    timeframes:
      TimeframeResult[];
  };

  tradePlan: {
    entryLow:
      | number
      | null;

    entryHigh:
      | number
      | null;

    stopLoss:
      | number
      | null;

    tp1:
      | number
      | null;

    tp2:
      | number
      | null;

    tp3:
      | number
      | null;

    invalidation:
      | number
      | null;

    riskReward:
      | string
      | null;
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

    coinSpecificScore?: number;

    coinSpecificBias?:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    coinSpecificAvailable?: boolean;

    coinSpecificMeaningful?: boolean;

    coinSpecificEffectiveWeight?: number;

    marketWideAvailable?: boolean;

    marketWideRequestSucceeded?: boolean;

    marketWideMeaningful?: boolean;

    marketWideBias?:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    marketWideScore?: number;

    marketWideEffectiveContribution?: number;

    marketWideEffectiveWeight?: number;

    marketWideMatchedArticles?: number;

    marketWideBullishArticles?: number;

    marketWideBearishArticles?: number;

    marketWideNeutralArticles?: number;

    marketWideHighImpactArticles?: number;

    marketWideAvailableSources?: number;

    marketWideTotalSources?: number;

    marketWideSourceFailures?: Array<{
      source: string;
      error: string;
    }>;

    totalCatalysts: number;

    coinSpecificCatalysts?: number;

    marketWideCatalysts?: number;

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

  confirmations: string[];

  bullishReasons: string[];

  bearishReasons: string[];

  risks: string[];

  modules: {
    technical: boolean;

    derivatives: boolean;

    orderBook: boolean;

    takerFlow: boolean;

    whaleTracking: boolean;

    stablecoinLiquidity: boolean;

    usdt: boolean;

    usdc: boolean;

    multiTimeframe: boolean;

    timeframesAnalyzed: number;

    erc20Whales: boolean;

    news: boolean;

    announcements: boolean;

    catalyst: boolean;

    catalystWeighted: boolean;

    macro: boolean;

    macroWeighted: boolean;

    macroCalendar: boolean;

    machineLearning: boolean;
  };

  updatedAt: string;

  error?: string;
};

const INTERVALS:
  IntervalType[] = [
    "1m",
    "5m",
    "15m",
    "1h",
    "4h",
    "1d",
  ];

function formatUsd(
  value:
    | number
    | null
    | undefined,
  decimals = 2
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",

      currency: "USD",

      maximumFractionDigits:
        decimals,
    }
  ).format(value);
}

function formatPrice(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  if (
    value <
    0.0001
  ) {
    return `$${value.toFixed(
      8
    )}`;
  }

  if (
    value <
    0.01
  ) {
    return `$${value.toFixed(
      6
    )}`;
  }

  if (
    value <
    1
  ) {
    return `$${value.toFixed(
      4
    )}`;
  }

  return formatUsd(
    value,
    2
  );
}

function formatLargeUsd(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  const abs =
    Math.abs(
      value
    );

  const sign =
    value <
    0
      ? "-"
      : "";

  if (
    abs >=
    1_000_000_000
  ) {
    return `${sign}$${(
      abs /
      1_000_000_000
    ).toFixed(2)}B`;
  }

  if (
    abs >=
    1_000_000
  ) {
    return `${sign}$${(
      abs /
      1_000_000
    ).toFixed(2)}M`;
  }

  if (
    abs >=
    1_000
  ) {
    return `${sign}$${(
      abs /
      1_000
    ).toFixed(2)}K`;
  }

  return `${sign}$${abs.toFixed(
    2
  )}`;
}

function signalColors(
  signal:
    TradeSignal
) {
  if (
    signal ===
    "LONG"
  ) {
    return {
      background:
        "#dcfce7",

      color:
        "#166534",

      border:
        "#86efac",
    };
  }

  if (
    signal ===
    "SHORT"
  ) {
    return {
      background:
        "#fee2e2",

      color:
        "#991b1b",

      border:
        "#fca5a5",
    };
  }

  return {
    background:
      "#fef3c7",

    color:
      "#92400e",

    border:
      "#fcd34d",
  };
}

function biasColor(
  value: string
) {
  if (
    value.includes(
      "BULLISH"
    )
  ) {
    return "#15803d";
  }

  if (
    value.includes(
      "BEARISH"
    )
  ) {
    return "#b91c1c";
  }

  return "#64748b";
}

function biasBackground(
  value: string
) {
  if (
    value.includes(
      "BULLISH"
    )
  ) {
    return "#dcfce7";
  }

  if (
    value.includes(
      "BEARISH"
    )
  ) {
    return "#fee2e2";
  }

  return "#f1f5f9";
}

function regimeColor(
  value: string
) {
  if (
    value ===
    "RISK_ON"
  ) {
    return "#166534";
  }

  if (
    value ===
    "RISK_OFF"
  ) {
    return "#991b1b";
  }

  return "#92400e";
}

function regimeBackground(
  value: string
) {
  if (
    value ===
    "RISK_ON"
  ) {
    return "#dcfce7";
  }

  if (
    value ===
    "RISK_OFF"
  ) {
    return "#fee2e2";
  }

  return "#fef3c7";
}

function formatSignedPercent(
  value: number,
  decimals = 2
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  const prefix =
    value > 0
      ? "+"
      : "";

  return `${prefix}${value.toFixed(
    decimals
  )}%`;
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;

  value: string;

  sub?: string;
}) {
  return (
    <div
      style={{
        background:
          "#ffffff",

        border:
          "1px solid #e2e8f0",

        borderRadius:
          "14px",

        padding:
          "16px",
      }}
    >
      <div
        style={{
          color:
            "#64748b",

          fontSize:
            "12px",

          fontWeight:
            800,

          textTransform:
            "uppercase",

          letterSpacing:
            "0.04em",

          marginBottom:
            "7px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            "#0f172a",

          fontWeight:
            900,

          fontSize:
            "20px",

          overflowWrap:
            "anywhere",
        }}
      >
        {value}
      </div>

      {sub && (
        <div
          style={{
            color:
              "#64748b",

            fontSize:
              "12px",

            marginTop:
              "5px",

            lineHeight:
              1.4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ReasonPanel({
  title,
  items,
  type,
}: {
  title: string;

  items: string[];

  type:
    | "positive"
    | "negative"
    | "warning"
    | "neutral";
}) {
  let background =
    "#f8fafc";

  let border =
    "#e2e8f0";

  let titleColor =
    "#334155";

  if (
    type ===
    "positive"
  ) {
    background =
      "#f0fdf4";

    border =
      "#bbf7d0";

    titleColor =
      "#166534";
  }

  if (
    type ===
    "negative"
  ) {
    background =
      "#fef2f2";

    border =
      "#fecaca";

    titleColor =
      "#991b1b";
  }

  if (
    type ===
    "warning"
  ) {
    background =
      "#fffbeb";

    border =
      "#fde68a";

    titleColor =
      "#92400e";
  }

  return (
    <div
      style={{
        background,

        border:
          `1px solid ${border}`,

        borderRadius:
          "16px",

        padding:
          "18px",
      }}
    >
      <h3
        style={{
          margin:
            "0 0 12px",

          fontSize:
            "16px",

          color:
            titleColor,
        }}
      >
        {title}
      </h3>

      {items.length ===
      0 ? (
        <div
          style={{
            color:
              "#64748b",

            fontSize:
              "14px",
          }}
        >
          No strong factors
          detected.
        </div>
      ) : (
        <div
          style={{
            display:
              "grid",

            gap:
              "9px",
          }}
        >
          {items.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  `${title}-${index}`
                }
                style={{
                  display:
                    "flex",

                  gap:
                    "8px",

                  color:
                    "#334155",

                  fontSize:
                    "14px",

                  lineHeight:
                    1.5,
                }}
              >
                <span>
                  •
                </span>

                <span>
                  {item}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function TimeframeCard({
  item,
  selected,
  onClick,
}: {
  item:
    TimeframeResult;

  selected:
    boolean;

  onClick:
    () => void;
}) {
  const colors =
    signalColors(
      item.signal
    );

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        width:
          "100%",

        textAlign:
          "left",

        border:
          selected
            ? "2px solid #0f172a"
            : `1px solid ${colors.border}`,

        background:
          colors.background,

        borderRadius:
          "16px",

        padding:
          "16px",

        cursor:
          "pointer",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          marginBottom:
            "12px",
        }}
      >
        <div
          style={{
            fontWeight:
              900,

            fontSize:
              "18px",

            color:
              "#0f172a",
          }}
        >
          {
            item.interval
          }
        </div>

        <div
          style={{
            color:
              colors.color,

            fontWeight:
              900,
          }}
        >
          {
            item.signal
          }
        </div>
      </div>

      <div
        style={{
          display:
            "grid",

          gap:
            "6px",

          color:
            "#475569",

          fontSize:
            "13px",
        }}
      >
        <div>
          Score:{" "}
          <strong>
            {
              item.score
            }
          </strong>
        </div>

        <div>
          Confidence:{" "}
          <strong>
            {
              item.confidence
            }%
          </strong>
        </div>

        <div>
          RSI:{" "}
          <strong>
            {
              item.rsi ??
              "—"
            }
          </strong>
        </div>

        <div>
          Pattern:{" "}
          <strong>
            {
              item.pattern
            }
          </strong>
        </div>
      </div>
    </button>
  );
}

export default function TradingPage() {
  const [
    symbol,
    setSymbol,
  ] =
    useState(
      "ETHUSDT"
    );

  const [
    interval,
    setInterval,
  ] =
    useState<IntervalType>(
      "15m"
    );

  const [
    markets,
    setMarkets,
  ] =
    useState<
      MarketItem[]
    >([]);

  const [
    marketSearch,
    setMarketSearch,
  ] =
    useState(
      ""
    );

  const [
    marketPickerOpen,
    setMarketPickerOpen,
  ] =
    useState(
      false
    );

  const [
    marketsLoading,
    setMarketsLoading,
  ] =
    useState(
      true
    );

  const [
    data,
    setData,
  ] =
    useState<
      FinalResponse | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    marketsError,
    setMarketsError,
  ] =
    useState(
      ""
    );

  const loadMarkets =
    useCallback(
      async () => {
        try {
          setMarketsError(
            ""
          );

          const response =
            await fetch(
              "/api/trading/symbols",
              {
                cache:
                  "no-store",
              }
            );

          const json =
            (await response.json()) as
              MarketsResponse;

          if (
            !response.ok ||
            !json.success
          ) {
            throw new Error(
              json.error ||
                "Unable to load trading markets."
            );
          }

          setMarkets(
            json.symbols
          );
        } catch (
          err
        ) {
          setMarketsError(
            err instanceof Error
              ? err.message
              : "Unable to load markets."
          );
        } finally {
          setMarketsLoading(
            false
          );
        }
      },
      []
    );

  const loadData =
    useCallback(
      async () => {
        try {
          setError(
            ""
          );

          const response =
            await fetch(
              `/api/trading/final?symbol=${encodeURIComponent(
                symbol
              )}&interval=${interval}`,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            (await response.json()) as
              FinalResponse;

          if (
            !response.ok ||
            !json.success
          ) {
            throw new Error(
              json.error ||
                "Unable to load trading intelligence."
            );
          }

          setData(
            json
          );
        } catch (
          err
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load trading intelligence."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        symbol,
        interval,
      ]
    );

  useEffect(() => {
    loadMarkets();

    const marketTimer =
      window.setInterval(
        loadMarkets,
        60000
      );

    return () => {
      window.clearInterval(
        marketTimer
      );
    };
  }, [
    loadMarkets,
  ]);

  useEffect(() => {
    setLoading(
      true
    );

    loadData();

    const signalTimer =
      window.setInterval(
        loadData,
        15000
      );

    return () => {
      window.clearInterval(
        signalTimer
      );
    };
  }, [
    loadData,
  ]);

  const filteredMarkets =
    useMemo(
      () => {
        const query =
          marketSearch
            .trim()
            .toUpperCase();

        if (
          !query
        ) {
          return markets;
        }

        return markets.filter(
          (
            market
          ) =>
            market.symbol.includes(
              query
            ) ||
            market.baseAsset.includes(
              query
            )
        );
      },
      [
        markets,
        marketSearch,
      ]
    );

  const selectedMarket =
    useMemo(
      () =>
        markets.find(
          (
            market
          ) =>
            market.symbol ===
            symbol
        ),
      [
        markets,
        symbol,
      ]
    );

  const finalColors =
    data
      ? signalColors(
          data.finalDecision
        )
      : null;

  const whaleSourceTitle =
    data?.whaleIntelligence.source ===
    "ETH_NATIVE"
      ? "Native ETH Whale Tracking"
      : data?.whaleIntelligence.source ===
          "ERC20"
        ? `${data.symbol.replace(
            "USDT",
            ""
          )} ERC-20 Whale Tracking`
        : "Coin-Specific Whale Tracking";

  const whaleSourceBadge =
    data?.whaleIntelligence.source ===
    "ETH_NATIVE"
      ? "NATIVE ETH"
      : data?.whaleIntelligence.source ===
          "ERC20"
        ? "ERC-20"
        : "UNAVAILABLE";

  const whaleDecisionContribution =
    data
      ? data.intelligenceScores
          .whaleContribution *
        (
          data.decisionWeights
            .selectedSignal /
          100
        )
      : 0;

  const catalystDecisionContribution =
    data
      ? data.intelligenceScores
          .catalystContribution *
        (
          data.decisionWeights
            .selectedSignal /
          100
        )
      : 0;

  const macroDecisionContribution =
    data
      ? data.intelligenceScores
          .macroContribution *
        (
          data.decisionWeights
            .selectedSignal /
          100
        )
      : 0;

  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#f8fafc",

        color:
          "#0f172a",

        padding:
          "28px",
      }}
    >
      <div
        style={{
          maxWidth:
            "1500px",

          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap:
              "20px",

            flexWrap:
              "wrap",

            marginBottom:
              "24px",
          }}
        >
          <div>
            <h1
              style={{
                margin:
                  "0 0 8px",

                fontSize:
                  "30px",

                fontWeight:
                  900,
              }}
            >
              Coinlytx Trading
              Intelligence
            </h1>

            <p
              style={{
                margin: 0,

                color:
                  "#64748b",

                maxWidth:
                  "850px",

                lineHeight:
                  1.6,
              }}
            >
              Top 50 liquid
              markets with
              technical,
              derivatives,
              order flow,
              coin-specific whale,
              stablecoin,
              news/catalyst, macro
              regime and multi-timeframe
              intelligence.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(
                true
              );

              loadData();

              loadMarkets();
            }}
            style={{
              padding:
                "10px 16px",

              borderRadius:
                "10px",

              border:
                "1px solid #cbd5e1",

              background:
                "#ffffff",

              color:
                "#0f172a",

              fontWeight:
                800,

              cursor:
                "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {/* Market Selector */}

        <section
          style={{
            background:
              "#ffffff",

            border:
              "1px solid #e2e8f0",

            borderRadius:
              "18px",

            padding:
              "18px",

            marginBottom:
              "20px",

            position:
              "relative",
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              flexWrap:
                "wrap",

              gap:
                "14px",
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "#64748b",

                  fontSize:
                    "12px",

                  fontWeight:
                    800,

                  marginBottom:
                    "4px",
                }}
              >
                SELECTED MARKET
              </div>

              <div
                style={{
                  fontSize:
                    "25px",

                  fontWeight:
                    900,
                }}
              >
                {selectedMarket
                  ?.baseAsset ||
                  symbol.replace(
                    "USDT",
                    ""
                  )}
                /USDT
              </div>

              {selectedMarket && (
                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "12px",

                    flexWrap:
                      "wrap",

                    marginTop:
                      "5px",

                    color:
                      "#64748b",

                    fontSize:
                      "13px",
                  }}
                >
                  <span>
                    {
                      formatPrice(
                        selectedMarket.price
                      )
                    }
                  </span>

                  <span
                    style={{
                      color:
                        selectedMarket.change24h >=
                        0
                          ? "#15803d"
                          : "#b91c1c",

                      fontWeight:
                        800,
                    }}
                  >
                    {
                      selectedMarket.change24h >
                      0
                        ? "+"
                        : ""
                    }

                    {
                      selectedMarket.change24h.toFixed(
                        2
                      )
                    }
                    %
                  </span>

                  <span>
                    Vol{" "}
                    {
                      formatLargeUsd(
                        selectedMarket.quoteVolume24h
                      )
                    }
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setMarketPickerOpen(
                  (
                    current
                  ) =>
                    !current
                )
              }
              style={{
                minWidth:
                  "210px",

                padding:
                  "12px 16px",

                borderRadius:
                  "11px",

                border:
                  "1px solid #cbd5e1",

                background:
                  "#ffffff",

                color:
                  "#0f172a",

                cursor:
                  "pointer",

                fontWeight:
                  800,

                textAlign:
                  "left",
              }}
            >
              🔍 Search Top 50
              Coins
            </button>
          </div>

          {marketPickerOpen && (
            <div
              style={{
                marginTop:
                  "16px",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "14px",

                background:
                  "#ffffff",

                overflow:
                  "hidden",
              }}
            >
              <div
                style={{
                  padding:
                    "12px",

                  borderBottom:
                    "1px solid #e2e8f0",
                }}
              >
                <input
                  autoFocus
                  value={
                    marketSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setMarketSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search BTC, DOGE, ADA, LINK..."
                  style={{
                    width:
                      "100%",

                    padding:
                      "12px 14px",

                    borderRadius:
                      "10px",

                    border:
                      "1px solid #cbd5e1",

                    background:
                      "#ffffff",

                    color:
                      "#0f172a",

                    fontSize:
                      "14px",

                    outline:
                      "none",

                    boxSizing:
                      "border-box",
                  }}
                />
              </div>

              {marketsLoading ? (
                <div
                  style={{
                    padding:
                      "25px",

                    textAlign:
                      "center",

                    color:
                      "#64748b",
                  }}
                >
                  Loading Top 50
                  markets...
                </div>
              ) : marketsError ? (
                <div
                  style={{
                    padding:
                      "18px",

                    color:
                      "#991b1b",

                    background:
                      "#fef2f2",
                  }}
                >
                  {
                    marketsError
                  }
                </div>
              ) : (
                <div
                  style={{
                    maxHeight:
                      "360px",

                    overflowY:
                      "auto",

                    overflowX:
                      "auto",
                  }}
                >
                  {filteredMarkets.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          "20px",

                        textAlign:
                          "center",

                        color:
                          "#64748b",
                      }}
                    >
                      No market
                      found.
                    </div>
                  ) : (
                    filteredMarkets.map(
                      (
                        market,
                        index
                      ) => {
                        const active =
                          market.symbol ===
                          symbol;

                        return (
                          <button
                            key={
                              market.symbol
                            }
                            type="button"
                            onClick={() => {
                              setSymbol(
                                market.symbol
                              );

                              setMarketPickerOpen(
                                false
                              );

                              setMarketSearch(
                                ""
                              );

                              setLoading(
                                true
                              );
                            }}
                            style={{
                              width:
                                "100%",

                              minWidth:
                                "600px",

                              display:
                                "grid",

                              gridTemplateColumns:
                                "45px minmax(90px, 1fr) minmax(100px, 1fr) 90px 110px",

                              alignItems:
                                "center",

                              gap:
                                "10px",

                              textAlign:
                                "left",

                              border:
                                "none",

                              borderBottom:
                                "1px solid #f1f5f9",

                              background:
                                active
                                  ? "#f1f5f9"
                                  : "#ffffff",

                              padding:
                                "12px 14px",

                              cursor:
                                "pointer",

                              color:
                                "#0f172a",
                            }}
                          >
                            <span
                              style={{
                                color:
                                  "#94a3b8",

                                fontSize:
                                  "12px",
                              }}
                            >
                              #
                              {
                                index +
                                1
                              }
                            </span>

                            <strong>
                              {
                                market.baseAsset
                              }
                            </strong>

                            <span>
                              {
                                formatPrice(
                                  market.price
                                )
                              }
                            </span>

                            <span
                              style={{
                                color:
                                  market.change24h >=
                                  0
                                    ? "#15803d"
                                    : "#b91c1c",

                                fontWeight:
                                  800,
                              }}
                            >
                              {
                                market.change24h >
                                0
                                  ? "+"
                                  : ""
                              }

                              {
                                market.change24h.toFixed(
                                  2
                                )
                              }
                              %
                            </span>

                            <span
                              style={{
                                color:
                                  "#64748b",

                                fontSize:
                                  "12px",
                              }}
                            >
                              {
                                formatLargeUsd(
                                  market.quoteVolume24h
                                )
                              }
                            </span>
                          </button>
                        );
                      }
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Timeframe Buttons */}

        <div
          style={{
            display:
              "flex",

            flexWrap:
              "wrap",

            gap:
              "8px",

            marginBottom:
              "24px",
          }}
        >
          {INTERVALS.map(
            (
              item
            ) => {
              const active =
                interval ===
                item;

              return (
                <button
                  key={
                    item
                  }
                  type="button"
                  onClick={() =>
                    setInterval(
                      item
                    )
                  }
                  style={{
                    border:
                      active
                        ? "1px solid #334155"
                        : "1px solid #e2e8f0",

                    background:
                      active
                        ? "#0f172a"
                        : "#ffffff",

                    color:
                      active
                        ? "#ffffff"
                        : "#334155",

                    padding:
                      "9px 15px",

                    borderRadius:
                      "8px",

                    cursor:
                      "pointer",

                    fontWeight:
                      800,
                  }}
                >
                  {item}
                </button>
              );
            }
          )}
        </div>

        {error && (
          <div
            style={{
              padding:
                "14px",

              marginBottom:
                "20px",

              borderRadius:
                "12px",

              background:
                "#fef2f2",

              border:
                "1px solid #fecaca",

              color:
                "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {loading &&
        !data ? (
          <div
            style={{
              background:
                "#ffffff",

              border:
                "1px solid #e2e8f0",

              padding:
                "50px",

              borderRadius:
                "18px",

              textAlign:
                "center",

              color:
                "#64748b",
            }}
          >
            Analyzing{" "}
            {
              symbol.replace(
                "USDT",
                ""
              )
            }
            ...
          </div>
        ) : data ? (
          <>
            {/* Final Decision */}

            <section
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",

                gap:
                  "14px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  background:
                    finalColors
                      ?.background,

                  border:
                    `1px solid ${finalColors?.border}`,

                  borderRadius:
                    "16px",

                  padding:
                    "20px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "12px",

                    fontWeight:
                      900,

                    color:
                      "#64748b",

                    marginBottom:
                      "7px",
                  }}
                >
                  FINAL DECISION
                </div>

                <div
                  style={{
                    fontSize:
                      "34px",

                    fontWeight:
                      900,

                    color:
                      finalColors
                        ?.color,
                  }}
                >
                  {
                    data.finalDecision
                  }
                </div>
              </div>

              <MetricCard
                label="Market"
                value={
                  data.symbol.replace(
                    "USDT",
                    ""
                  ) +
                  "/USDT"
                }
              />

              <MetricCard
                label="Price"
                value={formatPrice(
                  data.currentPrice
                )}
              />

              <MetricCard
                label="Decision Score"
                value={`${data.decisionScore}`}
                sub="-100 to +100"
              />

              <MetricCard
                label="Confidence"
                value={`${data.confidence}%`}
                sub="Heuristic, not win probability"
              />

              <MetricCard
                label="Primary Timeframe"
                value={
                  data.interval
                }
              />
            </section>

            {/* Multi-Timeframe */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  flexWrap:
                    "wrap",

                  gap:
                    "14px",

                  marginBottom:
                    "18px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin:
                        "0 0 5px",

                      fontSize:
                        "21px",
                    }}
                  >
                    Multi-Timeframe
                    Analysis
                  </h2>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "13px",
                    }}
                  >
                    1m, 5m, 15m,
                    1h, 4h and 1d
                    analyzed together.
                  </div>
                </div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "12px",

                      color:
                        "#64748b",
                    }}
                  >
                    CONSENSUS
                  </div>

                  <div
                    style={{
                      fontWeight:
                        900,

                      fontSize:
                        "20px",

                      color:
                        signalColors(
                          data
                            .multiTimeframe
                            .consensusSignal
                        ).color,
                    }}
                  >
                    {
                      data
                        .multiTimeframe
                        .consensusSignal
                    }
                  </div>
                </div>
              </div>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",

                  gap:
                    "12px",
                }}
              >
                {data.multiTimeframe.timeframes.map(
                  (
                    item
                  ) => (
                    <TimeframeCard
                      key={
                        item.interval
                      }
                      item={
                        item
                      }
                      selected={
                        interval ===
                        item.interval
                      }
                      onClick={() =>
                        setInterval(
                          item.interval as IntervalType
                        )
                      }
                    />
                  )
                )}
              </div>
            </section>

            {/* Trend Summary */}

            <section
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",

                gap:
                  "14px",

                marginBottom:
                  "22px",
              }}
            >
              <MetricCard
                label="MTF Score"
                value={`${data.multiTimeframe.weightedScore}`}
              />

              <MetricCard
                label="MTF Confidence"
                value={`${data.multiTimeframe.confidence}%`}
              />

              <MetricCard
                label="Alignment"
                value={
                  data
                    .multiTimeframe
                    .alignment
                    .replaceAll(
                      "_",
                      " "
                    )
                }
              />

              <MetricCard
                label="Short-Term Trend"
                value={
                  data
                    .multiTimeframe
                    .shortTermTrend
                }
                sub={`Score ${data.multiTimeframe.shortTermScore}`}
              />

              <MetricCard
                label="1h / 4h / 1d Trend"
                value={
                  data
                    .multiTimeframe
                    .higherTimeframeTrend
                }
                sub={`Score ${data.multiTimeframe.higherTimeframeScore}`}
              />
            </section>

            {/* Final Decision Engine */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 6px",

                  fontSize:
                    "20px",
                }}
              >
                Final Decision
                Engine
              </h2>

              <p
                style={{
                  margin:
                    "0 0 16px",

                  color:
                    "#64748b",

                  fontSize:
                    "13px",
                }}
              >
                Primary
                intelligence is
                combined with
                six-timeframe
                confirmation.
              </p>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",

                  gap:
                    "12px",
                }}
              >
                <MetricCard
                  label="Primary Signal"
                  value={
                    data
                      .selectedTimeframe
                      .signal
                  }
                  sub={`Score ${data.selectedTimeframe.score}`}
                />

                <MetricCard
                  label="Technical"
                  value={`${data.selectedTimeframe.technicalScore}`}
                  sub={`${data.intelligenceWeights.technical}% weight`}
                />

                <MetricCard
                  label="Derivatives"
                  value={`${data.selectedTimeframe.derivativesScore}`}
                  sub={`${data.intelligenceWeights.derivatives}% weight`}
                />

                <MetricCard
                  label="Whale"
                  value={`${data.selectedTimeframe.whaleScore}`}
                  sub={`${data.intelligenceWeights.whale}% weight`}
                />

                <MetricCard
                  label="Stablecoin"
                  value={`${data.selectedTimeframe.stablecoinScore}`}
                  sub={`${data.intelligenceWeights.stablecoin}% weight`}
                />

                <MetricCard
                  label="Catalyst"
                  value={`${data.selectedTimeframe.catalystScore}`}
                  sub={`${data.intelligenceWeights.catalyst}% weight`}
                />

                <MetricCard
                  label="Macro Regime"
                  value={`${data.selectedTimeframe.macroScore}`}
                  sub={`${data.intelligenceWeights.macro}% weight`}
                />

                <MetricCard
                  label="Primary Engine Weight"
                  value={`${data.decisionWeights.selectedSignal}%`}
                />

                <MetricCard
                  label="MTF Engine Weight"
                  value={`${data.decisionWeights.multiTimeframe}%`}
                />
              </div>
            </section>

            {/* Intelligence Contributions */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 16px",

                  fontSize:
                    "20px",
                }}
              >
                Intelligence
                Contributions
              </h2>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",

                  gap:
                    "12px",
                }}
              >
                <MetricCard
                  label="Technical Contribution"
                  value={`${data.intelligenceScores.technicalContribution}`}
                  sub={`Raw ${data.intelligenceScores.technical}`}
                />

                <MetricCard
                  label="Derivatives Contribution"
                  value={`${data.intelligenceScores.derivativesContribution}`}
                  sub={`Raw ${data.intelligenceScores.derivatives}`}
                />

                <MetricCard
                  label="Whale Contribution"
                  value={`${data.intelligenceScores.whaleContribution}`}
                  sub={`Raw ${data.intelligenceScores.whale}`}
                />

                <MetricCard
                  label="Stablecoin Contribution"
                  value={`${data.intelligenceScores.stablecoinContribution}`}
                  sub={`Raw ${data.intelligenceScores.stablecoin}`}
                />

                <MetricCard
                  label="Catalyst Contribution"
                  value={`${data.intelligenceScores.catalystContribution}`}
                  sub={`Weighted score ${data.intelligenceScores.catalyst}`}
                />

                <MetricCard
                  label="Macro Contribution"
                  value={`${data.intelligenceScores.macroContribution}`}
                  sub={`Weighted score ${data.intelligenceScores.macro}`}
                />
              </div>
            </section>

            {/* Trade Plan + Market Structure */}

            <section
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(330px, 1fr))",

                gap:
                  "18px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  background:
                    "#ffffff",

                  border:
                    "1px solid #e2e8f0",

                  borderRadius:
                    "18px",

                  padding:
                    "20px",
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 16px",

                    fontSize:
                      "20px",
                  }}
                >
                  Trade Plan
                </h2>

                {data.finalDecision ===
                "WAIT" ? (
                  <div
                    style={{
                      background:
                        "#fffbeb",

                      border:
                        "1px solid #fde68a",

                      color:
                        "#92400e",

                      padding:
                        "18px",

                      borderRadius:
                        "12px",
                    }}
                  >
                    No trade setup
                    issued while the
                    final decision is
                    WAIT.
                  </div>
                ) : (
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",

                      gap:
                        "12px",
                    }}
                  >
                    <MetricCard
                      label="Entry Low"
                      value={formatPrice(
                        data
                          .tradePlan
                          .entryLow
                      )}
                    />

                    <MetricCard
                      label="Entry High"
                      value={formatPrice(
                        data
                          .tradePlan
                          .entryHigh
                      )}
                    />

                    <MetricCard
                      label="Stop Loss"
                      value={formatPrice(
                        data
                          .tradePlan
                          .stopLoss
                      )}
                    />

                    <MetricCard
                      label="TP1"
                      value={formatPrice(
                        data
                          .tradePlan
                          .tp1
                      )}
                    />

                    <MetricCard
                      label="TP2"
                      value={formatPrice(
                        data
                          .tradePlan
                          .tp2
                      )}
                    />

                    <MetricCard
                      label="TP3"
                      value={formatPrice(
                        data
                          .tradePlan
                          .tp3
                      )}
                    />

                    <MetricCard
                      label="Invalidation"
                      value={formatPrice(
                        data
                          .tradePlan
                          .invalidation
                      )}
                    />

                    <MetricCard
                      label="Risk / Reward"
                      value={
                        data
                          .tradePlan
                          .riskReward ||
                        "—"
                      }
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  background:
                    "#ffffff",

                  border:
                    "1px solid #e2e8f0",

                  borderRadius:
                    "18px",

                  padding:
                    "20px",
                }}
              >
                <h2
                  style={{
                    margin:
                      "0 0 16px",

                    fontSize:
                      "20px",
                  }}
                >
                  Market Structure
                </h2>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",

                    gap:
                      "12px",
                  }}
                >
                  <MetricCard
                    label="Support"
                    value={formatPrice(
                      data
                        .marketStructure
                        .support
                    )}
                  />

                  <MetricCard
                    label="Resistance"
                    value={formatPrice(
                      data
                        .marketStructure
                        .resistance
                    )}
                  />

                  <MetricCard
                    label="RSI"
                    value={`${data.marketStructure.rsi}`}
                  />

                  <MetricCard
                    label="ATR"
                    value={`${data.marketStructure.atr}`}
                  />

                  <MetricCard
                    label="Pattern"
                    value={
                      data
                        .marketStructure
                        .candlePattern
                    }
                  />
                </div>
              </div>
            </section>

            {/* Derivatives */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "center",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "16px",
                }}
              >
                <h2
                  style={{
                    margin: 0,

                    fontSize:
                      "20px",
                  }}
                >
                  Derivatives &
                  Order Flow
                </h2>

                <span
                  style={{
                    padding:
                      "7px 12px",

                    borderRadius:
                      "999px",

                    background:
                      biasBackground(
                        data
                          .derivatives
                          .bias
                      ),

                    color:
                      biasColor(
                        data
                          .derivatives
                          .bias
                      ),

                    fontWeight:
                      900,

                    fontSize:
                      "13px",
                  }}
                >
                  {
                    data
                      .derivatives
                      .bias
                  }
                </span>
              </div>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(170px, 1fr))",

                  gap:
                    "12px",
                }}
              >
                <MetricCard
                  label="Funding"
                  value={`${data.derivatives.fundingPercent}%`}
                />

                <MetricCard
                  label="OI Change"
                  value={`${data.derivatives.openInterestChangePercent}%`}
                />

                <MetricCard
                  label="Book Imbalance"
                  value={`${data.derivatives.orderBookImbalancePercent}%`}
                />

                <MetricCard
                  label="Taker Buy/Sell"
                  value={`${data.derivatives.takerBuySellRatio}`}
                />

                <MetricCard
                  label="Long/Short"
                  value={`${data.derivatives.longShortRatio}`}
                />

                <MetricCard
                  label="Basis"
                  value={`${data.derivatives.basisPercent}%`}
                />
              </div>
            </section>

            {/* Whale Intelligence */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "flex-start",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "16px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin:
                        "0 0 5px",

                      fontSize:
                        "20px",
                    }}
                  >
                    {whaleSourceTitle}
                  </h2>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.5,
                    }}
                  >
                    {data
                      .whaleIntelligence
                      .source ===
                    "ETH_NATIVE"
                      ? "Native ETH transfers are analyzed with known exchange-wallet attribution."
                      : data
                            .whaleIntelligence
                            .source ===
                          "ERC20"
                        ? "Large ERC-20 transfers are route-adjusted, attributed to known exchange wallets and used only when flow quality is meaningful."
                        : "No verified coin-specific whale source is currently connected for this market."}
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "8px",

                    alignItems:
                      "center",

                    flexWrap:
                      "wrap",
                  }}
                >
                  <span
                    style={{
                      padding:
                        "7px 11px",

                      borderRadius:
                        "999px",

                      background:
                        data
                          .whaleIntelligence
                          .supportedForSymbol
                          ? "#eff6ff"
                          : "#f1f5f9",

                      color:
                        data
                          .whaleIntelligence
                          .supportedForSymbol
                          ? "#1d4ed8"
                          : "#64748b",

                      border:
                        data
                          .whaleIntelligence
                          .supportedForSymbol
                          ? "1px solid #bfdbfe"
                          : "1px solid #e2e8f0",

                      fontWeight:
                        900,

                      fontSize:
                        "12px",
                    }}
                  >
                    {whaleSourceBadge}
                  </span>

                  <span
                    style={{
                      padding:
                        "7px 11px",

                      borderRadius:
                        "999px",

                      background:
                        biasBackground(
                          data
                            .whaleIntelligence
                            .bias
                        ),

                      color:
                        biasColor(
                          data
                            .whaleIntelligence
                            .bias
                        ),

                      fontWeight:
                        900,

                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      data
                        .whaleIntelligence
                        .bias
                    }
                  </span>
                </div>
              </div>

              {!data
                .whaleIntelligence
                .supportedForSymbol ? (
                <div
                  style={{
                    padding:
                      "16px",

                    borderRadius:
                      "12px",

                    background:
                      "#f8fafc",

                    border:
                      "1px solid #e2e8f0",

                    color:
                      "#64748b",

                    lineHeight:
                      1.6,
                  }}
                >
                  Coin-specific whale
                  data is currently
                  unavailable for{" "}
                  <strong>
                    {
                      data.symbol.replace(
                        "USDT",
                        ""
                      )
                    }
                  </strong>
                  . Whale influence is
                  excluded from the
                  trading score instead
                  of being estimated or
                  replaced with another
                  coin&apos;s data.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",

                      gap:
                        "12px",

                      marginBottom:
                        "16px",
                    }}
                  >
                    <MetricCard
                      label="Whale Source"
                      value={
                        data
                          .whaleIntelligence
                          .source ===
                        "ETH_NATIVE"
                          ? "Native ETH"
                          : "ERC-20"
                      }
                      sub={
                        data
                          .whaleIntelligence
                          .source ===
                        "ERC20"
                          ? `${data.symbol.replace(
                              "USDT",
                              ""
                            )} token transfers`
                          : "Ethereum native transfers"
                      }
                    />

                    <MetricCard
                      label="Whale Bias"
                      value={
                        data
                          .whaleIntelligence
                          .bias
                      }
                      sub={
                        data
                          .whaleIntelligence
                          .meaningfulFlow
                          ? "Meaningful directional flow"
                          : "Not strong enough for directional weight"
                      }
                    />

                    <MetricCard
                      label="Whale Score"
                      value={`${data.whaleIntelligence.whaleScore}`}
                      sub="-100 to +100"
                    />

                    <MetricCard
                      label="Whale Weight"
                      value={`${data.intelligenceWeights.whale}%`}
                      sub={
                        data
                          .intelligenceWeights
                          .whale >
                        0
                          ? "Active in selected signal"
                          : "Currently excluded from score"
                      }
                    />

                    <MetricCard
                      label="Whale Contribution"
                      value={`${data.intelligenceScores.whaleContribution}`}
                      sub={`Approx. ${whaleDecisionContribution.toFixed(
                        2
                      )} after ${data.decisionWeights.selectedSignal}% final-engine weighting`}
                    />

                    <MetricCard
                      label="Meaningful Flow"
                      value={
                        data
                          .whaleIntelligence
                          .meaningfulFlow
                          ? "YES"
                          : "NO"
                      }
                      sub={
                        data
                          .whaleIntelligence
                          .meaningfulFlow
                          ? "Eligible for controlled whale weighting"
                          : "Displayed for context only"
                      }
                    />

                    <MetricCard
                      label="Net Exchange Flow"
                      value={formatLargeUsd(
                        data
                          .whaleIntelligence
                          .netExchangeFlowUsd
                      )}
                      sub={
                        data
                          .whaleIntelligence
                          .netExchangeFlowUsd >
                        0
                          ? "Net exchange outflow"
                          : data
                                .whaleIntelligence
                                .netExchangeFlowUsd <
                              0
                            ? "Net exchange inflow"
                            : "Balanced"
                      }
                    />

                    <MetricCard
                      label="Exchange Inflow"
                      value={formatLargeUsd(
                        data
                          .whaleIntelligence
                          .exchangeInflowUsd
                      )}
                      sub={`${data.whaleIntelligence.exchangeInflows} events`}
                    />

                    <MetricCard
                      label="Exchange Outflow"
                      value={formatLargeUsd(
                        data
                          .whaleIntelligence
                          .exchangeOutflowUsd
                      )}
                      sub={`${data.whaleIntelligence.exchangeOutflows} events`}
                    />

                    <MetricCard
                      label="Directional Events"
                      value={`${data.whaleIntelligence.directionalEvents}`}
                      sub={`${data.whaleIntelligence.observedEvents} total observed`}
                    />

                    <MetricCard
                      label="Attribution Coverage"
                      value={
                        data
                          .whaleIntelligence
                          .source ===
                        "ERC20"
                          ? `${data.whaleIntelligence.classificationCoveragePercent}%`
                          : "Native ETH"
                      }
                      sub={
                        data
                          .whaleIntelligence
                          .source ===
                        "ERC20"
                          ? "Known exchange-wallet coverage"
                          : "Native tracker uses exchange attribution"
                      }
                    />

                    <MetricCard
                      label="Largest Transfer"
                      value={formatLargeUsd(
                        data
                          .whaleIntelligence
                          .largestTransferUsd
                      )}
                    />
                  </div>

                  <div
                    style={{
                      padding:
                        "14px",

                      borderRadius:
                        "12px",

                      background:
                        data
                          .whaleIntelligence
                          .source ===
                          "ERC20" &&
                        data
                          .whaleIntelligence
                          .classificationCoveragePercent <
                          40
                          ? "#fffbeb"
                          : "#f8fafc",

                      border:
                        data
                          .whaleIntelligence
                          .source ===
                          "ERC20" &&
                        data
                          .whaleIntelligence
                          .classificationCoveragePercent <
                          40
                          ? "1px solid #fde68a"
                          : "1px solid #e2e8f0",

                      color:
                        data
                          .whaleIntelligence
                          .source ===
                          "ERC20" &&
                        data
                          .whaleIntelligence
                          .classificationCoveragePercent <
                          40
                          ? "#92400e"
                          : "#475569",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.6,
                    }}
                  >
                    {data
                      .whaleIntelligence
                      .source ===
                    "ERC20"
                      ? data
                            .whaleIntelligence
                            .classificationCoveragePercent <
                          20
                        ? `Only ${data.whaleIntelligence.classificationCoveragePercent}% of large ${data.symbol.replace(
                            "USDT",
                            ""
                          )} transfers were attributed to known exchange wallets. ERC-20 whale flow is excluded from directional weighting below the required coverage threshold.`
                        : data
                              .whaleIntelligence
                              .classificationCoveragePercent <
                            40
                          ? `Attribution coverage is ${data.whaleIntelligence.classificationCoveragePercent}%. ERC-20 whale influence is therefore limited to the lower controlled weight when the flow is meaningful.`
                          : `Attribution coverage is ${data.whaleIntelligence.classificationCoveragePercent}%. Meaningful ERC-20 whale flow can receive up to 12% of the selected-signal weight, but it cannot overpower technical and derivatives analysis.`
                      : "Native ETH whale flow is used only as a controlled confirmation layer. Exchange inflow or outflow is not proof that a wallet will immediately sell or buy."}
                  </div>
                </>
              )}
            </section>

            {/* Stablecoin Liquidity */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "center",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "16px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin:
                        "0 0 5px",

                      fontSize:
                        "20px",
                    }}
                  >
                    Stablecoin
                    Liquidity
                  </h2>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "13px",
                    }}
                  >
                    USDT + USDC
                    exchange
                    inflow/outflow
                    intelligence.
                  </div>
                </div>

                <div
                  style={{
                    padding:
                      "8px 13px",

                    borderRadius:
                      "999px",

                    fontWeight:
                      900,

                    background:
                      biasBackground(
                        data
                          .stablecoinLiquidity
                          .bias
                      ),

                    color:
                      biasColor(
                        data
                          .stablecoinLiquidity
                          .bias
                      ),
                  }}
                >
                  {
                    data
                      .stablecoinLiquidity
                      .bias
                  }
                </div>
              </div>

              {!data
                .stablecoinLiquidity
                .available ? (
                <div
                  style={{
                    padding:
                      "18px",

                    borderRadius:
                      "12px",

                    background:
                      "#f8fafc",

                    color:
                      "#64748b",
                  }}
                >
                  Stablecoin
                  liquidity
                  intelligence is
                  currently
                  unavailable.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",

                      gap:
                        "12px",

                      marginBottom:
                        "16px",
                    }}
                  >
                    <MetricCard
                      label="Stablecoin Score"
                      value={`${data.stablecoinLiquidity.score}`}
                      sub={`Weight ${data.intelligenceWeights.stablecoin}%`}
                    />

                    <MetricCard
                      label="Net Exchange Liquidity"
                      value={formatLargeUsd(
                        data
                          .stablecoinLiquidity
                          .netExchangeLiquidityUsd
                      )}
                      sub={
                        data
                          .stablecoinLiquidity
                          .netExchangeLiquidityUsd >
                        0
                          ? "More stablecoins entered exchanges"
                          : data
                                .stablecoinLiquidity
                                .netExchangeLiquidityUsd <
                              0
                            ? "More stablecoins left exchanges"
                            : "Balanced"
                      }
                    />

                    <MetricCard
                      label="Exchange Inflow"
                      value={formatLargeUsd(
                        data
                          .stablecoinLiquidity
                          .exchangeInflowUsd
                      )}
                      sub={`${data.stablecoinLiquidity.exchangeInflows} events`}
                    />

                    <MetricCard
                      label="Exchange Outflow"
                      value={formatLargeUsd(
                        data
                          .stablecoinLiquidity
                          .exchangeOutflowUsd
                      )}
                      sub={`${data.stablecoinLiquidity.exchangeOutflows} events`}
                    />

                    <MetricCard
                      label="Directional Events"
                      value={`${data.stablecoinLiquidity.directionalEvents}`}
                      sub={`of ${data.stablecoinLiquidity.totalEvents} observed`}
                    />

                    <MetricCard
                      label="Classified Events"
                      value={`${data.stablecoinLiquidity.classifiedEvents}`}
                      sub={`${data.stablecoinLiquidity.unclassifiedEvents} unclassified`}
                    />

                    <MetricCard
                      label="Attribution Coverage"
                      value={`${data.stablecoinLiquidity.classificationCoveragePercent}%`}
                    />

                    <MetricCard
                      label="Observed Stablecoins"
                      value={formatLargeUsd(
                        data
                          .stablecoinLiquidity
                          .totalObservedUsd
                      )}
                    />

                    <MetricCard
                      label="Raw Stablecoin Score"
                      value={`${data.stablecoinLiquidity.rawScore}`}
                    />

                    <MetricCard
                      label="Score Contribution"
                      value={`${data.intelligenceScores.stablecoinContribution}`}
                      sub="Actual contribution to selected signal"
                    />
                  </div>

                  <div
                    style={{
                      padding:
                        "14px",

                      borderRadius:
                        "12px",

                      background:
                        data
                          .stablecoinLiquidity
                          .classificationCoveragePercent <
                        25
                          ? "#fffbeb"
                          : "#f8fafc",

                      border:
                        data
                          .stablecoinLiquidity
                          .classificationCoveragePercent <
                        25
                          ? "1px solid #fde68a"
                          : "1px solid #e2e8f0",

                      color:
                        data
                          .stablecoinLiquidity
                          .classificationCoveragePercent <
                        25
                          ? "#92400e"
                          : "#475569",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.6,
                    }}
                  >
                    {data
                      .stablecoinLiquidity
                      .classificationCoveragePercent <
                    25
                      ? `Low attribution coverage: only ${data.stablecoinLiquidity.classificationCoveragePercent}% of recent large stablecoin transfers were connected to known exchange wallets. Stablecoin intelligence therefore remains a low-weight confirmation signal.`
                      : "Stablecoin exchange flows are used as liquidity confirmation only. A stablecoin deposit does not prove traders will immediately buy crypto."}
                  </div>
                </>
              )}
            </section>


            {/* News + Catalyst Intelligence */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "flex-start",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "16px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin:
                        "0 0 5px",

                      fontSize:
                        "20px",
                    }}
                  >
                    News & Catalyst
                    Intelligence
                  </h2>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.5,

                      maxWidth:
                        "900px",
                    }}
                  >
                    Coin-specific news,
                    official Binance
                    announcements and
                    market-wide crypto
                    context are analyzed
                    separately, then fused
                    through controlled
                    catalyst weighting.
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "8px",

                    flexWrap:
                      "wrap",

                    alignItems:
                      "center",
                  }}
                >
                  <span
                    style={{
                      padding:
                        "8px 13px",

                      borderRadius:
                        "999px",

                      fontWeight:
                        900,

                      fontSize:
                        "12px",

                      background:
                        data.catalystIntelligence.available
                          ? biasBackground(
                              data.catalystIntelligence.bias
                            )
                          : "#f1f5f9",

                      color:
                        data.catalystIntelligence.available
                          ? biasColor(
                              data.catalystIntelligence.bias
                            )
                          : "#64748b",
                    }}
                  >
                    {data.catalystIntelligence.available
                      ? data.catalystIntelligence.bias
                      : "UNAVAILABLE"}
                  </span>

                  <span
                    style={{
                      padding:
                        "8px 13px",

                      borderRadius:
                        "999px",

                      fontWeight:
                        900,

                      fontSize:
                        "12px",

                      background:
                        data.intelligenceWeights.catalyst > 0
                          ? "#dbeafe"
                          : "#f1f5f9",

                      color:
                        data.intelligenceWeights.catalyst > 0
                          ? "#1d4ed8"
                          : "#64748b",
                    }}
                  >
                    {data.intelligenceWeights.catalyst > 0
                      ? "WEIGHT ACTIVE"
                      : "CONTEXT ONLY"}
                  </span>
                </div>
              </div>

              {!data.catalystIntelligence.available ? (
                <div
                  style={{
                    padding:
                      "18px",

                    borderRadius:
                      "12px",

                    background:
                      "#f8fafc",

                    border:
                      "1px solid #e2e8f0",

                    color:
                      "#64748b",

                    lineHeight:
                      1.6,
                  }}
                >
                  Catalyst intelligence is currently unavailable. The
                  catalyst weight stays at 0% and does not dilute the
                  other working trading modules.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",

                      gap:
                        "12px",

                      marginBottom:
                        "18px",
                    }}
                  >
                    <MetricCard
                      label="Overall Catalyst Score"
                      value={`${data.catalystIntelligence.score}`}
                      sub={`Active trading weight ${data.intelligenceWeights.catalyst}%`}
                    />

                    <MetricCard
                      label="Raw Catalyst Score"
                      value={`${data.catalystIntelligence.rawScore}`}
                      sub="Before controlled signal weighting"
                    />

                    <MetricCard
                      label="Signal Contribution"
                      value={`${data.intelligenceScores.catalystContribution}`}
                      sub="Contribution inside selected signal"
                    />

                    <MetricCard
                      label="Final Engine Contribution"
                      value={`${Number(
                        catalystDecisionContribution.toFixed(2)
                      )}`}
                      sub={`${data.decisionWeights.selectedSignal}% selected-engine pass-through`}
                    />

                    <MetricCard
                      label="Catalyst Confidence"
                      value={`${data.catalystIntelligence.confidence}%`}
                      sub="Heuristic, not win probability"
                    />

                    <MetricCard
                      label="Meaningful Catalyst"
                      value={
                        data.catalystIntelligence.meaningfulCatalyst
                          ? "YES"
                          : "NO"
                      }
                      sub={
                        data.intelligenceWeights.catalyst > 0
                          ? "Eligible for controlled trading weight"
                          : "No directional catalyst weight for this reading"
                      }
                    />

                    <MetricCard
                      label="Catalysts Retained"
                      value={`${data.catalystIntelligence.totalCatalysts}`}
                      sub={`${data.catalystIntelligence.highImpactCatalysts} high impact`}
                    />

                    <MetricCard
                      label="Directional Mix"
                      value={`${data.catalystIntelligence.bullishCatalysts} / ${data.catalystIntelligence.bearishCatalysts}`}
                      sub="Bullish / bearish retained catalysts"
                    />
                  </div>

                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(320px, 1fr))",

                      gap:
                        "16px",

                      marginBottom:
                        "16px",
                    }}
                  >
                    <div
                      style={{
                        border:
                          "1px solid #e2e8f0",

                        borderRadius:
                          "16px",

                        padding:
                          "16px",

                        background:
                          "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          alignItems:
                            "center",

                          gap:
                            "10px",

                          flexWrap:
                            "wrap",

                          marginBottom:
                            "14px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight:
                                900,

                              color:
                                "#0f172a",

                              fontSize:
                                "16px",
                            }}
                          >
                            Coin-Specific Catalyst
                          </div>

                          <div
                            style={{
                              color:
                                "#64748b",

                              fontSize:
                                "12px",

                              marginTop:
                                "4px",
                            }}
                          >
                            Selected asset news + official Binance events
                          </div>
                        </div>

                        <span
                          style={{
                            padding:
                              "6px 10px",

                            borderRadius:
                              "999px",

                            background:
                              data.catalystIntelligence.coinSpecificAvailable
                                ? biasBackground(
                                    data.catalystIntelligence.coinSpecificBias ??
                                      "NEUTRAL"
                                  )
                                : "#f1f5f9",

                            color:
                              data.catalystIntelligence.coinSpecificAvailable
                                ? biasColor(
                                    data.catalystIntelligence.coinSpecificBias ??
                                      "NEUTRAL"
                                  )
                                : "#64748b",

                            fontWeight:
                              900,

                            fontSize:
                              "11px",
                          }}
                        >
                          {data.catalystIntelligence.coinSpecificAvailable
                            ? data.catalystIntelligence.coinSpecificBias ??
                              "NEUTRAL"
                            : "NO CURRENT MATCH"}
                        </span>
                      </div>

                      <div
                        style={{
                          display:
                            "grid",

                          gridTemplateColumns:
                            "repeat(2, minmax(0, 1fr))",

                          gap:
                            "10px",
                        }}
                      >
                        <MetricCard
                          label="Coin-Specific Score"
                          value={`${data.catalystIntelligence.coinSpecificScore ?? 0}`}
                          sub={`${data.catalystIntelligence.coinSpecificEffectiveWeight ?? 0}% effective layer weight`}
                        />

                        <MetricCard
                          label="Coin-Specific Catalysts"
                          value={`${data.catalystIntelligence.coinSpecificCatalysts ?? 0}`}
                          sub={
                            data.catalystIntelligence.coinSpecificMeaningful
                              ? "Meaningful directional evidence"
                              : "No meaningful coin-specific evidence"
                          }
                        />

                        <MetricCard
                          label="Crypto News"
                          value={`${data.catalystIntelligence.newsScore}`}
                          sub={`${data.catalystIntelligence.newsMatchedArticles} matched articles`}
                        />

                        <MetricCard
                          label="Binance Announcements"
                          value={`${data.catalystIntelligence.announcementScore}`}
                          sub={`${data.catalystIntelligence.announcementMatchedEvents} matched events`}
                        />
                      </div>

                      <div
                        style={{
                          marginTop:
                            "12px",

                          padding:
                            "12px",

                          borderRadius:
                            "10px",

                          background:
                            data.catalystIntelligence.newsRequestSucceeded &&
                            data.catalystIntelligence.announcementRequestSucceeded
                              ? "#ffffff"
                              : "#fef2f2",

                          border:
                            data.catalystIntelligence.newsRequestSucceeded &&
                            data.catalystIntelligence.announcementRequestSucceeded
                              ? "1px solid #e2e8f0"
                              : "1px solid #fecaca",

                          color:
                            "#475569",

                          fontSize:
                            "12px",

                          lineHeight:
                            1.6,
                        }}
                      >
                        News feed: {data.catalystIntelligence.newsRequestSucceeded
                          ? "working"
                          : "unavailable"}. Binance announcement feed: {data.catalystIntelligence.announcementRequestSucceeded
                          ? "working"
                          : "unavailable"}. A zero match now means no current
                        selected-coin event was found, not that the feed failed.
                      </div>
                    </div>

                    <div
                      style={{
                        border:
                          "1px solid #e2e8f0",

                        borderRadius:
                          "16px",

                        padding:
                          "16px",

                        background:
                          "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          alignItems:
                            "center",

                          gap:
                            "10px",

                          flexWrap:
                            "wrap",

                          marginBottom:
                            "14px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight:
                                900,

                              color:
                                "#0f172a",

                              fontSize:
                                "16px",
                            }}
                          >
                            Market-Wide Catalyst
                          </div>

                          <div
                            style={{
                              color:
                                "#64748b",

                              fontSize:
                                "12px",

                              marginTop:
                                "4px",
                            }}
                          >
                            Broader crypto, BTC, macro and systemic context
                          </div>
                        </div>

                        <span
                          style={{
                            padding:
                              "6px 10px",

                            borderRadius:
                              "999px",

                            background:
                              data.catalystIntelligence.marketWideAvailable
                                ? biasBackground(
                                    data.catalystIntelligence.marketWideBias ??
                                      "NEUTRAL"
                                  )
                                : "#f1f5f9",

                            color:
                              data.catalystIntelligence.marketWideAvailable
                                ? biasColor(
                                    data.catalystIntelligence.marketWideBias ??
                                      "NEUTRAL"
                                  )
                                : "#64748b",

                            fontWeight:
                              900,

                            fontSize:
                              "11px",
                          }}
                        >
                          {data.catalystIntelligence.marketWideAvailable
                            ? data.catalystIntelligence.marketWideBias ??
                              "NEUTRAL"
                            : "UNAVAILABLE"}
                        </span>
                      </div>

                      <div
                        style={{
                          display:
                            "grid",

                          gridTemplateColumns:
                            "repeat(2, minmax(0, 1fr))",

                          gap:
                            "10px",
                        }}
                      >
                        <MetricCard
                          label="Market-Wide Score"
                          value={`${data.catalystIntelligence.marketWideScore ?? 0}`}
                          sub={`${data.catalystIntelligence.marketWideEffectiveWeight ?? 0}% effective layer weight`}
                        />

                        <MetricCard
                          label="Articles Analyzed"
                          value={`${data.catalystIntelligence.marketWideMatchedArticles ?? 0}`}
                          sub={`${data.catalystIntelligence.marketWideCatalysts ?? 0} retained in catalyst summary`}
                        />

                        <MetricCard
                          label="Sources"
                          value={`${data.catalystIntelligence.marketWideAvailableSources ?? 0}/${data.catalystIntelligence.marketWideTotalSources ?? 0}`}
                          sub={
                            data.catalystIntelligence.marketWideRequestSucceeded
                              ? "Market-wide feeds responded"
                              : "One or more market-wide requests failed"
                          }
                        />

                        <MetricCard
                          label="Meaningful"
                          value={
                            data.catalystIntelligence.marketWideMeaningful
                              ? "YES"
                              : "NO"
                          }
                          sub="Directional/high-impact threshold"
                        />

                        <MetricCard
                          label="Bullish Articles"
                          value={`${data.catalystIntelligence.marketWideBullishArticles ?? 0}`}
                        />

                        <MetricCard
                          label="Bearish Articles"
                          value={`${data.catalystIntelligence.marketWideBearishArticles ?? 0}`}
                        />

                        <MetricCard
                          label="Neutral Articles"
                          value={`${data.catalystIntelligence.marketWideNeutralArticles ?? 0}`}
                        />

                        <MetricCard
                          label="High-Impact Articles"
                          value={`${data.catalystIntelligence.marketWideHighImpactArticles ?? 0}`}
                        />
                      </div>

                      <div
                        style={{
                          marginTop:
                            "12px",

                          padding:
                            "12px",

                          borderRadius:
                            "10px",

                          background:
                            data.catalystIntelligence.marketWideMeaningful
                              ? "#eff6ff"
                              : "#ffffff",

                          border:
                            data.catalystIntelligence.marketWideMeaningful
                              ? "1px solid #bfdbfe"
                              : "1px solid #e2e8f0",

                          color:
                            data.catalystIntelligence.marketWideMeaningful
                              ? "#1e40af"
                              : "#475569",

                          fontSize:
                            "12px",

                          lineHeight:
                            1.6,
                        }}
                      >
                        {data.catalystIntelligence.marketWideMeaningful
                          ? `Market-wide context is directional enough to enter catalyst fusion. Its effective layer weight is ${data.catalystIntelligence.marketWideEffectiveWeight ?? 0}%, subject to the catalyst engine's cap.`
                          : `Market-wide information is available, but it is not directional or high-impact enough to influence this ${data.symbol.replace(
                              "USDT",
                              ""
                            )} trading signal. It remains context only.`}
                      </div>
                    </div>
                  </div>

                  {(data.catalystIntelligence.marketWideSourceFailures?.length ?? 0) > 0 && (
                    <div
                      style={{
                        marginBottom:
                          "16px",
                      }}
                    >
                      <ReasonPanel
                        title="Market-Wide Source Failures"
                        items={(data.catalystIntelligence.marketWideSourceFailures ?? []).map(
                          (item) => `${item.source}: ${item.error}`
                        )}
                        type="warning"
                      />
                    </div>
                  )}

                  <div
                    style={{
                      padding:
                        "14px",

                      borderRadius:
                        "12px",

                      background:
                        data.catalystIntelligence.strongConflict
                          ? "#fef2f2"
                          : data.catalystIntelligence.conflict
                            ? "#fffbeb"
                            : data.intelligenceWeights.catalyst > 0
                              ? "#eff6ff"
                              : "#f8fafc",

                      border:
                        data.catalystIntelligence.strongConflict
                          ? "1px solid #fecaca"
                          : data.catalystIntelligence.conflict
                            ? "1px solid #fde68a"
                            : data.intelligenceWeights.catalyst > 0
                              ? "1px solid #bfdbfe"
                              : "1px solid #e2e8f0",

                      color:
                        data.catalystIntelligence.strongConflict
                          ? "#991b1b"
                          : data.catalystIntelligence.conflict
                            ? "#92400e"
                            : data.intelligenceWeights.catalyst > 0
                              ? "#1e40af"
                              : "#475569",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.6,
                    }}
                  >
                    {data.catalystIntelligence.strongConflict
                      ? "Strong catalyst conflict detected. Catalyst trading weight is disabled for this reading."
                      : data.catalystIntelligence.conflict
                        ? "Coin-specific catalyst sources currently disagree, so catalyst influence is reduced."
                        : data.intelligenceWeights.catalyst > 0
                          ? `Catalyst intelligence is active at a controlled ${data.intelligenceWeights.catalyst}% selected-signal weight. It is already included in the selected signal and is not counted again by the final 80/20 decision engine.`
                          : data.catalystIntelligence.marketWideAvailable
                            ? "Catalyst feeds are working and market-wide context was analyzed, but current directional evidence is not strong enough to receive trading weight."
                            : "Catalyst intelligence is visible for context, but no catalyst weight is currently applied to the selected trading signal."}
                  </div>
                </>
              )}
            </section>

            {/* Macro & Market Regime Intelligence */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "flex-start",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "16px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin:
                        "0 0 5px",

                      fontSize:
                        "20px",
                    }}
                  >
                    Macro & Market Regime
                  </h2>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.5,

                      maxWidth:
                        "900px",
                    }}
                  >
                    Global crypto market conditions, BTC context, volatility,
                    the broad U.S. dollar and U.S. 10-year Treasury yield are
                    combined into a controlled risk-on / risk-off regime layer.
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "8px",

                    flexWrap:
                      "wrap",

                    alignItems:
                      "center",
                  }}
                >
                  <span
                    style={{
                      padding:
                        "8px 13px",

                      borderRadius:
                        "999px",

                      fontWeight:
                        900,

                      fontSize:
                        "12px",

                      background:
                        data.macroIntelligence.available
                          ? regimeBackground(
                              data.macroIntelligence.regime
                            )
                          : "#f1f5f9",

                      color:
                        data.macroIntelligence.available
                          ? regimeColor(
                              data.macroIntelligence.regime
                            )
                          : "#64748b",
                    }}
                  >
                    {data.macroIntelligence.available
                      ? data.macroIntelligence.regime.replaceAll(
                          "_",
                          " "
                        )
                      : "UNAVAILABLE"}
                  </span>

                  <span
                    style={{
                      padding:
                        "8px 13px",

                      borderRadius:
                        "999px",

                      fontWeight:
                        900,

                      fontSize:
                        "12px",

                      background:
                        data.macroIntelligence.dataQuality === "GOOD"
                          ? "#dcfce7"
                          : data.macroIntelligence.dataQuality === "PARTIAL"
                            ? "#fef3c7"
                            : "#f1f5f9",

                      color:
                        data.macroIntelligence.dataQuality === "GOOD"
                          ? "#166534"
                          : data.macroIntelligence.dataQuality === "PARTIAL"
                            ? "#92400e"
                            : "#64748b",
                    }}
                  >
                    {data.macroIntelligence.dataQuality} DATA
                  </span>

                  <span
                    style={{
                      padding:
                        "8px 13px",

                      borderRadius:
                        "999px",

                      fontWeight:
                        900,

                      fontSize:
                        "12px",

                      background:
                        data.intelligenceWeights.macro > 0
                          ? "#dbeafe"
                          : "#f1f5f9",

                      color:
                        data.intelligenceWeights.macro > 0
                          ? "#1d4ed8"
                          : "#64748b",
                    }}
                  >
                    {data.intelligenceWeights.macro > 0
                      ? "WEIGHT ACTIVE"
                      : "OBSERVATION ONLY"}
                  </span>
                </div>
              </div>

              {!data.macroIntelligence.available ? (
                <div
                  style={{
                    padding:
                      "18px",

                    borderRadius:
                      "12px",

                    background:
                      "#f8fafc",

                    border:
                      "1px solid #e2e8f0",

                    color:
                      "#64748b",

                    lineHeight:
                      1.6,
                  }}
                >
                  Macro regime intelligence is currently unavailable. Macro
                  weight stays at 0% and does not dilute the working market
                  intelligence modules.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",

                      gap:
                        "12px",

                      marginBottom:
                        "16px",
                    }}
                  >
                    <MetricCard
                      label="Macro Regime"
                      value={data.macroIntelligence.regime.replaceAll(
                        "_",
                        " "
                      )}
                      sub={
                        data.macroIntelligence.meaningfulRegime
                          ? "Meaningful directional regime"
                          : "Neutral / below weighting threshold"
                      }
                    />

                    <MetricCard
                      label="Macro Score"
                      value={`${data.macroIntelligence.score}`}
                      sub="Effective score after safeguards"
                    />

                    <MetricCard
                      label="Raw Macro Score"
                      value={`${data.macroIntelligence.rawScore}`}
                      sub={`Raw regime ${data.macroIntelligence.rawRegime.replaceAll(
                        "_",
                        " "
                      )}`}
                    />

                    <MetricCard
                      label="Macro Weight"
                      value={`${data.intelligenceWeights.macro}%`}
                      sub={
                        data.intelligenceWeights.macro > 0
                          ? "Active inside selected signal"
                          : "Not affecting current trade decision"
                      }
                    />

                    <MetricCard
                      label="Signal Contribution"
                      value={`${data.intelligenceScores.macroContribution}`}
                      sub="Contribution inside selected signal"
                    />

                    <MetricCard
                      label="Final Engine Contribution"
                      value={`${Number(
                        macroDecisionContribution.toFixed(2)
                      )}`}
                      sub={`${data.decisionWeights.selectedSignal}% selected-engine pass-through`}
                    />

                    <MetricCard
                      label="Macro Confidence"
                      value={`${data.macroIntelligence.confidence}%`}
                      sub="Heuristic, not win probability"
                    />

                    <MetricCard
                      label="Available Sources"
                      value={`${data.macroIntelligence.availableSources}/${data.macroIntelligence.totalSources}`}
                      sub={`${data.macroIntelligence.dataQuality} effective quality`}
                    />

                    <MetricCard
                      label="BTC Dominance"
                      value={`${data.macroIntelligence.btcDominancePercent}%`}
                      sub={data.macroIntelligence.btcDominanceRegime.replaceAll(
                        "_",
                        " "
                      )}
                    />

                    <MetricCard
                      label="Crypto Market 24h"
                      value={formatSignedPercent(
                        data.macroIntelligence.cryptoMarketChange24hPercent
                      )}
                      sub="Total crypto market-cap change"
                    />

                    <MetricCard
                      label="BTC 24h"
                      value={formatSignedPercent(
                        data.macroIntelligence.btcChange24hPercent
                      )}
                      sub={
                        data.macroIntelligence.btcMomentumExcluded
                          ? "Excluded from BTC macro score to prevent double-counting"
                          : "Macro market context"
                      }
                    />

                    <MetricCard
                      label="VIX"
                      value={`${data.macroIntelligence.vix}`}
                      sub="Daily volatility context"
                    />

                    <MetricCard
                      label="Broad USD Change"
                      value={formatSignedPercent(
                        data.macroIntelligence.dollarChangePercent,
                        3
                      )}
                      sub="Latest available broad-dollar observation"
                    />

                    <MetricCard
                      label="U.S. 10Y Yield"
                      value={`${data.macroIntelligence.tenYearYieldPercent}%`}
                      sub={`${
                        data.macroIntelligence.tenYearYieldChangeBps > 0
                          ? "+"
                          : ""
                      }${data.macroIntelligence.tenYearYieldChangeBps} bps latest change`}
                    />

                    <MetricCard
                      label="BTC Double-Count Guard"
                      value={
                        data.macroIntelligence.btcMomentumExcluded
                          ? "ACTIVE"
                          : "NOT NEEDED"
                      }
                      sub={
                        data.macroIntelligence.btcMomentumExcluded
                          ? "BTC momentum removed from BTC macro weighting"
                          : "Selected asset is not BTC"
                      }
                    />

                    <MetricCard
                      label="Meaningful Regime"
                      value={
                        data.macroIntelligence.meaningfulRegime
                          ? "YES"
                          : "NO"
                      }
                      sub={
                        data.intelligenceWeights.macro > 0
                          ? "Eligible for controlled macro weighting"
                          : "Macro remains context only"
                      }
                    />
                  </div>

                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(280px, 1fr))",

                      gap:
                        "12px",

                      marginBottom:
                        "16px",
                    }}
                  >
                    <ReasonPanel
                      title="Risk-On Macro Factors"
                      items={data.macroIntelligence.riskOnReasons}
                      type="positive"
                    />

                    <ReasonPanel
                      title="Risk-Off Macro Factors"
                      items={data.macroIntelligence.riskOffReasons}
                      type="negative"
                    />
                  </div>

                  {data.macroIntelligence.warnings.length > 0 && (
                    <div
                      style={{
                        marginBottom:
                          "16px",
                      }}
                    >
                      <ReasonPanel
                        title="Macro Data Warnings"
                        items={data.macroIntelligence.warnings}
                        type="warning"
                      />
                    </div>
                  )}

                  {data.macroIntelligence.sourceFailures.length > 0 && (
                    <div
                      style={{
                        marginBottom:
                          "16px",
                      }}
                    >
                      <ReasonPanel
                        title="Macro Source Failures"
                        items={data.macroIntelligence.sourceFailures.map(
                          (item) => `${item.source}: ${item.error}`
                        )}
                        type="warning"
                      />
                    </div>
                  )}

                  <div
                    style={{
                      padding:
                        "14px",

                      borderRadius:
                        "12px",

                      background:
                        data.intelligenceWeights.macro > 0
                          ? "#eff6ff"
                          : "#f8fafc",

                      border:
                        data.intelligenceWeights.macro > 0
                          ? "1px solid #bfdbfe"
                          : "1px solid #e2e8f0",

                      color:
                        data.intelligenceWeights.macro > 0
                          ? "#1e40af"
                          : "#475569",

                      fontSize:
                        "13px",

                      lineHeight:
                        1.6,
                    }}
                  >
                    {data.intelligenceWeights.macro > 0
                      ? `Macro intelligence is active at a controlled ${data.intelligenceWeights.macro}% selected-signal weight. Its contribution is already inside the selected signal and is not counted a second time by the final 80/20 decision engine.`
                      : data.macroIntelligence.meaningfulRegime
                        ? "A directional macro regime was detected, but current data-quality safeguards keep macro weighting disabled for this reading."
                        : "The current macro regime is not strong enough to affect the trade score. Macro remains visible for context while its weight stays at 0%."}
                  </div>
                </>
              )}
            </section>

            {/* Confirmations */}

            {data.confirmations
              .length >
              0 && (
              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >
                <ReasonPanel
                  title="Confirmations"
                  items={
                    data.confirmations
                  }
                  type="neutral"
                />
              </div>
            )}

            {/* Reasons */}

            <section
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(300px, 1fr))",

                gap:
                  "18px",

                marginBottom:
                  "22px",
              }}
            >
              <ReasonPanel
                title="Bullish Factors"
                items={
                  data.bullishReasons
                }
                type="positive"
              />

              <ReasonPanel
                title="Bearish Factors"
                items={
                  data.bearishReasons
                }
                type="negative"
              />

              <ReasonPanel
                title="Risk Factors"
                items={
                  data.risks
                }
                type="warning"
              />
            </section>

            {/* Intelligence Modules */}

            <section
              style={{
                background:
                  "#ffffff",

                border:
                  "1px solid #e2e8f0",

                borderRadius:
                  "18px",

                padding:
                  "20px",

                marginBottom:
                  "22px",
              }}
            >
              <h2
                style={{
                  margin:
                    "0 0 16px",

                  fontSize:
                    "20px",
                }}
              >
                Intelligence
                Modules
              </h2>

              <div
                style={{
                  display:
                    "flex",

                  flexWrap:
                    "wrap",

                  gap:
                    "8px",
                }}
              >
                {Object.entries(
                  data.modules
                ).map(
                  ([
                    key,
                    value,
                  ]) => (
                    <span
                      key={
                        key
                      }
                      style={{
                        padding:
                          "7px 11px",

                        borderRadius:
                          "999px",

                        background:
                          typeof value ===
                            "boolean" &&
                          value
                            ? "#dcfce7"
                            : "#f1f5f9",

                        color:
                          typeof value ===
                            "boolean" &&
                          value
                            ? "#166534"
                            : "#64748b",

                        border:
                          "1px solid #e2e8f0",

                        fontSize:
                          "12px",

                        fontWeight:
                          800,
                      }}
                    >
                      {
                        key
                      }{" "}
                      {typeof value ===
                      "boolean"
                        ? value
                          ? "✓"
                          : "—"
                        : value}
                    </span>
                  )
                )}
              </div>
            </section>

            {/* Disclaimer */}

            <div
              style={{
                textAlign:
                  "center",

                color:
                  "#94a3b8",

                fontSize:
                  "12px",

                lineHeight:
                  1.6,

                paddingBottom:
                  "24px",
              }}
            >
              Updated{" "}
              {new Date(
                data.updatedAt
              ).toLocaleString()}
              . Trading signals,
              confidence scores,
              native/ERC-20 whale,
              stablecoin, news/catalyst
              and macro-regime signals
              are analytical
              indicators, not
              guaranteed outcomes.
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}