import { NextRequest, NextResponse } from "next/server";
import { normalizeTradingSymbol } from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogConfig = {
  id: number;
  key: "LISTING" | "NEWS" | "MAINTENANCE" | "DELISTING";
  label: string;
};

type BinanceArticle = {
  code?: string;
  title?: string;
  releaseDate?: number;
};

type BinanceCatalog = {
  catalogId?: number;
  catalogName?: string;
  articles?: BinanceArticle[];
};

type BinanceResponse = {
  code?: string;
  success?: boolean;
  message?: string | null;
  data?: {
    catalogs?: BinanceCatalog[];
    articles?: BinanceArticle[];
  } | null;
};

const BINANCE_BASE = "https://www.binance.com";

const BINANCE_ENDPOINTS = [
  "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query",
  "https://www.binance.info/bapi/composite/v1/public/cms/article/list/query",
  "https://www.binance.com/bapi/apex/v1/public/apex/cms/article/list/query",
] as const;

const CATALOGS: CatalogConfig[] = [
  {
    id: 48,
    key: "LISTING",
    label: "New Cryptocurrency Listing",
  },
  {
    id: 49,
    key: "NEWS",
    label: "Latest Binance News",
  },
  {
    id: 157,
    key: "MAINTENANCE",
    label: "Wallet Maintenance Updates",
  },
  {
    id: 161,
    key: "DELISTING",
    label: "Delisting",
  },
];

const SYMBOL_ALIASES: Record<string, string[]> = {
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesTerm(text: string, term: string) {
  const normalized = term.toUpperCase();

  if (/^[A-Z0-9]{2,6}$/.test(normalized)) {
    return new RegExp(
      `(^|[^A-Z0-9])${escapeRegex(normalized)}([^A-Z0-9]|$)`,
      "i"
    ).test(text);
  }

  return text.includes(normalized);
}

function ageMinutes(releaseDate: number | undefined) {
  if (!releaseDate || !Number.isFinite(releaseDate)) {
    return null;
  }

  return Math.max(
    0,
    Math.round((Date.now() - releaseDate) / 60_000)
  );
}

function freshnessMultiplier(minutes: number | null) {
  if (minutes === null) return 0.6;
  if (minutes <= 60) return 1;
  if (minutes <= 360) return 0.9;
  if (minutes <= 1440) return 0.8;
  if (minutes <= 4320) return 0.6;
  if (minutes <= 10080) return 0.4;
  return 0.2;
}

function classifyAnnouncement(
  category: CatalogConfig["key"],
  title: string
) {
  const text = title.toUpperCase();

  if (category === "DELISTING") {
    return {
      eventType: "DELISTING",
      sentiment: "BEARISH" as const,
      impact: "HIGH" as const,
      rawScore: -45,
    };
  }

  if (category === "LISTING") {
    return {
      eventType: "LISTING",
      sentiment: "BULLISH" as const,
      impact: "HIGH" as const,
      rawScore: 38,
    };
  }

  if (
    text.includes("SUSPEND") ||
    text.includes("SUSPENSION") ||
    text.includes("PAUSE")
  ) {
    return {
      eventType: "SERVICE_SUSPENSION",
      sentiment: "BEARISH" as const,
      impact: "MEDIUM" as const,
      rawScore: -14,
    };
  }

  if (
    text.includes("RESUME") ||
    text.includes("RESTORE")
  ) {
    return {
      eventType: "SERVICE_RESUMED",
      sentiment: "BULLISH" as const,
      impact: "LOW" as const,
      rawScore: 8,
    };
  }

  if (
    text.includes("UPGRADE") ||
    text.includes("NETWORK UPGRADE") ||
    text.includes("HARD FORK")
  ) {
    return {
      eventType: "NETWORK_UPGRADE",
      sentiment: "NEUTRAL" as const,
      impact: "LOW" as const,
      rawScore: 4,
    };
  }

  if (
    text.includes("TOKEN SWAP") ||
    text.includes("CONTRACT SWAP") ||
    text.includes("MIGRATION")
  ) {
    return {
      eventType: "TOKEN_MIGRATION",
      sentiment: "NEUTRAL" as const,
      impact: "MEDIUM" as const,
      rawScore: 0,
    };
  }

  return {
    eventType: "GENERAL_ANNOUNCEMENT",
    sentiment: "NEUTRAL" as const,
    impact: "LOW" as const,
    rawScore: 0,
  };
}

async function fetchCatalog(config: CatalogConfig) {
  const attempts: Array<{
    endpoint: string;
    status: number | null;
    error: string | null;
  }> = [];

  for (const endpoint of BINANCE_ENDPOINTS) {
    const url = new URL(endpoint);
    url.searchParams.set("type", "1");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("catalogId", String(config.id));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Origin: "https://www.binance.com",
          Referer: "https://www.binance.com/en/support/announcement/",
          clienttype: "web",
          lang: "en",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
        },
      });

      const raw = await response.text();

      if (!response.ok) {
        attempts.push({
          endpoint,
          status: response.status,
          error: raw.slice(0, 180) || `HTTP ${response.status}`,
        });
        continue;
      }

      let json: BinanceResponse;

      try {
        json = JSON.parse(raw) as BinanceResponse;
      } catch {
        attempts.push({
          endpoint,
          status: response.status,
          error: "Binance returned a non-JSON response.",
        });
        continue;
      }

      const nestedArticles =
        json.data?.catalogs?.flatMap(
          (catalog) => catalog.articles ?? []
        ) ?? [];

      const directArticles = json.data?.articles ?? [];

      const articles =
        nestedArticles.length > 0
          ? nestedArticles
          : directArticles;

      // A valid empty catalog is still a successful request.
      if (
        json.code === "000000" ||
        json.success === true ||
        json.data
      ) {
        return {
          success: true as const,
          config,
          articles,
          endpointUsed: endpoint,
          attempts,
          error: null,
        };
      }

      attempts.push({
        endpoint,
        status: response.status,
        error: json.message || "Unexpected Binance response shape.",
      });
    } catch (error) {
      attempts.push({
        endpoint,
        status: null,
        error:
          error instanceof Error
            ? error.message
            : "Binance announcement request failed.",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const lastAttempt = attempts[attempts.length - 1];

  return {
    success: false as const,
    config,
    articles: [] as BinanceArticle[],
    endpointUsed: null,
    attempts,
    error:
      lastAttempt?.error ||
      `${config.label} could not be loaded from Binance.`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const symbol = normalizeTradingSymbol(
      request.nextUrl.searchParams.get("symbol"),
      "BTCUSDT"
    );

    const baseAsset = symbol.slice(0, -4);

    const aliases = Array.from(
      new Set([
        baseAsset,
        ...(SYMBOL_ALIASES[baseAsset] ?? []),
      ])
    );

    const catalogResults = await Promise.all(
      CATALOGS.map(fetchCatalog)
    );

    const seen = new Set<string>();

    const events = catalogResults
      .flatMap((result) =>
        result.articles.map((article) => ({
          article,
          config: result.config,
        }))
      )
      .flatMap(({ article, config }) => {
        const title = article.title?.trim() ?? "";

        if (!title) {
          return [];
        }

        const titleUpper = title.toUpperCase();

        const matchedTerms = aliases.filter((alias) =>
          matchesTerm(titleUpper, alias)
        );

        if (matchedTerms.length === 0) {
          return [];
        }

        const code = article.code ?? "";
        const dedupeKey =
          code ||
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

        if (seen.has(dedupeKey)) {
          return [];
        }

        seen.add(dedupeKey);

        const classification = classifyAnnouncement(
          config.key,
          title
        );

        const minutes = ageMinutes(article.releaseDate);

        const score = Number(
          (
            classification.rawScore *
            freshnessMultiplier(minutes)
          ).toFixed(2)
        );

        return [
          {
            id: dedupeKey,
            title,
            url: code
              ? `${BINANCE_BASE}/en/support/announcement/${code}`
              : `${BINANCE_BASE}/en/support/announcement/`,
            source: "Binance",
            category: config.key,
            categoryLabel: config.label,
            publishedAt: article.releaseDate
              ? new Date(article.releaseDate).toISOString()
              : null,
            ageMinutes: minutes,
            matchedTerms,
            eventType: classification.eventType,
            sentiment: classification.sentiment,
            impact: classification.impact,
            rawScore: classification.rawScore,
            score,
          },
        ];
      })
      .filter(
        (event) =>
          event.ageMinutes === null ||
          event.ageMinutes <= 10_080
      )
      .sort((a, b) => {
        const aTime = a.publishedAt
          ? new Date(a.publishedAt).getTime()
          : 0;

        const bTime = b.publishedAt
          ? new Date(b.publishedAt).getTime()
          : 0;

        return bTime - aTime;
      });

    const announcementScore = Number(
      clamp(
        events
          .slice(0, 15)
          .reduce(
            (sum, event) => sum + event.score,
            0
          ),
        -100,
        100
      ).toFixed(2)
    );

    const bias =
      announcementScore >= 12
        ? "BULLISH"
        : announcementScore <= -12
          ? "BEARISH"
          : "NEUTRAL";

    const failures = catalogResults
      .filter((result) => !result.success)
      .map((result) => ({
        category: result.config.key,
        categoryLabel: result.config.label,
        error: result.error,
      }));

    return NextResponse.json({
      success: true,
      symbol,
      baseAsset,
      aliases,
      source: "Binance Official Announcements",
      bias,
      announcementScore,
      confidenceType: "heuristic",
      meaningfulAnnouncement:
        events.some(
          (event) =>
            event.impact === "HIGH" &&
            (
              event.ageMinutes === null ||
              event.ageMinutes <= 4_320
            )
        ) ||
        Math.abs(announcementScore) >= 12,
      summary: {
        matchedEvents: events.length,
        bullishEvents: events.filter(
          (event) =>
            event.sentiment === "BULLISH"
        ).length,
        bearishEvents: events.filter(
          (event) =>
            event.sentiment === "BEARISH"
        ).length,
        neutralEvents: events.filter(
          (event) =>
            event.sentiment === "NEUTRAL"
        ).length,
        highImpactEvents: events.filter(
          (event) =>
            event.impact === "HIGH"
        ).length,
      },
      events: events.slice(0, 20),
      catalogs: catalogResults.map((result) => ({
        id: result.config.id,
        category: result.config.key,
        label: result.config.label,
        available: result.success,
        articlesRead: result.articles.length,
        endpointUsed: result.endpointUsed,
        attempts: result.attempts,
      })),
      sourceFailures: failures,
      scoring: {
        range: "-100 to +100",
        freshnessAdjusted: true,
        currentlyUsedInTradingDecision: true,
      },
      caveats: [
        "This route currently matches the selected asset from announcement titles.",
        "Generic announcements such as a spot-pair removal notice may name affected assets only inside the article body and can therefore be missed at this stage.",
        "Binance listing and delisting announcements are treated as high-impact catalysts, but price direction is never guaranteed.",
        "This Binance web endpoint is public but not part of the documented Binance trading API and may change.",
        "Announcement intelligence is consumed by the catalyst engine and may receive a controlled weight in LONG/SHORT scoring when the event is meaningful.",
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
            : "Unable to build announcement intelligence.",
      },
      {
        status: 500,
      }
    );
  }
}
