import {
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPOT_BASE =
  "https://data-api.binance.vision";

const FUTURES_BASE =
  "https://fapi.binance.com";

const EXCLUDED_BASE_ASSETS =
  new Set([
    "USDT",
    "USDC",
    "FDUSD",
    "TUSD",
    "USDP",
    "DAI",
    "BUSD",
  ]);

type SpotExchangeInfo = {
  symbols: {
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    isSpotTradingAllowed?: boolean;
  }[];
};

type FuturesExchangeInfo = {
  symbols: {
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    contractType: string;
  }[];
};

type FuturesTicker = {
  symbol: string;

  lastPrice: string;

  priceChangePercent: string;

  quoteVolume: string;

  volume: string;
};

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `Binance request failed: ${response.status}`
    );
  }

  return (
    await response.json()
  ) as T;
}

function safeNumber(
  value: unknown
) {
  const result =
    Number(value);

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}

export async function GET() {
  try {
    const [
      spotInfo,
      futuresInfo,
      futuresTickers,
    ] =
      await Promise.all([
        fetchJson<SpotExchangeInfo>(
          `${SPOT_BASE}/api/v3/exchangeInfo`
        ),

        fetchJson<FuturesExchangeInfo>(
          `${FUTURES_BASE}/fapi/v1/exchangeInfo`
        ),

        fetchJson<FuturesTicker[]>(
          `${FUTURES_BASE}/fapi/v1/ticker/24hr`
        ),
      ]);

    /*
     * Spot USDT pairs that are
     * currently trading.
     */

    const spotSymbols =
      new Set(
        spotInfo.symbols
          .filter(
            (item) =>
              item.quoteAsset ===
                "USDT" &&
              item.status ===
                "TRADING" &&
              item
                .isSpotTradingAllowed !==
                false &&
              !EXCLUDED_BASE_ASSETS.has(
                item.baseAsset
              )
          )
          .map(
            (item) =>
              item.symbol
          )
      );

    /*
     * Futures USDT perpetuals
     * that are currently trading.
     */

    const futuresSymbols =
      new Map<
        string,
        {
          symbol: string;
          baseAsset: string;
        }
      >();

    for (
      const item of
      futuresInfo.symbols
    ) {
      if (
        item.quoteAsset !==
          "USDT" ||
        item.status !==
          "TRADING" ||
        item.contractType !==
          "PERPETUAL" ||
        EXCLUDED_BASE_ASSETS.has(
          item.baseAsset
        )
      ) {
        continue;
      }

      futuresSymbols.set(
        item.symbol,
        {
          symbol:
            item.symbol,

          baseAsset:
            item.baseAsset,
        }
      );
    }

    /*
     * Only keep coins supported
     * by BOTH spot and futures.
     */

    const tickerMap =
      new Map(
        futuresTickers.map(
          (ticker) => [
            ticker.symbol,
            ticker,
          ]
        )
      );

    const markets: {
      symbol: string;
      baseAsset: string;
      price: number;
      change24h: number;
      quoteVolume24h: number;
      volume24h: number;
    }[] = [];

    for (
      const [
        symbol,
        info,
      ] of
      futuresSymbols
    ) {
      if (
        !spotSymbols.has(
          symbol
        )
      ) {
        continue;
      }

      const ticker =
        tickerMap.get(
          symbol
        );

      if (!ticker) {
        continue;
      }

      const quoteVolume =
        safeNumber(
          ticker.quoteVolume
        );

      if (
        quoteVolume <=
        0
      ) {
        continue;
      }

      markets.push({
        symbol,

        baseAsset:
          info.baseAsset,

        price:
          safeNumber(
            ticker.lastPrice
          ),

        change24h:
          safeNumber(
            ticker
              .priceChangePercent
          ),

        quoteVolume24h:
          quoteVolume,

        volume24h:
          safeNumber(
            ticker.volume
          ),
      });
    }

    /*
     * Highest-liquidity markets
     * first.
     */

    markets.sort(
      (a, b) =>
        b.quoteVolume24h -
        a.quoteVolume24h
    );

    const top50 =
      markets.slice(
        0,
        50
      );

    return NextResponse.json({
      success: true,

      count:
        top50.length,

      symbols:
        top50,

      methodology: {
        quoteAsset:
          "USDT",

        spotRequired:
          true,

        futuresRequired:
          true,

        futuresContract:
          "PERPETUAL",

        ranking:
          "24h futures quote volume",

        limit:
          50,
      },

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Trading symbols API error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load trading markets.",
      },
      {
        status:
          500,
      }
    );
  }
}