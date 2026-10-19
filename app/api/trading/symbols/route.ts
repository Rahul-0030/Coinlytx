import {
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPOT_BASE =
  "https://data-api.binance.vision";

const OKX_BASE =
  "https://openapi.okx.com";

/*
 * Assets we do not want the
 * trading engine to treat as
 * directional crypto markets.
 */
const EXCLUDED_BASE_ASSETS =
  new Set([
    "USDT",
    "USDC",
    "FDUSD",
    "TUSD",
    "USDP",
    "DAI",
    "BUSD",
    "USD1",
    "RLUSD",
    "PYUSD",
    "USDE",
    "USDS",
    "GUSD",
    "FRAX",
    "LUSD",
    "EURC",
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

type OkxInstrument = {
  instType?: string;

  instId?: string;

  instFamily?: string;

  uly?: string;

  settleCcy?: string;

  ctValCcy?: string;

  state?: string;

  ruleType?: string;

  instCategory?: string;
};

type OkxResponse<T> = {
  code: string;

  msg: string;

  data: T[];
};

type MarketItem = {
  symbol: string;

  baseAsset: string;

  price: number;

  change24h: number;

  quoteVolume24h: number;

  volume24h: number;

  derivativesProvider: "OKX";

  derivativesSymbol: string;
};

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
      `Request failed: ${
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

async function fetchOkxInstruments() {
  const response =
    await fetchJson<
      OkxResponse<OkxInstrument>
    >(
      `${OKX_BASE}/api/v5/public/instruments?instType=SWAP`
    );

  if (
    response.code !== "0"
  ) {
    throw new Error(
      response.msg ||
        `OKX instruments request failed with code ${response.code}.`
    );
  }

  return response.data;
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

function getBaseFromOkxSwap(
  instId: string
) {
  const suffix =
    "-USDT-SWAP";

  if (
    !instId.endsWith(
      suffix
    )
  ) {
    return null;
  }

  const base =
    instId.slice(
      0,
      -suffix.length
    );

  return base || null;
}

export async function GET() {
  try {
    /*
     * Load Binance Spot market
     * information, Binance 24h
     * tickers and all OKX
     * perpetual instruments in
     * parallel.
     */

    const [
      spotInfo,
      spotTickers,
      okxInstruments,
    ] =
      await Promise.all([
        fetchJson<SpotExchangeInfo>(
          `${SPOT_BASE}/api/v3/exchangeInfo`
        ),

        fetchJson<SpotTicker[]>(
          `${SPOT_BASE}/api/v3/ticker/24hr`
        ),

        fetchOkxInstruments(),
      ]);

    /*
     * Build the set of live
     * OKX crypto USDT perpetual
     * contracts.
     *
     * Example:
     *
     * BTC-USDT-SWAP
     * ETH-USDT-SWAP
     * SOL-USDT-SWAP
     */

    const okxSwapMap =
      new Map<
        string,
        string
      >();

    for (
      const instrument of
      okxInstruments
    ) {
      const instId =
        instrument.instId ??
        "";

      const baseAsset =
        getBaseFromOkxSwap(
          instId
        );

      if (!baseAsset) {
        continue;
      }

      /*
       * Only currently tradable
       * perpetuals.
       */

      if (
        instrument.state !==
        "live"
      ) {
        continue;
      }

      /*
       * USDT-settled contracts
       * only.
       */

      if (
        instrument.settleCcy &&
        instrument.settleCcy !==
          "USDT"
      ) {
        continue;
      }

      /*
       * OKX currently identifies
       * ordinary crypto assets
       * with instCategory "1".
       *
       * If the field is absent,
       * retain compatibility with
       * older API responses.
       */

      if (
        instrument.instCategory &&
        instrument.instCategory !==
          "1"
      ) {
        continue;
      }

      /*
       * Avoid known non-directional
       * dollar/stablecoin bases.
       */

      if (
        EXCLUDED_BASE_ASSETS.has(
          baseAsset
        )
      ) {
        continue;
      }

      okxSwapMap.set(
        baseAsset,
        instId
      );
    }

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
          false
      ) {
        continue;
      }

      if (
        EXCLUDED_BASE_ASSETS.has(
          item.baseAsset
        )
      ) {
        continue;
      }

      /*
       * This is the key safety
       * filter:
       *
       * if there is no live OKX
       * USDT perpetual for the
       * same base asset, it cannot
       * enter our trading universe.
       */

      if (
        !okxSwapMap.has(
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
     * Binance Spot ticker map.
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

      const volume =
        safeNumber(
          ticker.volume
        );

      if (
        price <= 0 ||
        quoteVolume <= 0 ||
        volume <= 0
      ) {
        continue;
      }

      const derivativesSymbol =
        okxSwapMap.get(
          info.baseAsset
        );

      if (
        !derivativesSymbol
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
          volume,

        derivativesProvider:
          "OKX",

        derivativesSymbol,
      });
    }

    /*
     * Rank compatible markets
     * using Binance Spot 24-hour
     * USDT quote volume.
     */

    markets.sort(
      (a, b) =>
        b.quoteVolume24h -
        a.quoteVolume24h
    );

    /*
     * Important:
     *
     * We filter for OKX support
     * BEFORE taking the first 50.
     *
     * Therefore we still return
     * up to 50 usable coins,
     * rather than selecting
     * Binance Top 50 first and
     * losing unsupported assets.
     */

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

      universe: {
        compatibleMarkets:
          markets.length,

        okxLiveUsdtSwaps:
          okxSwapMap.size,
      },

      methodology: {
        quoteAsset:
          "USDT",

        spotRequired:
          true,

        derivativesRequired:
          true,

        spotProvider:
          "Binance Spot",

        derivativesProvider:
          "OKX USDT Perpetual Swap",

        ranking:
          "24h Binance Spot USDT quote volume",

        filtering:
          "Active Binance Spot USDT market + live OKX crypto USDT perpetual",

        stablecoinsExcluded:
          true,

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