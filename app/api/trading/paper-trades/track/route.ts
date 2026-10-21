import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BASE =
  "https://data-api.binance.vision";

const VALID_INTERVALS =
  new Set([
    "1m",
    "5m",
    "15m",
    "1h",
    "4h",
    "1d",
  ]);

type Trade = {
  id: string;

  symbol: string;
  interval: string;

  signal:
    | "LONG"
    | "SHORT";

  entry_low:
    | number
    | null;

  entry_high:
    | number
    | null;

  stop_loss:
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

  status: string;

  opened_at: string;

  entered_at:
    | string
    | null;

  highest_target:
    | number
    | null;

  tracking_version:
    | number
    | null;

  strategy_version:
    | string
    | null;

  ambiguous_intrabar_outcome:
    | boolean
    | null;

  exit_reason:
    | string
    | null;

  current_price:
    | number
    | null;

  max_favorable_excursion_percent:
    | number
    | null;

  max_adverse_excursion_percent:
    | number
    | null;
};

type Candle = {
  openTime: number;

  high: number;
  low: number;
  close: number;

  closeTime: number;
};

function toNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function round(
  value: number,
  decimals = 4
) {
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

function intervalMs(
  interval: string
) {
  const values:
    Record<
      string,
      number
    > = {
    "1m": 60_000,

    "5m":
      300_000,

    "15m":
      900_000,

    "1h":
      3_600_000,

    "4h":
      14_400_000,

    "1d":
      86_400_000,
  };

  return (
    values[
      interval
    ] ??
    3_600_000
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
      error
        ? null
        : user,
  };
}

/*
 * ============================================================
 * BINANCE CANDLE FETCHER
 * ============================================================
 *
 * Keep the existing pagination behavior.
 *
 * We intentionally request one candle before startTime because
 * interval boundaries can otherwise make us miss the first
 * relevant candle.
 */

async function fetchCandles(
  symbol: string,
  interval: string,
  startTime: number
): Promise<Candle[]> {
  const output:
    Candle[] = [];

  const now =
    Date.now();

  let cursor =
    Math.max(
      0,
      startTime -
        intervalMs(
          interval
        )
    );

  for (
    let page = 0;
    page < 20 &&
    cursor <= now;
    page += 1
  ) {
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
      "startTime",
      String(
        cursor
      )
    );

    url.searchParams.set(
      "limit",
      "1000"
    );

    console.log(
      "BINANCE TRACK URL:",
      url.toString()
    );

    const response =
      await fetch(
        url.toString(),
        {
          cache:
            "no-store",

          signal:
            AbortSignal.timeout(
              12_000
            ),
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Binance candle request failed for ${symbol}: HTTP ${response.status}`
      );
    }

    const rows =
      (await response.json()) as unknown[][];

    if (
      !Array.isArray(
        rows
      ) ||
      rows.length === 0
    ) {
      break;
    }

    for (
      const row of rows
    ) {
      const candle:
        Candle = {
        openTime:
          Number(
            row[0]
          ),

        high:
          Number(
            row[2]
          ),

        low:
          Number(
            row[3]
          ),

        close:
          Number(
            row[4]
          ),

        closeTime:
          Number(
            row[6]
          ),
      };

      if (
        Number.isFinite(
          candle.openTime
        ) &&
        Number.isFinite(
          candle.high
        ) &&
        Number.isFinite(
          candle.low
        ) &&
        Number.isFinite(
          candle.close
        ) &&
        Number.isFinite(
          candle.closeTime
        )
      ) {
        output.push(
          candle
        );
      }
    }

    const last =
      output.at(
        -1
      );

    if (
      !last ||
      rows.length <
        1000
    ) {
      break;
    }

    const nextCursor =
      last.openTime +
      intervalMs(
        interval
      );

    if (
      nextCursor <=
      cursor
    ) {
      break;
    }

    cursor =
      nextCursor;
  }

  /*
   * Remove duplicate candles.
   */

  return Array.from(
    new Map(
      output.map(
        (
          item
        ) => [
          item.openTime,
          item,
        ]
      )
    ).values()
  ).sort(
    (
      a,
      b
    ) =>
      a.openTime -
      b.openTime
  );
}

function calculatePnl(
  signal:
    | "LONG"
    | "SHORT",
  entry: number,
  exit: number
) {
  if (
    entry <= 0
  ) {
    return 0;
  }

  return signal ===
    "LONG"
    ? (
        (
          exit -
          entry
        ) /
        entry
      ) *
        100
    : (
        (
          entry -
          exit
        ) /
        entry
      ) *
        100;
}

/*
 * Candle range overlaps entry zone.
 */

function candleTouchesEntryZone(
  candle: Candle,
  entryLow: number,
  entryHigh: number
) {
  return (
    candle.high >=
      entryLow &&
    candle.low <=
      entryHigh
  );
}

/*
 * ============================================================
 * TRADE EVALUATOR
 * ============================================================
 */

function evaluateTrade(
  trade: Trade,
  candleData: Candle[]
) {
  const entryLow =
    toNumber(
      trade.entry_low
    );

  const entryHigh =
    toNumber(
      trade.entry_high
    );

  const stop =
    toNumber(
      trade.stop_loss
    );

  const tp1 =
    toNumber(
      trade.tp1
    );

  const tp2 =
    toNumber(
      trade.tp2
    );

  const tp3 =
    toNumber(
      trade.tp3
    );

  if (
    entryLow ===
      null ||
    entryHigh ===
      null ||
    stop ===
      null ||
    tp1 ===
      null ||
    tp2 ===
      null ||
    tp3 ===
      null
  ) {
    throw new Error(
      "Trade is missing entry, stop-loss, or take-profit levels."
    );
  }

  /*
   * Reject corrupted legacy rows.
   */

  if (
    entryLow <= 0 ||
    entryHigh <= 0 ||
    stop <= 0 ||
    tp1 <= 0 ||
    tp2 <= 0 ||
    tp3 <= 0
  ) {
    throw new Error(
      "Trade contains invalid zero/negative trading levels."
    );
  }

  if (
    entryLow >
    entryHigh
  ) {
    throw new Error(
      "Trade contains an invalid entry zone."
    );
  }

  const entry =
    (
      entryLow +
      entryHigh
    ) /
    2;

  const openedAt =
    new Date(
      trade.opened_at
    ).getTime();

  const storedEnteredAt =
    trade.entered_at
      ? new Date(
          trade.entered_at
        ).getTime()
      : null;

  /*
   * For PENDING_ENTRY:
   * inspect candles from opened_at.
   *
   * For entered trades:
   * inspect candles from entered_at.
   *
   * We still rebuild MFE/MAE from the full post-entry history
   * so repeated tracker runs remain deterministic.
   */

  const trackingStart =
    storedEnteredAt &&
    Number.isFinite(
      storedEnteredAt
    )
      ? storedEnteredAt
      : openedAt;

  const relevantCandles =
    candleData.filter(
      (
        candle
      ) =>
        candle.closeTime >=
        trackingStart
    );

  /*
   * V2 trades use entered_at as the strongest evidence that
   * entry has already occurred.
   *
   * Existing OPEN/TP1/TP2 rows are also considered entered for
   * backwards compatibility.
   */

  let entered =
    Boolean(
      trade.entered_at
    ) ||
    trade.status ===
      "OPEN" ||
    trade.status ===
      "TP1_HIT" ||
    trade.status ===
      "TP2_HIT";

  let status =
    entered
      ? trade.status
      : "PENDING_ENTRY";

  let enteredAt =
    trade.entered_at ??
    null;

  /*
   * Persisted highest_target is now the source of truth.
   *
   * Status fallback supports old rows created before this field
   * was introduced.
   */

  let highestTarget =
    Math.max(
      Number(
        trade.highest_target ??
          0
      ),
      trade.status ===
        "TP2_HIT"
        ? 2
        : trade.status ===
            "TP1_HIT"
          ? 1
          : 0
    );

  let exitPrice:
    | number
    | null =
    null;

  let closedAt:
    | string
    | null =
    null;

  let exitReason:
    | string
    | null =
    trade.exit_reason ??
    null;

  let ambiguousIntrabarOutcome =
    Boolean(
      trade.ambiguous_intrabar_outcome
    );

  /*
   * Rebuild excursions for V2 from the relevant post-entry
   * candles instead of allowing pre-entry movement to contaminate
   * them.
   *
   * For already-entered rows, start with zero and recalculate.
   */

  let maxFavorableExcursionPercent =
    0;

  let maxAdverseExcursionPercent =
    0;

  let entryActivationCandleCloseTime:
    number |
    null =
    null;

  for (
    const candle of relevantCandles
  ) {
    /*
     * ========================================================
     * STEP 1 — WAIT FOR ENTRY
     * ========================================================
     */

    if (
      !entered
    ) {
      const entryTouched =
        candleTouchesEntryZone(
          candle,
          entryLow,
          entryHigh
        );

      if (
        !entryTouched
      ) {
        status =
          "PENDING_ENTRY";

        continue;
      }

      entered =
        true;

      status =
        "OPEN";

      enteredAt =
        new Date(
          candle.closeTime
        ).toISOString();

      entryActivationCandleCloseTime =
        candle.closeTime;

      /*
       * IMPORTANT:
       *
       * Do not evaluate SL/TP on this same candle.
       *
       * OHLC does not tell us whether the price path was:
       *
       * entry -> TP
       *
       * or:
       *
       * TP -> entry
       *
       * or:
       *
       * entry -> SL.
       *
       * Tracking starts on the following candle.
       */

      continue;
    }

    /*
     * If this run discovered the entry candle, make sure that
     * exact candle is not accidentally evaluated below.
     */

    if (
      entryActivationCandleCloseTime !==
        null &&
      candle.closeTime ===
        entryActivationCandleCloseTime
    ) {
      continue;
    }

    /*
     * ========================================================
     * STEP 2 — ACTIVE TRADE
     * ========================================================
     */

    const favorableMove =
      trade.signal ===
      "LONG"
        ? (
            (
              candle.high -
              entry
            ) /
            entry
          ) *
          100
        : (
            (
              entry -
              candle.low
            ) /
            entry
          ) *
          100;

    const adverseMove =
      trade.signal ===
      "LONG"
        ? (
            (
              entry -
              candle.low
            ) /
            entry
          ) *
          100
        : (
            (
              candle.high -
              entry
            ) /
            entry
          ) *
          100;

    maxFavorableExcursionPercent =
      Math.max(
        maxFavorableExcursionPercent,
        favorableMove
      );

    maxAdverseExcursionPercent =
      Math.max(
        maxAdverseExcursionPercent,
        adverseMove
      );

    const stopTouched =
      trade.signal ===
      "LONG"
        ? candle.low <=
          stop
        : candle.high >=
          stop;

    const tp1Touched =
      trade.signal ===
      "LONG"
        ? candle.high >=
          tp1
        : candle.low <=
          tp1;

    const tp2Touched =
      trade.signal ===
      "LONG"
        ? candle.high >=
          tp2
        : candle.low <=
          tp2;

    const tp3Touched =
      trade.signal ===
      "LONG"
        ? candle.high >=
          tp3
        : candle.low <=
          tp3;

    const deepestTarget =
      tp3Touched
        ? 3
        : tp2Touched
          ? 2
          : tp1Touched
            ? 1
            : 0;

    /*
     * ========================================================
     * SAME-CANDLE AMBIGUITY
     * ========================================================
     *
     * OHLC cannot reveal whether TP or SL happened first.
     *
     * Keep the conservative stop-first policy.
     */

    if (
      stopTouched
    ) {
      if (
        deepestTarget >
        0
      ) {
        ambiguousIntrabarOutcome =
          true;
      }

      /*
       * Preserve any target that this candle proves was touched,
       * even though stop-first determines the realized exit.
       */

      highestTarget =
        Math.max(
          highestTarget,
          deepestTarget
        );

      status =
        "STOPPED";

      exitPrice =
        stop;

      exitReason =
        "STOP_LOSS";

      closedAt =
        new Date(
          candle.closeTime
        ).toISOString();

      break;
    }

    /*
     * No stop was touched, so targets can safely advance.
     */

    highestTarget =
      Math.max(
        highestTarget,
        deepestTarget
      );

    if (
      highestTarget >=
      3
    ) {
      status =
        "TP3_HIT";

      exitPrice =
        tp3;

      exitReason =
        "TP3";

      closedAt =
        new Date(
          candle.closeTime
        ).toISOString();

      break;
    }

    if (
      highestTarget ===
      2
    ) {
      status =
        "TP2_HIT";
    } else if (
      highestTarget ===
      1
    ) {
      status =
        "TP1_HIT";
    } else {
      status =
        "OPEN";
    }
  }

  const isClosed =
    status ===
      "TP3_HIT" ||
    status ===
      "STOPPED";

  const lastPrice =
    relevantCandles.at(
      -1
    )?.close ??
    null;

  return {
    status,

    entered,

    enteredAt,

    exitPrice,

    closedAt,

    exitReason,

    pnlPercent:
      isClosed &&
      exitPrice !==
        null
        ? round(
            calculatePnl(
              trade.signal,
              entry,
              exitPrice
            ),
            4
          )
        : null,

    maxFavorableExcursionPercent:
      round(
        Math.max(
          0,
          maxFavorableExcursionPercent
        ),
        4
      ),

    maxAdverseExcursionPercent:
      round(
        Math.max(
          0,
          maxAdverseExcursionPercent
        ),
        4
      ),

    highestTarget,

    ambiguousIntrabarOutcome,

    candlesChecked:
      relevantCandles.length,

    lastPrice,
  };
}

/*
 * ============================================================
 * TRACK ACTIVE PAPER TRADES
 * ============================================================
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

    let body: {
      id?: string;
      symbol?: string;
    } = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    /*
     * PENDING_ENTRY must be included.
     */

    let query =
      supabase
        .from(
          "paper_trades"
        )
        .select(
          "id,symbol,interval,signal,entry_low,entry_high,stop_loss,tp1,tp2,tp3,status,opened_at,entered_at,highest_target,tracking_version,strategy_version,ambiguous_intrabar_outcome,exit_reason,current_price,max_favorable_excursion_percent,max_adverse_excursion_percent"
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
              true,
          }
        );

    if (
      body.id
    ) {
      query =
        query.eq(
          "id",
          body.id
        );
    }

    if (
      body.symbol
    ) {
      query =
        query.eq(
          "symbol",
          body.symbol
            .trim()
            .toUpperCase()
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    const trades =
      (
        data ??
        []
      ) as Trade[];

    const results:
      Record<
        string,
        unknown
      >[] = [];

    for (
      const trade of trades
    ) {
      try {
        if (
          !VALID_INTERVALS.has(
            trade.interval
          )
        ) {
          throw new Error(
            `Unsupported interval: ${trade.interval}`
          );
        }

        /*
         * PENDING trades need candles from opened_at.
         *
         * Entered trades can start from entered_at.
         */

        const candleStartTime =
          trade.entered_at
            ? new Date(
                trade.entered_at
              ).getTime()
            : new Date(
                trade.opened_at
              ).getTime();

        const marketCandles =
          await fetchCandles(
            trade.symbol,
            trade.interval,
            candleStartTime
          );

        const result =
          evaluateTrade(
            trade,
            marketCandles
          );

        /*
         * Compare all persisted V2 state.
         */

        const previousHighestTarget =
          Number(
            trade.highest_target ??
              0
          );

        const previousMfe =
          Number(
            trade.max_favorable_excursion_percent ??
              0
          );

        const previousMae =
          Number(
            trade.max_adverse_excursion_percent ??
              0
          );

        const previousAmbiguous =
          Boolean(
            trade.ambiguous_intrabar_outcome
          );

        const changed =
          result.status !==
            trade.status ||
          result.enteredAt !==
            (
              trade.entered_at ??
              null
            ) ||
          result.highestTarget !==
            previousHighestTarget ||
          result.maxFavorableExcursionPercent !==
            previousMfe ||
          result.maxAdverseExcursionPercent !==
            previousMae ||
          result.ambiguousIntrabarOutcome !==
            previousAmbiguous ||
          (
            result.lastPrice !==
              null &&
            result.lastPrice !==
              Number(
                trade.current_price ??
                  0
              )
          ) ||
          (
            result.exitReason !==
              null &&
            result.exitReason !==
              (
                trade.exit_reason ??
                null
              )
          );

        if (
          changed
        ) {
          const updatePayload:
            Record<
              string,
              unknown
            > = {
            status:
              result.status,

            highest_target:
              result.highestTarget,

            ambiguous_intrabar_outcome:
              result.ambiguousIntrabarOutcome,

            max_favorable_excursion_percent:
              result.maxFavorableExcursionPercent,

            max_adverse_excursion_percent:
              result.maxAdverseExcursionPercent,
          };

          /*
           * Persist actual entry activation time.
           */

          if (
            result.enteredAt
          ) {
            updatePayload.entered_at =
              result.enteredAt;
          }

          /*
           * Keep current market price fresh.
           */

          if (
            result.lastPrice !==
            null
          ) {
            updatePayload.current_price =
              result.lastPrice;
          }

          /*
           * Closed trade fields.
           */

          if (
            result.exitPrice !==
            null
          ) {
            updatePayload.exit_price =
              result.exitPrice;
          }

          if (
            result.closedAt
          ) {
            updatePayload.closed_at =
              result.closedAt;
          }

          if (
            result.pnlPercent !==
            null
          ) {
            updatePayload.pnl_percent =
              result.pnlPercent;
          }

          if (
            result.exitReason
          ) {
            updatePayload.exit_reason =
              result.exitReason;
          }

          const {
            error:
              updateError,
          } =
            await supabase
              .from(
                "paper_trades"
              )
              .update(
                updatePayload
              )
              .eq(
                "id",
                trade.id
              );

          if (
            updateError
          ) {
            throw new Error(
              updateError.message
            );
          }
        }

        results.push({
          success:
            true,

          id:
            trade.id,

          symbol:
            trade.symbol,

          interval:
            trade.interval,

          signal:
            trade.signal,

          strategyVersion:
            trade.strategy_version,

          trackingVersion:
            trade.tracking_version,

          previousStatus:
            trade.status,

          status:
            result.status,

          entered:
            result.entered,

          enteredAt:
            result.enteredAt,

          changed,

          highestTarget:
            result.highestTarget,

          exitPrice:
            result.exitPrice,

          exitReason:
            result.exitReason,

          pnlPercent:
            result.pnlPercent,

          maxFavorableExcursionPercent:
            result.maxFavorableExcursionPercent,

          maxAdverseExcursionPercent:
            result.maxAdverseExcursionPercent,

          candlesChecked:
            result.candlesChecked,

          lastPrice:
            result.lastPrice,

          ambiguousIntrabarOutcome:
            result.ambiguousIntrabarOutcome,

          ambiguityPolicy:
            result.ambiguousIntrabarOutcome
              ? "SL and TP were touched inside the same OHLC candle. Conservative stop-first policy applied."
              : null,
        });
      } catch (
        tradeError
      ) {
        results.push({
          success:
            false,

          id:
            trade.id,

          symbol:
            trade.symbol,

          error:
            tradeError instanceof Error
              ? tradeError.message
              : "Tracking failed for this trade.",
        });
      }
    }

    return NextResponse.json({
      success:
        true,

      version:
        "paper-tracker-v3",

      checked:
        trades.length,

      updated:
        results.filter(
          (
            item
          ) =>
            item.success ===
              true &&
            item.changed ===
              true
        ).length,

      results,

      methodology:
        "V2 signals remain PENDING_ENTRY until Binance candle range overlaps the entry zone. entered_at is persisted on activation. SL/TP evaluation starts after the entry candle. highest_target is persisted. TP3 or SL closes the trade. Same-candle SL/TP ambiguity uses conservative stop-first handling.",

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Paper trade tracker error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to track paper trades.",
      },
      {
        status:
          500,
      }
    );
  }
}