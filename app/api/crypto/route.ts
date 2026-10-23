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
    const apiKey = process.env.COINGECKO_API_KEY;

    if (!apiKey) {
      console.error("COINGECKO_API_KEY is missing");

      return NextResponse.json(
        {
          success: false,
          coins: [],
          message: "Crypto API key is not configured.",
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
      const errorBody = await response.text();

      console.error(
        `CoinGecko request failed ${response.status}:`,
        errorBody
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

    return NextResponse.json(
      {
        success: true,
        updatedAt: new Date().toISOString(),
        coins: data,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=120",
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
      { status: 500 }
    );
  }
}