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

export async function GET() {
  try {
    const ids = COINS.join(",");

    const url =
      "https://api.coingecko.com/api/v3/coins/markets" +
      `?vs_currency=usd` +
      `&ids=${ids}` +
      `&order=market_cap_desc` +
      `&sparkline=true` +
      `&price_change_percentage=1h,24h,7d`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },

      next: {
        revalidate: 30,
      },
    });

    if (!response.ok) {
      throw new Error(
        `CoinGecko request failed: ${response.status}`
      );
    }

    const data = await response.json();

    return NextResponse.json(
      {
        success: true,
        updatedAt: new Date().toISOString(),
        coins: data,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Crypto API error:", error);

    return NextResponse.json(
      {
        success: false,
        coins: [],
        message: "Unable to load crypto market data.",
      },
      {
        status: 500,
      }
    );
  }
}