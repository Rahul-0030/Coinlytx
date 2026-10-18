import { NextRequest, NextResponse } from "next/server";
import { normalizeTradingSymbol } from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";
type Impact = "HIGH" | "MEDIUM" | "LOW";

type NewsResponse = {
  success: boolean;
  symbol?: string;
  bias?: Bias;
  newsScore?: number;
  meaningfulNews?: boolean;
  summary?: {
    matchedArticles: number;
    bullishArticles: number;
    bearishArticles: number;
    neutralArticles: number;
    highImpactArticles: number;
  };
  articles?: Array<{
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string | null;
    ageMinutes: number | null;
    eventType: string;
    sentiment: Bias;
    impact: Impact;
    score: number;
    matchedTerms: string[];
  }>;
  sourceFailures?: Array<{
    source: string;
    error: string;
  }>;
  error?: string;
};

type AnnouncementResponse = {
  success: boolean;
  symbol?: string;
  bias?: Bias;
  announcementScore?: number;
  meaningfulAnnouncement?: boolean;
  summary?: {
    matchedEvents: number;
    bullishEvents: number;
    bearishEvents: number;
    neutralEvents: number;
    highImpactEvents: number;
  };
  events?: Array<{
    id: string;
    title: string;
    url: string;
    source: string;
    category: string;
    categoryLabel: string;
    publishedAt: string | null;
    ageMinutes: number | null;
    matchedTerms: string[];
    eventType: string;
    sentiment: Bias;
    impact: Impact;
    rawScore: number;
    score: number;
  }>;
  sourceFailures?: Array<{
    category: string;
    categoryLabel: string;
    error: string | null;
  }>;
  error?: string;
};

type CombinedCatalyst = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: "NEWS" | "ANNOUNCEMENT" | "MARKET_NEWS";
  layer: "COIN_SPECIFIC" | "MARKET_WIDE";
  publishedAt: string | null;
  ageMinutes: number | null;
  eventType: string;
  sentiment: Bias;
  impact: Impact;
  score: number;
  matchedTerms: string[];
};

type RssSource = {
  name: string;
  url: string;
  reliability: number;
};

type RssItem = {
  title: string;
  url: string;
  publishedAt: string | null;
  source: string;
};

type MarketRule = {
  terms: string[];
  score: number;
  eventType: string;
};

const MARKET_SOURCES: RssSource[] = [
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    reliability: 1,
  },
  {
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    reliability: 0.9,
  },
  {
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    reliability: 0.9,
  },
];

const MARKET_RELEVANCE_TERMS = [
  "BITCOIN",
  "BTC",
  "ETHEREUM",
  "ETHER",
  "ETH",
  "CRYPTO",
  "CRYPTOCURRENCY",
  "DIGITAL ASSET",
  "DIGITAL ASSETS",
  "ETF",
  "SEC",
  "FED",
  "FEDERAL RESERVE",
  "FOMC",
  "CPI",
  "INFLATION",
  "INTEREST RATE",
  "INTEREST RATES",
  "TREASURY",
  "DOLLAR",
  "STABLECOIN",
  "USDT",
  "USDC",
  "TETHER",
  "BINANCE",
  "COINBASE",
  "EXCHANGE",
  "LIQUIDATION",
  "LIQUIDATIONS",
  "MARKET",
];

const MARKET_POSITIVE_RULES: MarketRule[] = [
  {
    terms: [
      "RATE CUT",
      "RATE CUTS",
      "FED CUTS",
      "DOVISH",
      "MONETARY EASING",
    ],
    score: 24,
    eventType: "MONETARY_EASING",
  },
  {
    terms: [
      "ETF INFLOW",
      "ETF INFLOWS",
      "RECORD INFLOW",
      "RECORD INFLOWS",
    ],
    score: 22,
    eventType: "ETF_INFLOW",
  },
  {
    terms: [
      "RISK-ON",
      "RISK ON",
      "MARKET RALLY",
      "CRYPTO RALLY",
      "CRYPTO SURGES",
      "BITCOIN SURGES",
      "BITCOIN RALLIES",
    ],
    score: 16,
    eventType: "MARKET_RALLY",
  },
  {
    terms: [
      "INSTITUTIONAL ADOPTION",
      "INSTITUTIONAL DEMAND",
      "TREASURY BUYS BITCOIN",
      "TREASURY ADDS BITCOIN",
    ],
    score: 16,
    eventType: "INSTITUTIONAL_DEMAND",
  },
  {
    terms: [
      "STABLECOIN GROWTH",
      "STABLECOIN SUPPLY RISES",
      "STABLECOIN SUPPLY GROWS",
    ],
    score: 12,
    eventType: "LIQUIDITY_EXPANSION",
  },
];

const MARKET_NEGATIVE_RULES: MarketRule[] = [
  {
    terms: [
      "RATE HIKE",
      "RATE HIKES",
      "FED HIKES",
      "HAWKISH",
      "HIGHER FOR LONGER",
    ],
    score: -24,
    eventType: "MONETARY_TIGHTENING",
  },
  {
    terms: [
      "HOTTER INFLATION",
      "INFLATION SURPRISE",
      "CPI HOTTER",
      "CPI ABOVE EXPECTATIONS",
    ],
    score: -18,
    eventType: "INFLATION_PRESSURE",
  },
  {
    terms: [
      "ETF OUTFLOW",
      "ETF OUTFLOWS",
      "RECORD OUTFLOW",
      "RECORD OUTFLOWS",
    ],
    score: -22,
    eventType: "ETF_OUTFLOW",
  },
  {
    terms: [
      "MARKET CRASH",
      "CRYPTO CRASH",
      "CRYPTO SELLOFF",
      "CRYPTO SELL-OFF",
      "BITCOIN SELLOFF",
      "BITCOIN SELL-OFF",
      "MASS LIQUIDATION",
      "MASS LIQUIDATIONS",
      "LIQUIDATIONS SURGE",
    ],
    score: -24,
    eventType: "MARKET_STRESS",
  },
  {
    terms: [
      "DEPEG",
      "DE-PEG",
      "STABLECOIN CRISIS",
    ],
    score: -32,
    eventType: "STABLECOIN_STRESS",
  },
  {
    terms: [
      "EXCHANGE HACK",
      "EXCHANGE EXPLOIT",
      "EXCHANGE BREACH",
      "BINANCE HACK",
      "COINBASE HACK",
    ],
    score: -30,
    eventType: "EXCHANGE_SECURITY",
  },
  {
    terms: [
      "EXCHANGE INSOLVENT",
      "EXCHANGE INSOLVENCY",
      "EXCHANGE BANKRUPTCY",
      "EXCHANGE COLLAPSE",
    ],
    score: -38,
    eventType: "EXCHANGE_DISTRESS",
  },
  {
    terms: [
      "CRYPTO BAN",
      "CRYPTO CRACKDOWN",
      "SEC CRACKDOWN",
      "ENFORCEMENT ACTION",
    ],
    score: -20,
    eventType: "REGULATORY_PRESSURE",
  },
];

const SELECTED_COIN_ALIASES: Record<string, string[]> = {
  BTC: ["BTC", "BITCOIN"],
  ETH: ["ETH", "ETHER", "ETHEREUM"],
  BNB: ["BNB", "BINANCE COIN", "BNB CHAIN"],
  SOL: ["SOL", "SOLANA"],
  XRP: ["XRP", "RIPPLE"],
  DOGE: ["DOGE", "DOGECOIN"],
  ADA: ["ADA", "CARDANO"],
  AVAX: ["AVAX", "AVALANCHE"],
  LINK: ["LINK", "CHAINLINK"],
  UNI: ["UNI", "UNISWAP"],
  AAVE: ["AAVE"],
  SHIB: ["SHIB", "SHIBA INU"],
  PEPE: ["PEPE"],
  DOT: ["DOT", "POLKADOT"],
  LTC: ["LTC", "LITECOIN"],
  BCH: ["BCH", "BITCOIN CASH"],
  TRX: ["TRX", "TRON"],
  SUI: ["SUI"],
  TON: ["TON", "TONCOIN", "THE OPEN NETWORK"],
  NEAR: ["NEAR", "NEAR PROTOCOL"],
  APT: ["APT", "APTOS"],
  ARB: ["ARB", "ARBITRUM"],
  OP: ["OP", "OPTIMISM"],
  FIL: ["FIL", "FILECOIN"],
  INJ: ["INJ", "INJECTIVE"],
  ATOM: ["ATOM", "COSMOS"],
  ETC: ["ETC", "ETHEREUM CLASSIC"],
  HBAR: ["HBAR", "HEDERA"],
  XLM: ["XLM", "STELLAR"],
  ICP: ["ICP", "INTERNET COMPUTER"],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function signBias(score: number): Bias {
  if (score >= 12) return "BULLISH";
  if (score <= -12) return "BEARISH";
  return "NEUTRAL";
}

function confidenceFromCatalysts({
  catalystScore,
  newsAvailable,
  announcementAvailable,
  marketWideAvailable,
  meaningfulNews,
  meaningfulAnnouncement,
  meaningfulMarketWide,
  conflict,
  strongConflict,
  highImpactCount,
}: {
  catalystScore: number;
  newsAvailable: boolean;
  announcementAvailable: boolean;
  marketWideAvailable: boolean;
  meaningfulNews: boolean;
  meaningfulAnnouncement: boolean;
  meaningfulMarketWide: boolean;
  conflict: boolean;
  strongConflict: boolean;
  highImpactCount: number;
}) {
  let confidence = 45;

  confidence += Math.min(30, Math.abs(catalystScore) * 0.35);

  if (newsAvailable) confidence += 4;
  if (announcementAvailable) confidence += 6;
  if (marketWideAvailable) confidence += 3;

  if (meaningfulNews) confidence += 4;
  if (meaningfulAnnouncement) confidence += 6;
  if (meaningfulMarketWide) confidence += 3;

  confidence += Math.min(8, highImpactCount * 2);

  if (conflict) confidence -= 10;
  if (strongConflict) confidence -= 8;

  return round(clamp(confidence, 35, 90), 1);
}

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readXmlTag(block: string, tagName: string) {
  const match = block.match(
    new RegExp(
      `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
      "i"
    )
  );

  return match ? decodeXml(match[1]) : "";
}

function parseFeed(xml: string, source: string): RssItem[] {
  const blocks =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ||
    xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ||
    [];

  return blocks
    .slice(0, 50)
    .map((block) => ({
      title: readXmlTag(block, "title"),
      url:
        readXmlTag(block, "link") ||
        block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
        "",
      publishedAt:
        readXmlTag(block, "pubDate") ||
        readXmlTag(block, "published") ||
        readXmlTag(block, "updated") ||
        null,
      source,
    }))
    .filter((item) => item.title && item.url);
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text: string, term: string) {
  const upperTerm = term.toUpperCase();

  if (/^[A-Z0-9]{2,6}$/.test(upperTerm)) {
    return new RegExp(
      `(^|[^A-Z0-9])${escapeRegex(upperTerm)}([^A-Z0-9]|$)`,
      "i"
    ).test(text);
  }

  return text.includes(upperTerm);
}

function ageMinutes(date: string | null) {
  if (!date) return null;

  const time = new Date(date).getTime();

  if (!Number.isFinite(time)) return null;

  return Math.max(0, Math.round((Date.now() - time) / 60_000));
}

function freshnessMultiplier(minutes: number | null) {
  if (minutes === null) return 0.65;
  if (minutes <= 60) return 1;
  if (minutes <= 360) return 0.9;
  if (minutes <= 1_440) return 0.75;
  if (minutes <= 4_320) return 0.5;

  return 0.25;
}

function classifyMarketWideHeadline(title: string) {
  const upper = title.toUpperCase();

  let selectedRule: MarketRule | null = null;

  for (const rule of [
    ...MARKET_POSITIVE_RULES,
    ...MARKET_NEGATIVE_RULES,
  ]) {
    const matched = rule.terms.some((term) => upper.includes(term));

    if (
      matched &&
      (!selectedRule || Math.abs(rule.score) > Math.abs(selectedRule.score))
    ) {
      selectedRule = rule;
    }
  }

  const score = selectedRule?.score ?? 0;

  return {
    score,
    eventType: selectedRule?.eventType ?? "MARKET_CONTEXT",
    sentiment:
      score >= 8
        ? ("BULLISH" as const)
        : score <= -8
          ? ("BEARISH" as const)
          : ("NEUTRAL" as const),
    impact:
      Math.abs(score) >= 25
        ? ("HIGH" as const)
        : Math.abs(score) >= 12
          ? ("MEDIUM" as const)
          : ("LOW" as const),
  };
}

function isMarketWideRelevant(title: string) {
  const upper = title.toUpperCase();

  return MARKET_RELEVANCE_TERMS.some((term) => containsTerm(upper, term));
}

function mentionsSelectedCoin(title: string, baseAsset: string) {
  const upper = title.toUpperCase();
  const aliases = Array.from(
    new Set([baseAsset, ...(SELECTED_COIN_ALIASES[baseAsset] ?? [])])
  );

  return aliases.some((alias) => containsTerm(upper, alias));
}

async function fetchMarketSource(source: RssSource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(source.url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "CoinlytxTradingIntelligence/2.0",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();

    return {
      ok: true,
      source,
      items: parseFeed(xml, source.name),
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      source,
      items: [] as RssItem[],
      error:
        error instanceof Error
          ? error.message
          : "Market-wide feed request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMarketWideLayer(
  baseAsset: string,
  coinSpecificTitles: Set<string>
) {
  const results = await Promise.all(MARKET_SOURCES.map(fetchMarketSource));

  const reliability = new Map(
    MARKET_SOURCES.map((source) => [source.name, source.reliability])
  );

  const seen = new Set<string>();

  const articles: CombinedCatalyst[] = results
    .flatMap((result) => result.items)
    .flatMap((item): CombinedCatalyst[] => {
      const titleKey = normalizeTitle(item.title);

      if (!titleKey || seen.has(titleKey) || coinSpecificTitles.has(titleKey)) {
        return [];
      }

      if (!isMarketWideRelevant(item.title)) {
        return [];
      }

      if (mentionsSelectedCoin(item.title, baseAsset)) {
        return [];
      }

      seen.add(titleKey);

      const classified = classifyMarketWideHeadline(item.title);
      const minutes = ageMinutes(item.publishedAt);

      if (minutes !== null && minutes > 4_320) {
        return [];
      }

      const adjustedScore = round(
        classified.score *
          freshnessMultiplier(minutes) *
          (reliability.get(item.source) ?? 0.8),
        2
      );

      const matchedTerms = MARKET_RELEVANCE_TERMS.filter((term) =>
        containsTerm(item.title.toUpperCase(), term)
      );

      return [
        {
          id: `market:${item.source}:${titleKey}`.slice(0, 240),
          title: item.title,
          url: item.url,
          source: item.source,
          sourceType: "MARKET_NEWS",
          layer: "MARKET_WIDE",
          publishedAt: item.publishedAt,
          ageMinutes: minutes,
          eventType: classified.eventType,
          sentiment: classified.sentiment,
          impact: classified.impact,
          score: adjustedScore,
          matchedTerms,
        },
      ];
    })
    .sort((a, b) => {
      const impactRank = (impact: Impact) =>
        impact === "HIGH" ? 3 : impact === "MEDIUM" ? 2 : 1;

      const impactDifference = impactRank(b.impact) - impactRank(a.impact);

      if (impactDifference !== 0) return impactDifference;

      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

      return bTime - aTime;
    });

  const score = round(
    clamp(
      articles
        .slice(0, 12)
        .reduce((sum, article) => sum + article.score, 0),
      -60,
      60
    ),
    2
  );

  const highImpactArticles = articles.filter(
    (article) => article.impact === "HIGH"
  ).length;

  const meaningful = highImpactArticles > 0 || Math.abs(score) >= 18;

  return {
    available: results.some((result) => result.ok),
    requestSucceeded: results.some((result) => result.ok),
    score,
    bias: signBias(score),
    meaningful,
    matchedArticles: articles.length,
    bullishArticles: articles.filter(
      (article) => article.sentiment === "BULLISH"
    ).length,
    bearishArticles: articles.filter(
      (article) => article.sentiment === "BEARISH"
    ).length,
    neutralArticles: articles.filter(
      (article) => article.sentiment === "NEUTRAL"
    ).length,
    highImpactArticles,
    availableSources: results.filter((result) => result.ok).length,
    totalSources: results.length,
    articles: articles.slice(0, 20),
    sourceFailures: results
      .filter((result) => !result.ok)
      .map((result) => ({
        source: result.source.name,
        error: result.error ?? "Feed unavailable",
      })),
  };
}

async function fetchJson<T>(
  url: string
): Promise<{
  ok: boolean;
  data: T | null;
  error: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const data = (await response.json()) as T;

    if (!response.ok) {
      return {
        ok: false,
        data,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      data,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  try {
    const symbol = normalizeTradingSymbol(
      request.nextUrl.searchParams.get("symbol"),
      "BTCUSDT"
    );

    const baseAsset = symbol.slice(0, -4);
    const baseUrl = request.nextUrl.origin;

    const [newsResult, announcementResult] = await Promise.all([
      fetchJson<NewsResponse>(
        `${baseUrl}/api/trading/news?symbol=${encodeURIComponent(symbol)}`
      ),
      fetchJson<AnnouncementResponse>(
        `${baseUrl}/api/trading/announcements?symbol=${encodeURIComponent(
          symbol
        )}`
      ),
    ]);

    const news = newsResult.data;
    const announcements = announcementResult.data;

    const newsSuccess = Boolean(newsResult.ok && news?.success);
    const announcementSuccess = Boolean(
      announcementResult.ok && announcements?.success
    );

    const newsMatched = newsSuccess
      ? safeNumber(news?.summary?.matchedArticles)
      : 0;

    const announcementMatched = announcementSuccess
      ? safeNumber(announcements?.summary?.matchedEvents)
      : 0;

    const newsAvailable = newsSuccess && newsMatched > 0;
    const announcementAvailable =
      announcementSuccess && announcementMatched > 0;

    let newsWeight = 0;
    let announcementWeight = 0;

    if (newsAvailable && announcementAvailable) {
      newsWeight = 40;
      announcementWeight = 60;
    } else if (newsAvailable) {
      newsWeight = 100;
    } else if (announcementAvailable) {
      announcementWeight = 100;
    }

    const newsScore = newsAvailable ? safeNumber(news?.newsScore) : 0;
    const announcementScore = announcementAvailable
      ? safeNumber(announcements?.announcementScore)
      : 0;

    const newsContribution = round(newsScore * (newsWeight / 100));
    const announcementContribution = round(
      announcementScore * (announcementWeight / 100)
    );

    const coinSpecificScore = round(
      clamp(newsContribution + announcementContribution, -100, 100)
    );

    const coinSpecificCatalysts: CombinedCatalyst[] = [
      ...(news?.articles ?? []).map(
        (article): CombinedCatalyst => ({
          id: `news:${article.id}`,
          title: article.title,
          url: article.url,
          source: article.source,
          sourceType: "NEWS",
          layer: "COIN_SPECIFIC",
          publishedAt: article.publishedAt,
          ageMinutes: article.ageMinutes,
          eventType: article.eventType,
          sentiment: article.sentiment,
          impact: article.impact,
          score: article.score,
          matchedTerms: article.matchedTerms ?? [],
        })
      ),
      ...(announcements?.events ?? []).map(
        (event): CombinedCatalyst => ({
          id: `announcement:${event.id}`,
          title: event.title,
          url: event.url,
          source: event.source,
          sourceType: "ANNOUNCEMENT",
          layer: "COIN_SPECIFIC",
          publishedAt: event.publishedAt,
          ageMinutes: event.ageMinutes,
          eventType: event.eventType,
          sentiment: event.sentiment,
          impact: event.impact,
          score: event.score,
          matchedTerms: event.matchedTerms ?? [],
        })
      ),
    ];

    const coinSpecificTitles = new Set(
      coinSpecificCatalysts.map((item) => normalizeTitle(item.title))
    );

    const marketWide = await fetchMarketWideLayer(
      baseAsset,
      coinSpecificTitles
    );

    const meaningfulNews = Boolean(news?.meaningfulNews);
    const meaningfulAnnouncement = Boolean(
      announcements?.meaningfulAnnouncement
    );

    const coinSpecificHighImpactCount = coinSpecificCatalysts.filter(
      (item) => item.impact === "HIGH"
    ).length;

    const meaningfulCoinSpecific =
      meaningfulNews ||
      meaningfulAnnouncement ||
      coinSpecificHighImpactCount > 0 ||
      Math.abs(coinSpecificScore) >= 12;

    const meaningfulMarketWide =
      marketWide.available && marketWide.meaningful;

    let coinSpecificLayerWeight = 0;
    let marketWideLayerWeight = 0;
    let catalystScore = 0;

    if (meaningfulCoinSpecific && meaningfulMarketWide) {
      coinSpecificLayerWeight = 70;
      marketWideLayerWeight = 30;

      catalystScore = round(
        clamp(
          coinSpecificScore * 0.7 + marketWide.score * 0.3,
          -100,
          100
        )
      );
    } else if (meaningfulCoinSpecific) {
      coinSpecificLayerWeight = 100;
      marketWideLayerWeight = 0;
      catalystScore = coinSpecificScore;
    } else if (meaningfulMarketWide) {
      /*
       * Market-wide events can affect an altcoin even without a coin-specific
       * headline, but they must never receive full coin-specific influence.
       * The effective market-only layer is capped at 35%.
       */
      coinSpecificLayerWeight = 0;
      marketWideLayerWeight = 35;
      catalystScore = round(clamp(marketWide.score * 0.35, -35, 35));
    } else {
      catalystScore = coinSpecificScore;
    }

    const newsDirectional = Math.abs(newsScore) >= 12;
    const announcementDirectional = Math.abs(announcementScore) >= 12;

    const internalCoinConflict =
      newsDirectional &&
      announcementDirectional &&
      Math.sign(newsScore) !== Math.sign(announcementScore);

    const coinDirectional = Math.abs(coinSpecificScore) >= 12;
    const marketDirectional = Math.abs(marketWide.score) >= 18;

    const layerConflict =
      coinDirectional &&
      marketDirectional &&
      Math.sign(coinSpecificScore) !== Math.sign(marketWide.score);

    const conflict = internalCoinConflict || layerConflict;

    const strongConflict =
      (internalCoinConflict &&
        Math.abs(newsScore) >= 25 &&
        Math.abs(announcementScore) >= 25) ||
      (layerConflict &&
        Math.abs(coinSpecificScore) >= 25 &&
        Math.abs(marketWide.score) >= 25);

    const catalysts = [
      ...coinSpecificCatalysts,
      ...marketWide.articles,
    ]
      .sort((a, b) => {
        const impactRank = (impact: Impact) =>
          impact === "HIGH" ? 3 : impact === "MEDIUM" ? 2 : 1;

        const impactDifference = impactRank(b.impact) - impactRank(a.impact);

        if (impactDifference !== 0) return impactDifference;

        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

        return bTime - aTime;
      })
      .slice(0, 40);

    const highImpactCount = catalysts.filter(
      (item) => item.impact === "HIGH"
    ).length;

    const mediumImpactCount = catalysts.filter(
      (item) => item.impact === "MEDIUM"
    ).length;

    const bullishCount = catalysts.filter(
      (item) => item.sentiment === "BULLISH"
    ).length;

    const bearishCount = catalysts.filter(
      (item) => item.sentiment === "BEARISH"
    ).length;

    const neutralCount = catalysts.filter(
      (item) => item.sentiment === "NEUTRAL"
    ).length;

    const meaningfulCatalyst =
      meaningfulCoinSpecific ||
      (meaningfulMarketWide && Math.abs(catalystScore) >= 12) ||
      highImpactCount > 0 ||
      Math.abs(catalystScore) >= 12;

    const coinSpecificSourceCount =
      Number(newsAvailable) + Number(announcementAvailable);

    const dataQuality =
      coinSpecificSourceCount === 2 && marketWide.availableSources >= 2
        ? "GOOD"
        : coinSpecificSourceCount >= 1 || meaningfulMarketWide
          ? "PARTIAL"
          : "LOW";

    const confidence = confidenceFromCatalysts({
      catalystScore,
      newsAvailable,
      announcementAvailable,
      marketWideAvailable: marketWide.available,
      meaningfulNews,
      meaningfulAnnouncement,
      meaningfulMarketWide,
      conflict,
      strongConflict,
      highImpactCount,
    });

    const bias = signBias(catalystScore);

    const confirmations: string[] = [];
    const risks: string[] = [];

    if (newsAvailable && announcementAvailable) {
      confirmations.push(
        "Both crypto-news and official Binance announcement feeds returned coin-specific data."
      );
    }

    if (
      newsDirectional &&
      announcementDirectional &&
      !internalCoinConflict
    ) {
      confirmations.push(
        `Coin-specific news and official announcements both lean ${signBias(
          coinSpecificScore
        ).toLowerCase()}.`
      );
    }

    if (meaningfulAnnouncement) {
      confirmations.push(
        "At least one meaningful official Binance catalyst is active."
      );
    }

    if (meaningfulMarketWide) {
      confirmations.push(
        `Market-wide crypto intelligence currently leans ${marketWide.bias.toLowerCase()} with score ${marketWide.score}.`
      );
    }

    if (
      meaningfulCoinSpecific &&
      meaningfulMarketWide &&
      !layerConflict &&
      signBias(coinSpecificScore) !== "NEUTRAL" &&
      signBias(coinSpecificScore) === marketWide.bias
    ) {
      confirmations.push(
        "Coin-specific and market-wide catalyst layers currently point in the same direction."
      );
    }

    if (highImpactCount > 0) {
      confirmations.push(
        `${highImpactCount} high-impact catalyst${
          highImpactCount === 1 ? "" : "s"
        } detected across coin-specific and market-wide layers.`
      );
    }

    if (internalCoinConflict) {
      risks.push(
        "Coin-specific crypto-news and official Binance announcements currently point in opposite directions."
      );
    }

    if (layerConflict) {
      risks.push(
        "Coin-specific catalyst intelligence and broader market-wide catalyst intelligence currently point in opposite directions."
      );
    }

    if (!newsAvailable) {
      risks.push(
        "No recent coin-specific article was available from the current crypto-news feeds."
      );
    }

    if (!announcementAvailable) {
      risks.push(
        "No recent coin-specific Binance announcement was available from the current title-based matcher."
      );
    }

    if (
      !meaningfulCoinSpecific &&
      meaningfulMarketWide
    ) {
      risks.push(
        "No meaningful coin-specific catalyst is active, so broader market news is capped at a reduced 35% catalyst-layer influence."
      );
    }

    if (!marketWide.available) {
      risks.push(
        "Market-wide crypto-news context is currently unavailable, so catalyst scoring is limited to coin-specific sources."
      );
    }

    if (strongConflict) {
      risks.push(
        "Strong catalyst conflict detected. The signal engine should disable catalyst trading weight until the disagreement resolves."
      );
    }

    return NextResponse.json({
      success: true,
      version: "2.0-market-wide",
      symbol,
      baseAsset,
      bias,
      catalystScore,
      confidence,
      confidenceType: "heuristic",
      meaningfulCatalyst,
      conflict,
      strongConflict,
      dataQuality,

      weights: {
        news: newsWeight,
        announcements: announcementWeight,
        coinSpecificLayer: coinSpecificLayerWeight,
        marketWideLayer: marketWideLayerWeight,
      },

      scores: {
        news: newsScore,
        newsContribution,
        announcements: announcementScore,
        announcementContribution,
        coinSpecific: coinSpecificScore,
        marketWide: marketWide.score,
        marketWideEffectiveContribution: round(
          marketWide.score * (marketWideLayerWeight / 100),
          2
        ),
      },

      news: {
        available: newsAvailable,
        requestSucceeded: newsSuccess,
        bias: news?.bias ?? "NEUTRAL",
        score: newsScore,
        meaningful: meaningfulNews,
        matchedArticles: newsMatched,
        highImpactArticles: safeNumber(news?.summary?.highImpactArticles),
        sourceFailures: news?.sourceFailures ?? [],
      },

      announcements: {
        available: announcementAvailable,
        requestSucceeded: announcementSuccess,
        bias: announcements?.bias ?? "NEUTRAL",
        score: announcementScore,
        meaningful: meaningfulAnnouncement,
        matchedEvents: announcementMatched,
        highImpactEvents: safeNumber(
          announcements?.summary?.highImpactEvents
        ),
        sourceFailures: announcements?.sourceFailures ?? [],
      },

      marketWide: {
        available: marketWide.available,
        requestSucceeded: marketWide.requestSucceeded,
        meaningful: meaningfulMarketWide,
        bias: marketWide.bias,
        score: marketWide.score,
        effectiveLayerWeight: marketWideLayerWeight,
        matchedArticles: marketWide.matchedArticles,
        bullishArticles: marketWide.bullishArticles,
        bearishArticles: marketWide.bearishArticles,
        neutralArticles: marketWide.neutralArticles,
        highImpactArticles: marketWide.highImpactArticles,
        availableSources: marketWide.availableSources,
        totalSources: marketWide.totalSources,
        sourceFailures: marketWide.sourceFailures,
        articles: marketWide.articles,
      },

      layers: {
        coinSpecific: {
          available: newsAvailable || announcementAvailable,
          meaningful: meaningfulCoinSpecific,
          score: coinSpecificScore,
          bias: signBias(coinSpecificScore),
          effectiveWeight: coinSpecificLayerWeight,
          newsWeight,
          announcementWeight,
        },
        marketWide: {
          available: marketWide.available,
          meaningful: meaningfulMarketWide,
          score: marketWide.score,
          bias: marketWide.bias,
          effectiveWeight: marketWideLayerWeight,
        },
      },

      summary: {
        totalCatalysts: catalysts.length,
        coinSpecificCatalysts: coinSpecificCatalysts.length,
        marketWideCatalysts: marketWide.articles.length,
        bullishCatalysts: bullishCount,
        bearishCatalysts: bearishCount,
        neutralCatalysts: neutralCount,
        highImpactCatalysts: highImpactCount,
        mediumImpactCatalysts: mediumImpactCount,
      },

      catalysts,
      confirmations,
      risks,

      scoring: {
        range: "-100 to +100",
        newsBaseWeight: 40,
        announcementBaseWeight: 60,
        coinSpecificBaseWeight: 70,
        marketWideBaseWeight: 30,
        marketOnlyInfluenceCap: 35,
        dynamicFallback: true,
        currentlyUsedInTradingDecision: true,
      },

      modules: {
        cryptoNews: newsSuccess,
        binanceAnnouncements: announcementSuccess,
        marketWideNews: marketWide.available,
        catalystFusion: true,
        tradingWeightEnabled: true,
      },

      caveats: [
        "Catalyst confidence is heuristic and is not a calibrated probability of future price movement.",
        "Official exchange announcements generally receive more weight than publisher headlines because they are primary-source events.",
        "Headline and title classification can miss or misread context that appears only inside an article body.",
        "Market-wide catalyst influence is deliberately capped so generic Bitcoin, macro or regulatory headlines cannot overpower coin-specific evidence.",
        "Market-wide events can affect altcoins through correlation, but they do not prove that the selected coin will move in the same direction.",
      ],

      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to build catalyst intelligence.",
      },
      {
        status: 500,
      }
    );
  }
}
