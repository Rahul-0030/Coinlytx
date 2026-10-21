import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Regime = "RISK_ON" | "RISK_OFF" | "NEUTRAL";
type DataQuality = "GOOD" | "PARTIAL" | "LOW";
type FredPoint = { date: string; value: number };
type SafeResult<T> = { ok: boolean; data: T | null; error: string | null };

let macroCache: { expiresAt: number; data: unknown } | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    return cause ? `${error.message}; cause: ${String(cause)}` : error.message;
  }
  return String(error);
}

async function safeJson<T>(url: string, timeoutMs = 8000): Promise<SafeResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CoinlytxTradingIntelligence/2.0",
      },
    });

    if (!response.ok) {
      return { ok: false, data: null, error: `HTTP ${response.status}` };
    }

    try {
      return { ok: true, data: (await response.json()) as T, error: null };
    } catch (error) {
      return { ok: false, data: null, error: `Invalid JSON: ${errorText(error)}` };
    }
  } catch (error) {
    return { ok: false, data: null, error: errorText(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(url: string, timeoutMs = 9000): Promise<SafeResult<string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "User-Agent": "CoinlytxTradingIntelligence/2.0",
      },
    });

    if (!response.ok) {
      return { ok: false, data: null, error: `HTTP ${response.status}` };
    }

    return { ok: true, data: await response.text(), error: null };
  } catch (error) {
    return { ok: false, data: null, error: errorText(error) };
  } finally {
    clearTimeout(timer);
  }
}

function getStartDate(daysBack = 60) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function parseFredCsv(csv: string): FredPoint[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const points: FredPoint[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    if (parts.length < 2) continue;

    const date = parts[0].replace(/"/g, "").trim();
    const rawValue = parts[1].replace(/"/g, "").trim();

    if (!date || !rawValue || rawValue === ".") continue;

    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    points.push({ date, value });
  }

  return points;
}

async function safeFredSeries(seriesId: string) {
  const from = getStartDate(60);
  const url =
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}` +
    `&cosd=${encodeURIComponent(from)}`;

  const result = await safeText(url, 10000);

  if (!result.ok || !result.data) {
    return { ok: false, data: null, error: result.error || `${seriesId} unavailable` };
  }

  const points = parseFredCsv(result.data);
  if (points.length === 0) {
    return { ok: false, data: null, error: `${seriesId} returned no valid observations` };
  }

  const latest = points[points.length - 1];
  const previous = points.length >= 2 ? points[points.length - 2] : latest;

  return { ok: true, data: { latest, previous, observations: points.length }, error: null };
}

async function getGlobalCrypto() {
  const gecko = await safeJson<{
    data?: {
      active_cryptocurrencies?: number;
      total_market_cap?: { usd?: number };
      total_volume?: { usd?: number };
      market_cap_percentage?: { btc?: number };
      market_cap_change_percentage_24h_usd?: number;
      updated_at?: number;
    };
  }>("https://api.coingecko.com/api/v3/global", 7000);

  if (gecko.ok && gecko.data?.data) {
    const g = gecko.data.data;
    return {
      ok: true,
      data: {
        provider: "CoinGecko",
        totalMarketCapUsd: Number(g.total_market_cap?.usd ?? 0),
        totalVolume24hUsd: Number(g.total_volume?.usd ?? 0),
        btcDominancePercent: Number(g.market_cap_percentage?.btc ?? 0),
        marketCapChange24hPercent: Number(g.market_cap_change_percentage_24h_usd ?? 0),
        activeCryptocurrencies: Number(g.active_cryptocurrencies ?? 0),
        updatedAt: typeof g.updated_at === "number" ? new Date(g.updated_at * 1000).toISOString() : null,
      },
      error: null,
    };
  }

  const paprika = await safeJson<{
    market_cap_usd?: number;
    volume_24h_usd?: number;
    bitcoin_dominance_percentage?: number;
    cryptocurrencies_number?: number;
    market_cap_change_24h?: number;
    last_updated?: number;
  }>("https://api.coinpaprika.com/v1/global", 7000);

  if (paprika.ok && paprika.data) {
    const g = paprika.data;
    return {
      ok: true,
      data: {
        provider: "CoinPaprika",
        totalMarketCapUsd: Number(g.market_cap_usd ?? 0),
        totalVolume24hUsd: Number(g.volume_24h_usd ?? 0),
        btcDominancePercent: Number(g.bitcoin_dominance_percentage ?? 0),
        marketCapChange24hPercent: Number(g.market_cap_change_24h ?? 0),
        activeCryptocurrencies: Number(g.cryptocurrencies_number ?? 0),
        updatedAt: typeof g.last_updated === "number" ? new Date(g.last_updated * 1000).toISOString() : null,
      },
      error: null,
    };
  }

  return {
    ok: false,
    data: null,
    error: `CoinGecko: ${gecko.error || "unavailable"}; CoinPaprika: ${paprika.error || "unavailable"}`,
  };
}

async function getBtcTicker() {
  const result = await safeJson<{
    lastPrice?: string;
    priceChangePercent?: string;
    quoteVolume?: string;
  }>("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT", 7000);

  if (!result.ok || !result.data) {
    return { ok: false, data: null, error: result.error || "BTC ticker unavailable" };
  }

  return {
    ok: true,
    data: {
      price: Number(result.data.lastPrice ?? 0),
      change24hPercent: Number(result.data.priceChangePercent ?? 0),
      quoteVolume24hUsd: Number(result.data.quoteVolume ?? 0),
    },
    error: null,
  };
}

function scoreCryptoMarket(changePercent: number) {
  return clamp(changePercent * 12, -100, 100);
}

function scoreBtcMomentum(changePercent: number) {
  return clamp(changePercent * 12, -100, 100);
}

function scoreVix(latest: number, changePercent: number) {
  let score = clamp(-changePercent * 8, -80, 80);
  if (latest >= 30) score -= 20;
  else if (latest >= 25) score -= 12;
  else if (latest <= 15) score += 10;
  return clamp(score, -100, 100);
}

function scoreDollar(changePercent: number) {
  return clamp(-changePercent * 40, -100, 100);
}

function scoreYield(changeBps: number) {
  return clamp(-changeBps * 4, -100, 100);
}

function regimeFromScore(score: number): Regime {
  if (score >= 20) return "RISK_ON";
  if (score <= -20) return "RISK_OFF";
  return "NEUTRAL";
}

function btcDominanceLabel(value: number) {
  if (value >= 60) return "BTC_DOMINANT";
  if (value <= 45) return "ALT_HEAVY";
  return "BALANCED";
}

export async function GET() {
  const now = Date.now();

  if (macroCache && macroCache.expiresAt > now) {
    return NextResponse.json(macroCache.data);
  }

  const [cryptoResult, btcResult, vixResult, dollarResult, yieldResult] = await Promise.all([
    getGlobalCrypto(),
    getBtcTicker(),
    safeFredSeries("VIXCLS"),
    safeFredSeries("DTWEXBGS"),
    safeFredSeries("DGS10"),
  ]);

  const sourceFailures: Array<{ source: string; error: string }> = [];

  if (!cryptoResult.ok) sourceFailures.push({ source: "Global crypto market", error: cryptoResult.error || "Unavailable" });
  if (!btcResult.ok) sourceFailures.push({ source: "Binance BTCUSDT", error: btcResult.error || "Unavailable" });
  if (!vixResult.ok) sourceFailures.push({ source: "FRED VIXCLS", error: vixResult.error || "Unavailable" });
  if (!dollarResult.ok) sourceFailures.push({ source: "FRED DTWEXBGS", error: dollarResult.error || "Unavailable" });
  if (!yieldResult.ok) sourceFailures.push({ source: "FRED DGS10", error: yieldResult.error || "Unavailable" });

  const crypto = cryptoResult.ok ? cryptoResult.data : null;
  const btc = btcResult.ok ? btcResult.data : null;
  const vix = vixResult.ok ? vixResult.data : null;
  const dollar = dollarResult.ok ? dollarResult.data : null;
  const tenYear = yieldResult.ok ? yieldResult.data : null;

  const cryptoScore = crypto ? scoreCryptoMarket(crypto.marketCapChange24hPercent) : 0;
  const btcScore = btc ? scoreBtcMomentum(btc.change24hPercent) : 0;
  const vixChangePercent = vix ? percentChange(vix.latest.value, vix.previous.value) : 0;
  const vixScore = vix ? scoreVix(vix.latest.value, vixChangePercent) : 0;
  const dollarChangePercent = dollar ? percentChange(dollar.latest.value, dollar.previous.value) : 0;
  const dollarScore = dollar ? scoreDollar(dollarChangePercent) : 0;
  const tenYearChangeBps = tenYear ? (tenYear.latest.value - tenYear.previous.value) * 100 : 0;
  const yieldScore = tenYear ? scoreYield(tenYearChangeBps) : 0;

  const components = [
    { key: "cryptoMarket", available: Boolean(crypto), baseWeight: 30, score: cryptoScore, contribution: 0 },
    { key: "btcMomentum", available: Boolean(btc), baseWeight: 20, score: btcScore, contribution: 0 },
    { key: "vix", available: Boolean(vix), baseWeight: 20, score: vixScore, contribution: 0 },
    { key: "dollar", available: Boolean(dollar), baseWeight: 15, score: dollarScore, contribution: 0 },
    { key: "tenYearYield", available: Boolean(tenYear), baseWeight: 15, score: yieldScore, contribution: 0 },
  ];

  const availableWeight = components
    .filter((item) => item.available)
    .reduce((sum, item) => sum + item.baseWeight, 0);

  let regimeScore = 0;
  const weights: Record<string, number> = {};

  for (const component of components) {
    const activeWeight =
      component.available && availableWeight > 0
        ? (component.baseWeight / availableWeight) * 100
        : 0;

    component.contribution = component.score * (activeWeight / 100);
    regimeScore += component.contribution;
    weights[component.key] = round(activeWeight, 1);
  }

  regimeScore = round(clamp(regimeScore, -100, 100), 2);

  const regime = regimeFromScore(regimeScore);
  const availableSources = components.filter((item) => item.available).length;
  const traditionalMacroSourcesAvailable = [vix, dollar, tenYear].filter(Boolean).length;
  const dataQuality: DataQuality =
    availableSources >= 4 ? "GOOD" : availableSources >= 2 ? "PARTIAL" : "LOW";

  const confidence = round(
    clamp(40 + Math.abs(regimeScore) * 0.35 + availableSources * 5, 35, 90),
    1
  );

  const riskOnReasons: string[] = [];
  const riskOffReasons: string[] = [];
  const warnings: string[] = [];

  if (crypto && crypto.marketCapChange24hPercent >= 1) {
    riskOnReasons.push(`Total crypto market capitalization is up ${round(crypto.marketCapChange24hPercent, 2)}% over 24h.`);
  }

  if (crypto && crypto.marketCapChange24hPercent <= -1) {
    riskOffReasons.push(`Total crypto market capitalization is down ${Math.abs(round(crypto.marketCapChange24hPercent, 2))}% over 24h.`);
  }

  if (btc && btc.change24hPercent >= 1) {
    riskOnReasons.push(`BTC is up ${round(btc.change24hPercent, 2)}% over 24h.`);
  }

  if (btc && btc.change24hPercent <= -1) {
    riskOffReasons.push(`BTC is down ${Math.abs(round(btc.change24hPercent, 2))}% over 24h.`);
  }

  if (vix) {
    if (vix.latest.value >= 25 || vixChangePercent >= 5) {
      riskOffReasons.push(`VIX is ${round(vix.latest.value, 2)} with a ${round(vixChangePercent, 2)}% latest-observation change.`);
    }

    if (vix.latest.value <= 16 && vixChangePercent <= 0) {
      riskOnReasons.push(`VIX is relatively low at ${round(vix.latest.value, 2)}.`);
    }
  }

  if (dollar && dollarChangePercent >= 0.25) {
    riskOffReasons.push(`The broad U.S. dollar index strengthened ${round(dollarChangePercent, 2)}% in the latest observation.`);
  }

  if (dollar && dollarChangePercent <= -0.25) {
    riskOnReasons.push(`The broad U.S. dollar index weakened ${Math.abs(round(dollarChangePercent, 2))}% in the latest observation.`);
  }

  if (tenYear && tenYearChangeBps >= 5) {
    riskOffReasons.push(`The U.S. 10-year Treasury yield rose ${round(tenYearChangeBps, 1)} bps in the latest observation.`);
  }

  if (tenYear && tenYearChangeBps <= -5) {
    riskOnReasons.push(`The U.S. 10-year Treasury yield fell ${Math.abs(round(tenYearChangeBps, 1))} bps in the latest observation.`);
  }

  if (dataQuality !== "GOOD") {
    warnings.push(`Macro data quality is ${dataQuality.toLowerCase()} because only ${availableSources} of 5 regime inputs are currently available.`);
  }

  if (traditionalMacroSourcesAvailable === 0) {
    warnings.push("No VIX, dollar-index or U.S. 10-year Treasury input is currently available. Treat this as crypto-market context only, not full macro confirmation.");
  }

  warnings.push("FRED VIX, dollar-index and Treasury-yield observations are daily macro inputs, not real-time tick data.");
  warnings.push("Risk-on/risk-off scoring is heuristic and is not a calibrated probability of crypto price direction.");

  const response = {
    success: true,
    routeVersion: "2.0-safe",
    regime,
    regimeScore,
    confidence,
    confidenceType: "heuristic",
    dataQuality,
    availableSources,
    totalSources: 5,
    traditionalMacroSourcesAvailable,
    weights,
    scores: {
      cryptoMarket: round(cryptoScore, 1),
      btcMomentum: round(btcScore, 1),
      vix: round(vixScore, 1),
      dollar: round(dollarScore, 1),
      tenYearYield: round(yieldScore, 1),
    },
    contributions: Object.fromEntries(
      components.map((item) => [item.key, round(item.contribution, 2)])
    ),
    cryptoMarket: crypto
      ? {
          available: true,
          provider: crypto.provider,
          totalMarketCapUsd: round(crypto.totalMarketCapUsd, 2),
          totalVolume24hUsd: round(crypto.totalVolume24hUsd, 2),
          marketCapChange24hPercent: round(crypto.marketCapChange24hPercent, 2),
          btcDominancePercent: round(crypto.btcDominancePercent, 2),
          btcDominanceRegime: btcDominanceLabel(crypto.btcDominancePercent),
          activeCryptocurrencies: crypto.activeCryptocurrencies,
          updatedAt: crypto.updatedAt,
        }
      : { available: false },
    btc: btc
      ? {
          available: true,
          price: round(btc.price, 2),
          change24hPercent: round(btc.change24hPercent, 2),
          quoteVolume24hUsd: round(btc.quoteVolume24hUsd, 2),
        }
      : { available: false },
    vix: vix
      ? {
          available: true,
          value: round(vix.latest.value, 2),
          previousValue: round(vix.previous.value, 2),
          changePercent: round(vixChangePercent, 2),
          observationDate: vix.latest.date,
        }
      : { available: false },
    dollarIndex: dollar
      ? {
          available: true,
          series: "DTWEXBGS",
          value: round(dollar.latest.value, 3),
          previousValue: round(dollar.previous.value, 3),
          changePercent: round(dollarChangePercent, 3),
          observationDate: dollar.latest.date,
        }
      : { available: false },
    tenYearYield: tenYear
      ? {
          available: true,
          valuePercent: round(tenYear.latest.value, 3),
          previousValuePercent: round(tenYear.previous.value, 3),
          changeBps: round(tenYearChangeBps, 1),
          observationDate: tenYear.latest.date,
        }
      : { available: false },
    riskOnReasons,
    riskOffReasons,
    warnings,
    sourceFailures,
    scoring: {
      range: "-100 to +100",
      thresholds: { riskOn: 20, riskOff: -20 },
      baseWeights: {
        cryptoMarket: 30,
        btcMomentum: 20,
        vix: 20,
        dollar: 15,
        tenYearYield: 15,
      },
      dynamicFallback: true,
      currentlyUsedInTradingDecision: false,
    },
    modules: {
      cryptoGlobal: Boolean(crypto),
      btcMomentum: Boolean(btc),
      vix: Boolean(vix),
      dollarIndex: Boolean(dollar),
      tenYearYield: Boolean(tenYear),
      macroRegime: true,
      macroCalendar: false,
      tradingWeightEnabled: false,
    },
    caveats: [
      "BTC dominance is market-structure context and is not independently scored bullish or bearish.",
      "A stronger dollar, rising long-term yields and higher volatility are treated as risk-off pressure heuristically; market reactions can differ by regime.",
      "This route is observation-only for now and does not directly affect LONG/SHORT decisions.",
    ],
    updatedAt: new Date().toISOString(),
  };

  macroCache = {
    expiresAt: now + 5 * 60_000,
    data: response,
  };

  return NextResponse.json(response);
}
