import { NextResponse } from "next/server";

const COINS = [
  "bitcoin",
  "ethereum",
  "tether",
  "binancecoin",
  "solana",
  "ripple",
  "usd-coin",
  "dogecoin",
  "cardano",
  "tron",
  "chainlink",
  "avalanche-2",
];

const SYMBOLS = [
  "BTC",
  "ETH",
  "USDT",
  "BNB",
  "SOL",
  "XRP",
  "USDC",
  "DOGE",
  "ADA",
  "TRX",
  "LINK",
  "AVAX",
];

const CG_ID_BY_SYMBOL: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  USDC: "usd-coin",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  LINK: "chainlink",
  AVAX: "avalanche-2",
};

const CACHE_SECONDS = 600;

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getCoinLoreFallback() {
  const response = await fetch(
    "https://api.coinlore.net/api/tickers/?start=0&limit=100",
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Coinlytx/1.0 (+https://coinlytx.com)",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `CoinLore returned ${response.status}`
    );
  }

  const result = (await response.json()) as {
    data?: Array<Record<string, any>>;
  };

  const allCoins = Array.isArray(result.data)
    ? result.data
    : [];

  const bySymbol = new Map(
    allCoins.map((coin) => [
      String(coin.symbol || "").toUpperCase(),
      coin,
    ])
  );

  return SYMBOLS.map((symbol) => {
    const coin = bySymbol.get(symbol);

    if (!coin) {
      return null;
    }

    const price = num(coin.price_usd) ?? 0;
    const totalSupply = num(coin.tsupply);
    const maxSupply = num(coin.msupply);

    return {
      id: CG_ID_BY_SYMBOL[symbol],
      symbol: symbol.toLowerCase(),
      name: coin.name,

      image:
        `https://c2.coinlore.com/img/25x25/${coin.nameid}.png`,

      current_price: price,

      market_cap:
        num(coin.market_cap_usd) ?? 0,

      market_cap_rank:
        Number(coin.rank) || 0,

      fully_diluted_valuation:
        totalSupply
          ? totalSupply * price
          : null,

      total_volume:
        num(coin.volume24) ?? 0,

      // CoinLore ticker does not expose exact
      // 24h high/low in this endpoint.
      // Current price is used as a safe UI fallback.
      high_24h: price,
      low_24h: price,

      price_change_24h:
        price *
        ((num(coin.percent_change_24h) ?? 0) / 100),

      price_change_percentage_24h:
        num(coin.percent_change_24h) ?? 0,

      market_cap_change_24h: null,
      market_cap_change_percentage_24h: null,

      circulating_supply:
        num(coin.csupply),

      total_supply:
        totalSupply,

      max_supply:
        maxSupply,

      ath: null,
      ath_change_percentage: null,
      ath_date: null,

      atl: null,
      atl_change_percentage: null,
      atl_date: null,

      roi: null,

      last_updated:
        new Date().toISOString(),

      sparkline_in_7d: {
        price: [],
      },

      price_change_percentage_1h_in_currency:
        num(coin.percent_change_1h) ?? 0,

      price_change_percentage_24h_in_currency:
        num(coin.percent_change_24h) ?? 0,

      price_change_percentage_7d_in_currency:
        num(coin.percent_change_7d) ?? 0,
    };
  }).filter(Boolean);
}

export async function GET() {
  try {
    const cache = (
      caches as CacheStorage & {
        default: Cache;
      }
    ).default;

    const cacheKey = new Request(
      "https://coinlytx.com/__cache/crypto-market-v2",
      {
        method: "GET",
      }
    );

    const cachedResponse =
      await cache.match(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    const ids = COINS.join(",");

    const coinGeckoUrl =
      "https://api.coingecko.com/api/v3/coins/markets" +
      `?vs_currency=usd` +
      `&ids=${encodeURIComponent(ids)}` +
      `&order=market_cap_desc` +
      `&sparkline=true` +
      `&price_change_percentage=1h,24h,7d`;

    const apiKey =
      process.env.COINGECKO_API_KEY;

    let coins: any[] = [];
    let source = "coinlore";

    /*
     * Try CoinGecko first only when the
     * configured Demo key exists.
     */
    if (apiKey) {
      try {
        const response = await fetch(
          coinGeckoUrl,
          {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "Coinlytx/1.0 (+https://coinlytx.com)",
              "x-cg-demo-api-key":
                apiKey,
            },
          }
        );

        if (response.ok) {
          coins = await response.json();
          source = "coingecko";
        } else {
          console.warn(
            `CoinGecko returned ${response.status}. Using CoinLore fallback.`
          );
        }
      } catch (error) {
        console.warn(
          "CoinGecko request failed. Using CoinLore fallback.",
          error
        );
      }
    }

    /*
     * CoinGecko failed, is rate limited,
     * or has no usable key.
     */
    if (coins.length === 0) {
      coins =
        (await getCoinLoreFallback()) as any[];

      source = "coinlore";
    }

    if (coins.length === 0) {
      throw new Error(
        "No crypto market data returned."
      );
    }

    const result =
      NextResponse.json(
        {
          success: true,
          source,
          updatedAt:
            new Date().toISOString(),
          coins,
        },
        {
          headers: {
            "Cache-Control":
              `public, max-age=60, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=1800`,
            "X-Crypto-Source":
              source,
          },
        }
      );

    await cache.put(
      cacheKey,
      result.clone()
    );

    return result;
  } catch (error) {
    console.error(
      "Crypto API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        coins: [],
        message:
          "Unable to load crypto market data.",
      },
      {
        status: 500,
      }
    );
  }
}