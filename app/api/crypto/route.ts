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

const CACHE_SECONDS = 300;

export async function GET() {
  try {
    const cache = (caches as CacheStorage & { default: Cache }).default;

    const cacheKey = new Request(
      "https://coinlytx.com/__cache/crypto-market",
      { method: "GET" }
    );

    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    const ids = COINS.join(",");

    const url =
      "https://api.coingecko.com/api/v3/coins/markets" +
      `?vs_currency=usd` +
      `&ids=${encodeURIComponent(ids)}` +
      `&order=market_cap_desc` +
      `&sparkline=true` +
      `&price_change_percentage=1h,24h,7d`;

    const apiKey = process.env.COINGECKO_API_KEY;

    let response: Response;

    if (apiKey) {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Coinlytx/1.0 (+https://coinlytx.com)",
          "x-cg-demo-api-key": apiKey,
        },
      });

      // Demo quota exhausted -> retry using public CoinGecko API
      if (response.status === 429) {
        console.warn(
          "CoinGecko Demo quota exceeded. Falling back to public API."
        );

        response = await fetch(url, {
          headers: {
            Accept: "application/json",
          "User-Agent": "Coinlytx/1.0 (+https://coinlytx.com)",
          },
        });
      }
    } else {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Coinlytx/1.0 (+https://coinlytx.com)",
        },
      });
    }

    if (!response.ok) {
      const body = await response.text();

      console.error(
        `CoinGecko request failed ${response.status}:`,
        body
      );

      return NextResponse.json(
        {
          success: false,
          coins: [],
          message: `CoinGecko returned ${response.status}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const result = NextResponse.json(
      {
        success: true,
        updatedAt: new Date().toISOString(),
        coins: data,
      },
      {
        headers: {
          "Cache-Control":
            `public, max-age=60, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=600`,
        },
      }
    );

    await cache.put(cacheKey, result.clone());

    return result;
  } catch (error) {
    console.error("Crypto API error:", error);

    return NextResponse.json(
      {
        success: false,
        coins: [],
        message: "Unable to load crypto market data.",
      },
      { status: 500 }
    );
  }
}

