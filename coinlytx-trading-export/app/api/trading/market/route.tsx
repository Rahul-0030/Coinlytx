import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BASE =
  "https://data-api.binance.vision";

const ALLOWED_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
];

const ALLOWED_INTERVALS = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
];

type BinanceTicker = {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

function toNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const requestedSymbol =
      (
        searchParams.get("symbol") ||
        "BTCUSDT"
      ).toUpperCase();

    const requestedInterval =
      searchParams.get("interval") ||
      "15m";

    const symbol =
      ALLOWED_SYMBOLS.includes(
        requestedSymbol
      )
        ? requestedSymbol
        : "BTCUSDT";

    const interval =
      ALLOWED_INTERVALS.includes(
        requestedInterval
      )
        ? requestedInterval
        : "15m";

    const tickerRequests =
      ALLOWED_SYMBOLS.map(
        async (marketSymbol) => {
          const response = await fetch(
            `${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${marketSymbol}`,
            {
              cache: "no-store",
            }
          );

          if (!response.ok) {
            throw new Error(
              `Unable to load ${marketSymbol}`
            );
          }

          return (await response.json()) as BinanceTicker;
        }
      );

    const candlesRequest = fetch(
      `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`,
      {
        cache: "no-store",
      }
    );

    const [
      tickerResults,
      candlesResponse,
    ] = await Promise.all([
      Promise.all(tickerRequests),
      candlesRequest,
    ]);

    if (!candlesResponse.ok) {
      throw new Error(
        "Unable to load candles."
      );
    }

    const rawCandles =
      (await candlesResponse.json()) as BinanceKline[];

    const markets =
      tickerResults.map(
        (ticker) => ({
          symbol: ticker.symbol,
          baseAsset:
            ticker.symbol.replace(
              "USDT",
              ""
            ),
          price: toNumber(
            ticker.lastPrice
          ),
          change24h: toNumber(
            ticker.priceChangePercent
          ),
          high24h: toNumber(
            ticker.highPrice
          ),
          low24h: toNumber(
            ticker.lowPrice
          ),
          volume24h: toNumber(
            ticker.volume
          ),
          quoteVolume24h:
            toNumber(
              ticker.quoteVolume
            ),
          bidPrice: toNumber(
            ticker.bidPrice
          ),
          askPrice: toNumber(
            ticker.askPrice
          ),
          tradeCount:
            ticker.count || 0,
        })
      );

    const candles =
      rawCandles.map(
        (candle) => ({
          openTime: candle[0],
          open: toNumber(
            candle[1]
          ),
          high: toNumber(
            candle[2]
          ),
          low: toNumber(
            candle[3]
          ),
          close: toNumber(
            candle[4]
          ),
          volume: toNumber(
            candle[5]
          ),
          closeTime:
            candle[6],
          quoteVolume:
            toNumber(
              candle[7]
            ),
          trades:
            candle[8],
        })
      );

    return NextResponse.json({
      success: true,
      symbol,
      interval,
      markets,
      candles,
      updatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Trading market API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load market data.",
      },
      {
        status: 500,
      }
    );
  }
}