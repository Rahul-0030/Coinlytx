import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { normalizeTradingSymbol } from "@/lib/trading/symbol";

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

type TradeSignal = "LONG" | "SHORT" | "WAIT";

type FinalTradingResponse = {
  success: boolean;
  symbol: string;
  interval: string;
  finalDecision: TradeSignal;
  decisionScore: number;
  confidence: number;
  currentPrice: number;
  updatedAt: string;

  decisionContributions?: {
    selectedSignalScore?: number;
    multiTimeframeScore?: number;
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
    derivatives?: number;
    whale?: number;
    stablecoin?: number;
    catalyst?: number;
    macro?: number;
  };

  multiTimeframe?: {
    weightedScore?: number;
    alignment?: string;
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
  const number = Number(value);

  return Number.isFinite(number)
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

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user:
      error || !user
        ? null
        : user,
  };
}

async function fetchFinalSignal(
  request: NextRequest,
  symbol: string,
  interval: AllowedInterval
) {
  const url = new URL(
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

  const response = await fetch(
    url,
    {
      cache: "no-store",
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

export async function GET(
  request: NextRequest
) {
  try {
    const {
      supabase,
      user,
    } = await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const searchParams =
      request.nextUrl.searchParams;

    const symbolParam =
      searchParams.get("symbol");

    const statusParam =
      searchParams
        .get("status")
        ?.trim()
        .toUpperCase();

    const limit = Math.min(
      200,
      Math.max(
        1,
        Math.round(
          safeNumber(
            searchParams.get("limit"),
            50
          )
        )
      )
    );

    let query = supabase
      .from("paper_trades")
      .select("*")
      .order(
        "opened_at",
        {
          ascending: false,
        }
      )
      .limit(limit);

    if (symbolParam) {
      const symbol =
        normalizeTradingSymbol(
          symbolParam,
          "BTCUSDT"
        );

      query = query.eq(
        "symbol",
        symbol
      );
    }

    if (statusParam) {
      query = query.eq(
        "status",
        statusParam
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      throw new Error(
        error.message
      );
    }

    const trades = data ?? [];

    const openTrades =
      trades.filter(
        (trade) =>
          trade.status === "OPEN" ||
          trade.status === "TP1_HIT" ||
          trade.status === "TP2_HIT"
      ).length;

    const closedTrades =
      trades.filter(
        (trade) =>
          trade.status === "TP3_HIT" ||
          trade.status === "STOPPED" ||
          trade.status === "EXPIRED" ||
          trade.status === "CANCELLED"
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

    return NextResponse.json({
      success: true,
      count: trades.length,
      summary: {
        openTrades,
        closedTrades:
          closedTrades.length,
        wins,
        losses,
        winRatePercent:
          wins + losses > 0
            ? Number(
                (
                  (wins /
                    (wins + losses)) *
                  100
                ).toFixed(2)
              )
            : null,
      },
      trades,
      updatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "PAPER TRADES GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load paper trades.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      supabase,
      user,
    } = await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      (await request.json().catch(
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

    if (
      finalSignal.finalDecision ===
      "WAIT"
    ) {
      return NextResponse.json({
        success: true,
        created: false,
        skipped: true,
        reason:
          "Final decision is WAIT, so no paper trade was opened.",
        finalDecision:
          finalSignal.finalDecision,
        decisionScore:
          safeNumber(
            finalSignal.decisionScore
          ),
        confidence:
          safeNumber(
            finalSignal.confidence
          ),
      });
    }

    const tradePlan =
      finalSignal.tradePlan ?? {};

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

    if (
      entryLow === null ||
      entryHigh === null ||
      stopLoss === null ||
      tp1 === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "LONG/SHORT signal does not contain a complete paper-trade setup.",
        },
        {
          status: 422,
        }
      );
    }

    /*
     * Only one active paper trade is allowed
     * for the same symbol + interval.
     * This prevents the 15-second dashboard refresh
     * from creating a new trade every time the signal updates.
     */
    const {
      data: activeTrade,
      error: activeTradeError,
    } = await supabase
      .from("paper_trades")
      .select(
        "id, symbol, interval, signal, status, opened_at"
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
          "OPEN",
          "TP1_HIT",
          "TP2_HIT",
        ]
      )
      .order(
        "opened_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (activeTradeError) {
      throw new Error(
        activeTradeError.message
      );
    }

    if (activeTrade) {
      return NextResponse.json({
        success: true,
        created: false,
        skipped: true,
        reason:
          `An active ${activeTrade.signal} paper trade already exists for ${symbol} ${interval}.`,
        activeTrade,
        finalDecision:
          finalSignal.finalDecision,
        decisionScore:
          safeNumber(
            finalSignal.decisionScore
          ),
      });
    }

    const sourceUpdatedAt =
      finalSignal.updatedAt ||
      new Date().toISOString();

    const row = {
      symbol,
      interval,

      signal:
        finalSignal.finalDecision,

      decision_score:
        safeNumber(
          finalSignal.decisionScore
        ),

      confidence:
        safeNumber(
          finalSignal.confidence
        ),

      current_price:
        safeNumber(
          finalSignal.currentPrice
        ),

      entry_low:
        entryLow,

      entry_high:
        entryHigh,

      stop_loss:
        stopLoss,

      tp1,

      tp2:
        nullableNumber(
          tradePlan.tp2
        ),

      tp3:
        nullableNumber(
          tradePlan.tp3
        ),

      invalidation:
        nullableNumber(
          tradePlan.invalidation
        ),

      risk_reward:
        tradePlan.riskReward ??
        null,

      status:
        "OPEN",

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

      snapshot:
        finalSignal,
    };

    const {
      data: createdTrade,
      error: insertError,
    } = await supabase
      .from("paper_trades")
      .insert(row)
      .select("*")
      .single();

    if (insertError) {
      if (
        insertError.code ===
        "23505"
      ) {
        return NextResponse.json({
          success: true,
          created: false,
          skipped: true,
          reason:
            "This exact signal snapshot has already been logged.",
        });
      }

      throw new Error(
        insertError.message
      );
    }

    return NextResponse.json(
      {
        success: true,
        created: true,
        skipped: false,
        trade:
          createdTrade,
        message:
          `${finalSignal.finalDecision} paper trade opened for ${symbol} ${interval}.`,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "PAPER TRADES POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create paper trade.",
      },
      {
        status: 500,
      }
    );
  }
}