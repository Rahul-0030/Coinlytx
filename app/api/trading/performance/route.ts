import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

type Trade = {
  id: string;
  symbol: string;
  interval: string;
  signal: string;
  status: string;

  confidence: number | null;
  decision_score: number | null;
  pnl_percent: number | null;

  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;

  max_favorable_excursion_percent: number | null;
  max_adverse_excursion_percent: number | null;

  selected_signal_score: number | null;
  multi_timeframe_score: number | null;
  multi_timeframe_alignment: string | null;

  technical_score: number | null;
  derivatives_score: number | null;
  whale_score: number | null;
  stablecoin_score: number | null;
  catalyst_score: number | null;
  macro_score: number | null;

  opened_at: string | null;
  closed_at: string | null;
};

function validTrade(trade: Trade) {
  const entryLow = num(trade.entry_low);
  const entryHigh = num(trade.entry_high);
  const stop = num(trade.stop_loss);
  const tp1 = num(trade.tp1);
  const tp2 = num(trade.tp2);
  const tp3 = num(trade.tp3);

  return (
    entryLow !== null &&
    entryHigh !== null &&
    stop !== null &&
    tp1 !== null &&
    tp2 !== null &&
    tp3 !== null &&
    entryLow > 0 &&
    entryHigh > 0 &&
    stop > 0 &&
    tp1 > 0 &&
    tp2 > 0 &&
    tp3 > 0
  );
}

function targetLevel(trade: Trade) {
  if (trade.status === "TP3_HIT") return 3;
  if (trade.status === "TP2_HIT") return 2;
  if (trade.status === "TP1_HIT") return 1;

  /*
   * For stopped trades, use MFE to determine whether
   * TP1/TP2/TP3 was reached before the eventual stop.
   */
  const entryLow = num(trade.entry_low);
  const entryHigh = num(trade.entry_high);

  if (
    entryLow === null ||
    entryHigh === null
  ) {
    return 0;
  }

  const entry = (entryLow + entryHigh) / 2;

  const tp1 = num(trade.tp1);
  const tp2 = num(trade.tp2);
  const tp3 = num(trade.tp3);

  const mfe = num(
    trade.max_favorable_excursion_percent
  );

  if (
    entry <= 0 ||
    tp1 === null ||
    tp2 === null ||
    tp3 === null ||
    mfe === null
  ) {
    return 0;
  }

  const movePercent = (target: number) => {
    if (trade.signal === "LONG") {
      return ((target - entry) / entry) * 100;
    }

    return ((entry - target) / entry) * 100;
  };

  const tp1Move = movePercent(tp1);
  const tp2Move = movePercent(tp2);
  const tp3Move = movePercent(tp3);

  if (mfe >= tp3Move) return 3;
  if (mfe >= tp2Move) return 2;
  if (mfe >= tp1Move) return 1;

  return 0;
}

function calculateStats(trades: Trade[]) {
  const total = trades.length;

  const pending = trades.filter(
    (trade) => trade.status === "PENDING_ENTRY"
  ).length;

  const open = trades.filter(
    (trade) => trade.status === "OPEN"
  ).length;

  const stopped = trades.filter(
    (trade) => trade.status === "STOPPED"
  ).length;

  const tp1OrBetter = trades.filter(
    (trade) => targetLevel(trade) >= 1
  ).length;

  const tp2OrBetter = trades.filter(
    (trade) => targetLevel(trade) >= 2
  ).length;

  const tp3Reached = trades.filter(
    (trade) => targetLevel(trade) >= 3
  ).length;

  const stoppedBeforeTp1 = trades.filter(
    (trade) =>
      trade.status === "STOPPED" &&
      targetLevel(trade) === 0
  ).length;

  const stoppedAfterTp1 = trades.filter(
    (trade) =>
      trade.status === "STOPPED" &&
      targetLevel(trade) === 1
  ).length;

  const stoppedAfterTp2 = trades.filter(
    (trade) =>
      trade.status === "STOPPED" &&
      targetLevel(trade) === 2
  ).length;

  const closed = trades.filter(
    (trade) =>
      trade.status === "STOPPED" ||
      trade.status === "TP3_HIT"
  );

  const closedWithPnl = closed.filter(
    (trade) => num(trade.pnl_percent) !== null
  );

  const wins = closedWithPnl.filter(
    (trade) => (num(trade.pnl_percent) ?? 0) > 0
  );

  const losses = closedWithPnl.filter(
    (trade) => (num(trade.pnl_percent) ?? 0) < 0
  );

  const breakeven = closedWithPnl.filter(
    (trade) => (num(trade.pnl_percent) ?? 0) === 0
  );

  const totalPnl = closedWithPnl.reduce(
    (sum, trade) =>
      sum + (num(trade.pnl_percent) ?? 0),
    0
  );

  const grossProfit = wins.reduce(
    (sum, trade) =>
      sum + (num(trade.pnl_percent) ?? 0),
    0
  );

  const grossLoss = Math.abs(
    losses.reduce(
      (sum, trade) =>
        sum + (num(trade.pnl_percent) ?? 0),
      0
    )
  );

  const averageMfeValues = trades
    .map((trade) =>
      num(trade.max_favorable_excursion_percent)
    )
    .filter(
      (value): value is number =>
        value !== null
    );

  const averageMaeValues = trades
    .map((trade) =>
      num(trade.max_adverse_excursion_percent)
    )
    .filter(
      (value): value is number =>
        value !== null
    );

  const averageMfe =
    averageMfeValues.length > 0
      ? averageMfeValues.reduce(
          (sum, value) => sum + value,
          0
        ) / averageMfeValues.length
      : null;

  const averageMae =
    averageMaeValues.length > 0
      ? averageMaeValues.reduce(
          (sum, value) => sum + value,
          0
        ) / averageMaeValues.length
      : null;

  return {
    total,

    pending,
    open,
    closed: closed.length,

    stopped,

    targetPerformance: {
      tp1OrBetter,
      tp2OrBetter,
      tp3Reached,

      tp1ReachRatePercent:
        total > 0
          ? round((tp1OrBetter / total) * 100)
          : null,

      tp2ReachRatePercent:
        total > 0
          ? round((tp2OrBetter / total) * 100)
          : null,

      tp3ReachRatePercent:
        total > 0
          ? round((tp3Reached / total) * 100)
          : null,

      stoppedBeforeTp1,
      stoppedAfterTp1,
      stoppedAfterTp2,
    },

    realizedPerformance: {
      samples: closedWithPnl.length,

      wins: wins.length,
      losses: losses.length,
      breakeven: breakeven.length,

      winRatePercent:
        closedWithPnl.length > 0
          ? round(
              (wins.length /
                closedWithPnl.length) *
                100
            )
          : null,

      totalPnlPercent:
        round(totalPnl),

      averagePnlPercent:
        closedWithPnl.length > 0
          ? round(
              totalPnl /
                closedWithPnl.length
            )
          : null,

      profitFactor:
        grossLoss > 0
          ? round(
              grossProfit / grossLoss
            )
          : grossProfit > 0
            ? null
            : 0,
    },

    excursion: {
      averageMfePercent:
        averageMfe === null
          ? null
          : round(averageMfe),

      averageMaePercent:
        averageMae === null
          ? null
          : round(averageMae),
    },
  };
}

function confidenceBucket(
  confidence: number | null
) {
  const value = num(confidence);

  if (value === null) return "UNKNOWN";
  if (value < 50) return "<50";
  if (value < 60) return "50-59";
  if (value < 70) return "60-69";
  if (value < 80) return "70-79";
  if (value < 90) return "80-89";

  return "90-100";
}

function groupStats(
  trades: Trade[],
  getKey: (trade: Trade) => string
) {
  const groups = new Map<
    string,
    Trade[]
  >();

  for (const trade of trades) {
    const key = getKey(trade);

    const group =
      groups.get(key) ?? [];

    group.push(trade);
    groups.set(key, group);
  }

  return Array.from(
    groups.entries()
  )
    .map(([group, items]) => ({
      group,
      ...calculateStats(items),
    }))
    .sort(
      (a, b) =>
        b.total - a.total
    );
}

export async function GET(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
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

    const requestedLimit =
      Number(
        request.nextUrl.searchParams.get(
          "limit"
        ) ?? 5000
      );

    const limit = Math.min(
      Math.max(
        Number.isFinite(
          requestedLimit
        )
          ? Math.round(
              requestedLimit
            )
          : 5000,
        1
      ),
      10000
    );

    /*
     * IMPORTANT:
     * We now load active + completed trades.
     *
     * This lets us measure TP1/TP2 progress,
     * not just final TP3/STOP outcomes.
     */
    const {
      data,
      error,
    } = await supabase
      .from("paper_trades")
      .select(`
        id,
        symbol,
        interval,
        signal,
        status,

        confidence,
        decision_score,
        pnl_percent,

        entry_low,
        entry_high,
        stop_loss,
        tp1,
        tp2,
        tp3,

        max_favorable_excursion_percent,
        max_adverse_excursion_percent,

        selected_signal_score,
        multi_timeframe_score,
        multi_timeframe_alignment,

        technical_score,
        derivatives_score,
        whale_score,
        stablecoin_score,
        catalyst_score,
        macro_score,

        opened_at,
        closed_at
      `)
      .order(
        "opened_at",
        {
          ascending: false,
        }
      )
      .limit(limit);

    if (error) {
      throw new Error(
        error.message
      );
    }

    const allTrades =
      (data ?? []) as Trade[];

    const trades =
      allTrades.filter(
        validTrade
      );

    const excludedInvalid =
      allTrades.length -
      trades.length;

    const overall =
      calculateStats(trades);

    const bySignal =
      groupStats(
        trades,
        (trade) =>
          trade.signal ||
          "UNKNOWN"
      );

    const byInterval =
      groupStats(
        trades,
        (trade) =>
          trade.interval ||
          "UNKNOWN"
      );

    const byConfidence =
      groupStats(
        trades,
        (trade) =>
          confidenceBucket(
            trade.confidence
          )
      );

    const byAlignment =
      groupStats(
        trades,
        (trade) =>
          trade.multi_timeframe_alignment ||
          "UNKNOWN"
      );

    return NextResponse.json({
      success: true,

      version:
        "performance-v2",

      purpose:
        "Validate Coinlytx signals using target reach rates, realized PnL and favorable/adverse excursion.",

      warning:
        "Confidence remains heuristic until enough clean out-of-sample trades exist for calibration.",

      dataQuality: {
        databaseRows:
          allTrades.length,

        validTrades:
          trades.length,

        excludedInvalidTrades:
          excludedInvalid,
      },

      overall,

      breakdown: {
        bySignal,
        byInterval,
        byConfidence,
        byMultiTimeframeAlignment:
          byAlignment,
      },

      interpretation: {
        tp1ReachRate:
          "Percentage of valid signals that reached at least TP1.",

        tp2ReachRate:
          "Percentage of valid signals that reached at least TP2.",

        tp3ReachRate:
          "Percentage of valid signals that reached TP3.",

        mfe:
          "Maximum Favorable Excursion measures how far price moved in the predicted direction.",

        mae:
          "Maximum Adverse Excursion measures how far price moved against the predicted direction.",

        realizedPnl:
          "Only completed paper trades with recorded pnl_percent are used for realized PnL statistics.",
      },

      updatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "TRADING PERFORMANCE V2 ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate trading performance.",
      },
      {
        status: 500,
      }
    );
  }
}