import {
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPOT_BASE =
  "https://data-api.binance.vision";

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

type SpotTicker = {
  symbol: string;

  lastPrice: string;

  priceChangePercent: string;

  quoteVolume: string;

  volume: string;
};

type MarketItem = {
  symbol: string;
  baseAsset: string;
  price: number;
  change24h: number;
  quoteVolume24h: number;
  volume24h: number;
};

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        cache: "no-store",

        signal:
          AbortSignal.timeout(
            15000
          ),
      }
    );

  if (!response.ok) {
    const body =
      await response
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      `Binance Spot request failed: ${
        response.status
      }${
        body
          ? ` - ${body.slice(
              0,
              150
            )}`
          : ""
      }`
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
      spotTickers,
    ] =
      await Promise.all([
        fetchJson<SpotExchangeInfo>(
          `${SPOT_BASE}/api/v3/exchangeInfo`
        ),

        fetchJson<SpotTicker[]>(
          `${SPOT_BASE}/api/v3/ticker/24hr`
        ),
      ]);

    /*
     * Find active Binance Spot
     * USDT markets.
     */

    const spotSymbols =
      new Map<
        string,
        {
          baseAsset: string;
        }
      >();

    for (
      const item of
      spotInfo.symbols
    ) {
      if (
        item.quoteAsset !==
          "USDT" ||
        item.status !==
          "TRADING" ||
        item
          .isSpotTradingAllowed ===
          false ||
        EXCLUDED_BASE_ASSETS.has(
          item.baseAsset
        )
      ) {
        continue;
      }

      spotSymbols.set(
        item.symbol,
        {
          baseAsset:
            item.baseAsset,
        }
      );
    }

    /*
     * Build ticker map using the
     * Binance Spot 24h market data.
     */

    const tickerMap =
      new Map(
        spotTickers.map(
          (ticker) => [
            ticker.symbol,
            ticker,
          ]
        )
      );

    const markets:
      MarketItem[] =
      [];

    for (
      const [
        symbol,
        info,
      ] of
      spotSymbols
    ) {
      const ticker =
        tickerMap.get(
          symbol
        );

      if (!ticker) {
        continue;
      }

      const price =
        safeNumber(
          ticker.lastPrice
        );

      const quoteVolume =
        safeNumber(
          ticker.quoteVolume
        );

      if (
        price <= 0 ||
        quoteVolume <= 0
      ) {
        continue;
      }

      markets.push({
        symbol,

        baseAsset:
          info.baseAsset,

        price,

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
     * Highest 24-hour USDT
     * trading volume first.
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
          false,

        ranking:
          "24h spot quote volume",

        source:
          "Binance Spot public market-data endpoint",

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

        count:
          0,

        symbols:
          [],

        error:
          error instanceof Error
            ? error.message
            : "Unable to load trading markets.",

        updatedAt:
          new Date()
            .toISOString(),
      },
      {
        status:
          500,
      }
    );
  }
}