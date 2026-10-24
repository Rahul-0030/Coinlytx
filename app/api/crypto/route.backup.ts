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

const CACHE_SECONDS = 120;

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

    const apiKey = process.env.COINGECKO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          coins: [],
          message: "CoinGecko API key is missing.",
        },
        { status: 500 }
      );
    }

    const ids = COINS.join(",");

    const url =
      "https://api.coingecko.com/api/v3/coins/markets" +
      `?vs_currency=usd` +
      `&ids=${encodeURIComponent(ids)}` +
      `&order=market_cap_desc` +
      `&sparkline=true` +
      `&price_change_percentage=1h,24h,7d`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-cg-demo-api-key": apiKey,
      },
    });

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
          "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
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