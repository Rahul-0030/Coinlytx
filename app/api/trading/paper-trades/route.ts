import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * ============================================================
 * PAPER TRADING V2
 * ============================================================
 *
 * New V2 trades:
 *
 * strategy_version = final-v2-confirmation-gated
 * tracking_version = 2
 * status = PENDING_ENTRY
 *
 * A generated signal is NOT considered entered until market
 * price actually touches its entry zone.
 */

const STRATEGY_VERSION =
  "final-v2-confirmation-gated";

const TRACKING_VERSION =
  2;

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

type FinalTradingResponse = {
  success: boolean;

  version?: string;

  symbol: string;
  interval: string;

  finalDecision: TradeSignal;

  decisionScore: number;
  confidence: number;

  confidenceType?: string;

  strongConflict?: boolean;

  currentPrice: number;

  updatedAt: string;

  confirmationGate?: {
    required?: number;

    longConfirmationCount?: number;
    shortConfirmationCount?: number;

    selectedTimeframe?: {
      long?: boolean;
      short?: boolean;
    };

    multiTimeframe?: {
      long?: boolean;
      short?: boolean;
    };

    higherTimeframe?: {
      long?: boolean;
      short?: boolean;
    };

    passed?: boolean;
  };

  decisionContributions?: {
    selectedSignalScore?: number;
    selectedSignalContribution?: number;

    multiTimeframeScore?: number;
    multiTimeframeContribution?: number;
  };

  intelligenceWeights?: {
    technical?: number;
    derivatives?: number;
    whale?: number;
    stablecoin?: number;
    catalyst?: number;
    macro?: number;
  };

  intelligenceScores?: {
    technical?: number;
    technicalContribution?: number;

    derivatives?: number;
    derivativesContribution?: number;

    whale?: number;
    whaleContribution?: number;

    stablecoin?: number;
    stablecoinContribution?: number;

    catalyst?: number;
    catalystRaw?: number;
    catalystContribution?: number;

    macro?: number;
    macroRaw?: number;
    macroContribution?: number;
  };

  selectedTimeframe?: {
    interval?: string;
    signal?: TradeSignal;

    score?: number;
    confidence?: number;

    technicalScore?: number;
    derivativesScore?: number;
    whaleScore?: number;
    stablecoinScore?: number;
    catalystScore?: number;
    macroScore?: number;
  };

  multiTimeframe?: {
    consensusSignal?: TradeSignal;

    weightedScore?: number;

    confidence?: number;

    alignment?: string;

    trendConflict?: boolean;

    shortTermTrend?: string;
    shortTermScore?: number;

    higherTimeframeTrend?: string;
    higherTimeframeScore?: number;

    distribution?: unknown;

    timeframes?: unknown[];
  };

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

  error?: string;
};

function isAllowedInterval(
  value: string
): value is AllowedInterval {
  return (
    ALLOWED_INTERVALS as readonly string[]
  ).includes(value);
}

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

function nullableNumber(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

/*
 * A paper-trade setup must contain real positive levels.
 *
 * This prevents legacy-style zero-price rows from entering
 * the V2 dataset.
 */

function isPositiveFinite(
  value: number | null
): value is number {
  return (
    value !== null &&
    Number.isFinite(value) &&
    value > 0
  );
}

async function getAuthenticatedSupabase() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser();

  return {
    supabase,

    user:
      error ||
      !user
        ? null
        : user,
  };
}

async function fetchFinalSignal(
  request: NextRequest,
  symbol: string,
  interval: AllowedInterval
) {
  const url =
    new URL(
      "/api/trading/final",
      request.nextUrl.origin
    );

  url.searchParams.set(
    "symbol",
    symbol
  );

  url.searchParams.set(
    "interval",
    interval
  );

  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as FinalTradingResponse;

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.error ||
        `Final trading route returned HTTP ${response.status}.`
    );
  }

  return data;
}

/*
 * ============================================================
 * GET
 * ============================================================
 *
 * Loads paper trades and provides a basic summary.
 */

export async function GET(
  request: NextRequest
) {
  try {
    const {
      supabase,
      user,
    } =
      await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized.",
        },
        {
          status:
            401,
        }
      );
    }

    const searchParams =
      request.nextUrl
        .searchParams;

    const symbolParam =
      searchParams.get(
        "symbol"
      );

    const statusParam =
      searchParams
        .get("status")
        ?.trim()
        .toUpperCase();

    const strategyVersionParam =
      searchParams
        .get(
          "strategy_version"
        )
        ?.trim();

    const trackingVersionParam =
      searchParams.get(
        "tracking_version"
      );

    const limit =
      Math.min(
        200,
        Math.max(
          1,
          Math.round(
            safeNumber(
              searchParams.get(
                "limit"
              ),
              50
            )
          )
        )
      );

    let query =
      supabase
        .from(
          "paper_trades"
        )
        .select("*")
        .order(
          "opened_at",
          {
            ascending:
              false,
          }
        )
        .limit(limit);

    if (symbolParam) {
      const symbol =
        normalizeTradingSymbol(
          symbolParam,
          "BTCUSDT"
        );

      query =
        query.eq(
          "symbol",
          symbol
        );
    }

    if (statusParam) {
      query =
        query.eq(
          "status",
          statusParam
        );
    }

    if (
      strategyVersionParam
    ) {
      query =
        query.eq(
          "strategy_version",
          strategyVersionParam
        );
    }

    if (
      trackingVersionParam
    ) {
      const trackingVersion =
        safeNumber(
          trackingVersionParam,
          -1
        );

      if (
        trackingVersion >=
        0
      ) {
        query =
          query.eq(
            "tracking_version",
            trackingVersion
          );
      }
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      throw new Error(
        error.message
      );
    }

    const trades =
      data ?? [];

    /*
     * Pending means signal exists but entry has
     * not yet been confirmed.
     */

    const pendingTrades =
      trades.filter(
        (trade) =>
          trade.status ===
          "PENDING_ENTRY"
      );

    /*
     * Entered trades which are still active.
     */

    const openTrades =
      trades.filter(
        (trade) =>
          trade.status ===
            "OPEN" ||
          trade.status ===
            "TP1_HIT" ||
          trade.status ===
            "TP2_HIT"
      );

    const closedTrades =
      trades.filter(
        (trade) =>
          trade.status ===
            "TP3_HIT" ||
          trade.status ===
            "STOPPED" ||
          trade.status ===
            "EXPIRED" ||
          trade.status ===
            "CANCELLED"
      );

    const wins =
      closedTrades.filter(
        (trade) =>
          safeNumber(
            trade.pnl_percent
          ) > 0
      ).length;

    const losses =
      closedTrades.filter(
        (trade) =>
          safeNumber(
            trade.pnl_percent
          ) < 0
      ).length;

    const breakeven =
      closedTrades.filter(
        (trade) =>
          safeNumber(
            trade.pnl_percent
          ) === 0
      ).length;

    const v2Trades =
      trades.filter(
        (trade) =>
          trade.strategy_version ===
            STRATEGY_VERSION &&
          safeNumber(
            trade.tracking_version
          ) ===
            TRACKING_VERSION
      ).length;

    const legacyTrades =
      trades.filter(
        (trade) =>
          trade.strategy_version ===
            "legacy-v1" ||
          safeNumber(
            trade.tracking_version
          ) === 1
      ).length;

    return NextResponse.json({
      success:
        true,

      count:
        trades.length,

      summary: {
        pendingTrades:
          pendingTrades.length,

        openTrades:
          openTrades.length,

        closedTrades:
          closedTrades.length,

        wins,

        losses,

        breakeven,

        winRatePercent:
          wins +
            losses >
          0
            ? Number(
                (
                  (
                    wins /
                    (
                      wins +
                      losses
                    )
                  ) *
                  100
                ).toFixed(
                  2
                )
              )
            : null,

        versions: {
          legacy:
            legacyTrades,

          v2:
            v2Trades,
        },
      },

      trades,

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "PAPER TRADES GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load paper trades.",
      },
      {
        status:
          500,
      }
    );
  }
}

/*
 * ============================================================
 * POST
 * ============================================================
 *
 * Creates a V2 paper-trade candidate.
 *
 * IMPORTANT:
 *
 * Creating a row does NOT mean the trade entered.
 *
 * New trades start as:
 *
 * PENDING_ENTRY
 *
 * The tracker is responsible for moving:
 *
 * PENDING_ENTRY -> OPEN
 *
 * after price touches the entry zone.
 */

export async function POST(
  request: NextRequest
) {
  try {
    const {
      supabase,
      user,
    } =
      await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized.",
        },
        {
          status:
            401,
        }
      );
    }

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as {
        symbol?: string;
        interval?: string;
      };

    const symbol =
      normalizeTradingSymbol(
        body.symbol,
        "BTCUSDT"
      );

    const rawInterval =
      (
        body.interval ||
        "1h"
      ).toLowerCase();

    const interval:
      AllowedInterval =
      isAllowedInterval(
        rawInterval
      )
        ? rawInterval
        : "1h";

    /*
     * Ask final-v2 for the latest decision.
     */

    const finalSignal =
      await fetchFinalSignal(
        request,
        symbol,
        interval
      );

    if (
      finalSignal.symbol !==
      symbol
    ) {
      throw new Error(
        `Final signal symbol mismatch. Requested ${symbol}, received ${finalSignal.symbol}.`
      );
    }

    /*
     * Safety check:
     * this paper-trade creator is intended to log
     * signals from the V2 confirmation-gated engine.
     */

    if (
      finalSignal.version &&
      finalSignal.version !==
        STRATEGY_VERSION
    ) {
      return NextResponse.json(
        {
          success:
            false,

          created:
            false,

          skipped:
            true,

          error:
            `Unexpected final strategy version: ${finalSignal.version}. Expected ${STRATEGY_VERSION}.`,
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * WAIT never creates a paper trade.
     */

    if (
      finalSignal.finalDecision ===
      "WAIT"
    ) {
      return NextResponse.json({
        success:
          true,

        created:
          false,

        skipped:
          true,

        reason:
          "Final decision is WAIT, so no paper trade candidate was created.",

        strategyVersion:
          STRATEGY_VERSION,

        trackingVersion:
          TRACKING_VERSION,

        finalDecision:
          finalSignal
            .finalDecision,

        decisionScore:
          safeNumber(
            finalSignal
              .decisionScore
          ),

        confidence:
          safeNumber(
            finalSignal
              .confidence
          ),

        confirmationGate:
          finalSignal
            .confirmationGate ??
          null,
      });
    }

    /*
     * V2 confirmation gate should have passed
     * for every LONG/SHORT.
     */

    if (
      finalSignal
        .confirmationGate &&
      finalSignal
        .confirmationGate
        .passed ===
        false
    ) {
      return NextResponse.json(
        {
          success:
            false,

          created:
            false,

          skipped:
            true,

          error:
            "Final signal returned LONG/SHORT even though the V2 confirmation gate did not pass.",

          finalDecision:
            finalSignal
              .finalDecision,

          confirmationGate:
            finalSignal
              .confirmationGate,
        },
        {
          status:
            409,
        }
      );
    }

    const tradePlan =
      finalSignal
        .tradePlan ??
      {};

    const entryLow =
      nullableNumber(
        tradePlan.entryLow
      );

    const entryHigh =
      nullableNumber(
        tradePlan.entryHigh
      );

    const stopLoss =
      nullableNumber(
        tradePlan.stopLoss
      );

    const tp1 =
      nullableNumber(
        tradePlan.tp1
      );

    const tp2 =
      nullableNumber(
        tradePlan.tp2
      );

    const tp3 =
      nullableNumber(
        tradePlan.tp3
      );

    const invalidation =
      nullableNumber(
        tradePlan.invalidation
      );

    /*
     * Reject missing or zero levels.
     */

    if (
      !isPositiveFinite(
        entryLow
      ) ||
      !isPositiveFinite(
        entryHigh
      ) ||
      !isPositiveFinite(
        stopLoss
      ) ||
      !isPositiveFinite(
        tp1
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          created:
            false,

          error:
            "LONG/SHORT signal does not contain a valid positive paper-trade setup.",

          levels: {
            entryLow,
            entryHigh,
            stopLoss,
            tp1,
            tp2,
            tp3,
          },
        },
        {
          status:
            422,
        }
      );
    }

    /*
     * Entry zone itself must make sense.
     */

    if (
      entryLow >
      entryHigh
    ) {
      return NextResponse.json(
        {
          success:
            false,

          created:
            false,

          error:
            "Paper-trade entryLow is greater than entryHigh.",

          levels: {
            entryLow,
            entryHigh,
          },
        },
        {
          status:
            422,
        }
      );
    }

    /*
     * Directional validation.
     *
     * LONG:
     * stop below entry.
     * TP1 above entry.
     *
     * SHORT:
     * stop above entry.
     * TP1 below entry.
     */

    const entryMid =
      (
        entryLow +
        entryHigh
      ) /
      2;

    if (
      finalSignal
        .finalDecision ===
        "LONG"
    ) {
      if (
        stopLoss >=
          entryMid ||
        tp1 <=
          entryMid
      ) {
        return NextResponse.json(
          {
            success:
              false,

            created:
              false,

            error:
              "Invalid LONG trade geometry: stop must be below entry and TP1 must be above entry.",

            levels: {
              entryLow,
              entryHigh,
              entryMid,
              stopLoss,
              tp1,
              tp2,
              tp3,
            },
          },
          {
            status:
              422,
          }
        );
      }
    }

    if (
      finalSignal
        .finalDecision ===
        "SHORT"
    ) {
      if (
        stopLoss <=
          entryMid ||
        tp1 >=
          entryMid
      ) {
        return NextResponse.json(
          {
            success:
              false,

            created:
              false,

            error:
              "Invalid SHORT trade geometry: stop must be above entry and TP1 must be below entry.",

            levels: {
              entryLow,
              entryHigh,
              entryMid,
              stopLoss,
              tp1,
              tp2,
              tp3,
            },
          },
          {
            status:
              422,
          }
        );
      }
    }

    /*
     * ========================================================
     * DUPLICATE ACTIVE TRADE PROTECTION
     * ========================================================
     *
     * PENDING_ENTRY must count as active.
     *
     * Otherwise repeated dashboard/API refreshes could create
     * multiple pending trades for the same symbol + interval.
     */

    const {
      data:
        activeTrade,

      error:
        activeTradeError,
    } =
      await supabase
        .from(
          "paper_trades"
        )
        .select(
  "id, symbol, interval, signal, status, opened_at, strategy_version, tracking_version"
)
        .eq(
          "symbol",
          symbol
        )
        .eq(
          "interval",
          interval
        )
        .in(
          "status",
          [
            "PENDING_ENTRY",
            "OPEN",
            "TP1_HIT",
            "TP2_HIT",
          ]
        )
        .order(
          "opened_at",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (
      activeTradeError
    ) {
      throw new Error(
        activeTradeError
          .message
      );
    }

    if (
      activeTrade
    ) {
      return NextResponse.json({
        success:
          true,

        created:
          false,

        skipped:
          true,

        reason:
          `An active ${activeTrade.signal} paper trade already exists for ${symbol} ${interval}.`,

        activeTrade,

        finalDecision:
          finalSignal
            .finalDecision,

        decisionScore:
          safeNumber(
            finalSignal
              .decisionScore
          ),

        strategyVersion:
          STRATEGY_VERSION,

        trackingVersion:
          TRACKING_VERSION,
      });
    }

    const sourceUpdatedAt =
      finalSignal.updatedAt ||
      new Date()
        .toISOString();

    /*
     * ========================================================
     * CREATE V2 PAPER TRADE
     * ========================================================
     *
     * It starts PENDING_ENTRY.
     *
     * entered_at stays null until the tracker confirms
     * entry-zone contact.
     */

    const row = {
      symbol,

      interval,

      signal:
        finalSignal
          .finalDecision,

      strategy_version:
        STRATEGY_VERSION,

      tracking_version:
        TRACKING_VERSION,

      decision_score:
        safeNumber(
          finalSignal
            .decisionScore
        ),

      confidence:
        safeNumber(
          finalSignal
            .confidence
        ),

      current_price:
        safeNumber(
          finalSignal
            .currentPrice
        ),

      entry_low:
        entryLow,

      entry_high:
        entryHigh,

      stop_loss:
        stopLoss,

      tp1,

      tp2,

      tp3,

      invalidation,

      risk_reward:
        tradePlan
          .riskReward ??
        null,

      /*
       * CRITICAL V2 CHANGE.
       */

      status:
        "PENDING_ENTRY",

      /*
       * The tracker fills this when price
       * actually enters the zone.
       */

      entered_at:
        null,

      highest_target:
        0,

      ambiguous_intrabar_outcome:
        false,

      exit_reason:
        null,

      /*
       * Store selected + MTF information.
       */

      selected_signal_score:
        safeNumber(
          finalSignal
            .decisionContributions
            ?.selectedSignalScore
        ),

      multi_timeframe_score:
        safeNumber(
          finalSignal
            .multiTimeframe
            ?.weightedScore,
          safeNumber(
            finalSignal
              .decisionContributions
              ?.multiTimeframeScore
          )
        ),

      multi_timeframe_alignment:
        finalSignal
          .multiTimeframe
          ?.alignment ??
        null,

      /*
       * Component scores.
       */

      technical_score:
        safeNumber(
          finalSignal
            .intelligenceScores
            ?.technical
        ),

      derivatives_score:
        safeNumber(
          finalSignal
            .intelligenceScores
            ?.derivatives
        ),

      whale_score:
        safeNumber(
          finalSignal
            .intelligenceScores
            ?.whale
        ),

      stablecoin_score:
        safeNumber(
          finalSignal
            .intelligenceScores
            ?.stablecoin
        ),

      catalyst_score:
        safeNumber(
          finalSignal
            .intelligenceScores
            ?.catalyst
        ),

      macro_score:
        safeNumber(
          finalSignal
            .intelligenceScores
            ?.macro
        ),

      /*
       * Component weights.
       */

      technical_weight:
        safeNumber(
          finalSignal
            .intelligenceWeights
            ?.technical
        ),

      derivatives_weight:
        safeNumber(
          finalSignal
            .intelligenceWeights
            ?.derivatives
        ),

      whale_weight:
        safeNumber(
          finalSignal
            .intelligenceWeights
            ?.whale
        ),

      stablecoin_weight:
        safeNumber(
          finalSignal
            .intelligenceWeights
            ?.stablecoin
        ),

      catalyst_weight:
        safeNumber(
          finalSignal
            .intelligenceWeights
            ?.catalyst
        ),

      macro_weight:
        safeNumber(
          finalSignal
            .intelligenceWeights
            ?.macro
        ),

      source_updated_at:
        sourceUpdatedAt,

      /*
       * Keep the complete signal snapshot.
       *
       * This is important because it allows us to
       * analyze exactly what the engine knew when
       * the trade candidate was generated.
       */

      snapshot:
        finalSignal,
    };

    const {
      data:
        createdTrade,

      error:
        insertError,
    } =
      await supabase
        .from(
          "paper_trades"
        )
        .insert(row)
        .select("*")
        .single();

    if (
      insertError
    ) {
      /*
       * Unique constraint / duplicate snapshot.
       */

      if (
        insertError.code ===
        "23505"
      ) {
        return NextResponse.json({
          success:
            true,

          created:
            false,

          skipped:
            true,

          reason:
            "This exact signal snapshot has already been logged.",

          strategyVersion:
            STRATEGY_VERSION,

          trackingVersion:
            TRACKING_VERSION,
        });
      }

      throw new Error(
        insertError.message
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        created:
          true,

        skipped:
          false,

        strategyVersion:
          STRATEGY_VERSION,

        trackingVersion:
          TRACKING_VERSION,

        status:
          "PENDING_ENTRY",

        trade:
          createdTrade,

        message:
          `${finalSignal.finalDecision} paper-trade candidate created for ${symbol} ${interval}. Waiting for price to enter the entry zone.`,
      },
      {
        status:
          201,
      }
    );
  } catch (error) {
    console.error(
      "PAPER TRADES POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to create paper trade.",
      },
      {
        status:
          500,
      }
    );
  }
}