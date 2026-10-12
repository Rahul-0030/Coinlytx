import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
  focus_keyword: string | null;
  status: string | null;
};

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could",
  "did","do","does","for","from","had","has","have","how","if","in","into","is",
  "it","its","may","more","most","of","on","or","our","should","than","that",
  "the","their","there","these","they","this","to","was","were","what","when",
  "where","which","who","why","will","with","would","you","your"
]);

const GENERIC = new Set([
  "news","latest","today","update","updates","new","best","top","guide","market",
  "markets","crypto","cryptocurrency","digital","business","global","article",
  "price","prices","company","companies","industry","project","platform"
]);

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word)
    );
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:www\.)?coinlytx\.com\//i, "")
    .replace(/^https?:\/\/cms\.coinlytx\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .split("?")[0]
    .split("#")[0];
}

function weightedProfile(
  title: string,
  focusKeyword: string,
  content: string
) {
  const weights = new Map<string, number>();

  function add(text: string, weight: number, cap = 4) {
    const counts = new Map<string, number>();

    for (const token of tokenize(text)) {
      counts.set(
        token,
        Math.min(cap, (counts.get(token) || 0) + 1)
      );
    }

    for (const [token, count] of counts) {
      const genericPenalty = GENERIC.has(token) ? 0.35 : 1;

      weights.set(
        token,
        (weights.get(token) || 0) +
          count * weight * genericPenalty
      );
    }
  }

  add(title, 7, 2);
  add(focusKeyword, 8, 2);
  add(stripHtml(content).slice(0, 9000), 1, 3);

  return weights;
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
) {
  const keys = new Set([...a.keys(), ...b.keys()]);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const key of keys) {
    const av = a.get(key) || 0;
    const bv = b.get(key) || 0;

    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (!magA || !magB) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function overlapRatio(
  current: string,
  other: string
) {
  const currentTokens = unique(
    tokenize(current).filter(
      (word) => !GENERIC.has(word)
    )
  );

  const otherTokens = new Set(
    tokenize(other).filter(
      (word) => !GENERIC.has(word)
    )
  );

  if (!currentTokens.length) return 0;

  const matches = currentTokens.filter(
    (word) => otherTokens.has(word)
  ).length;

  return matches / currentTokens.length;
}

async function loadAllPublishedArticles(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const rows: ArticleRow[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("articles")
      .select("id,title,slug,content,focus_keyword,status")
      .eq("status", "published")
      .not("slug", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to read published articles: ${error.message}`
      );
    }

    const batch = (data || []) as ArticleRow[];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "cannibalization",
    version: "1.0",
    message:
      "Coinlytx keyword cannibalization analyzer is active.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json().catch(() => ({}));

    const currentArticleId = String(
      body.currentArticleId || ""
    ).trim();

    const currentTitle = String(
      body.title || ""
    ).trim();

    const currentSlug = normalizeSlug(
      String(body.slug || "")
    );

    const currentContent = String(
      body.content || ""
    );

    const currentFocusKeyword = String(
      body.focusKeyword || ""
    ).trim();

    if (!currentTitle) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Article title is required.",
        },
        {
          status: 400,
        }
      );
    }

    const currentProfile = weightedProfile(
      currentTitle,
      currentFocusKeyword,
      currentContent
    );

    const allArticles =
      await loadAllPublishedArticles(
        supabase
      );

    const conflicts = allArticles
      .filter((article) => {
        if (
          currentArticleId &&
          article.id === currentArticleId
        ) {
          return false;
        }

        const slug = normalizeSlug(
          article.slug || ""
        );

        if (
          currentSlug &&
          slug === currentSlug
        ) {
          return false;
        }

        return Boolean(
          article.title &&
            article.slug &&
            article.content
        );
      })
      .map((article) => {
        const profile = weightedProfile(
          article.title || "",
          article.focus_keyword || "",
          article.content || ""
        );

        const semantic = cosineSimilarity(
          currentProfile,
          profile
        );

        const titleMatch = overlapRatio(
          currentTitle,
          article.title || ""
        );

        const focusMatch = overlapRatio(
          currentFocusKeyword,
          article.focus_keyword || ""
        );

        const exactKeywordMatch =
          Boolean(
            currentFocusKeyword &&
            article.focus_keyword &&
            currentFocusKeyword.toLowerCase() ===
              article.focus_keyword.toLowerCase()
          );

        let score =
          semantic * 65 +
          titleMatch * 25 +
          focusMatch * 10;

        if (exactKeywordMatch) {
          score += 15;
        }

        score = Math.min(
          100,
          Math.round(score)
        );

        return {
          articleId: article.id,
          title:
            article.title ||
            "Untitled Article",
          slug:
            article.slug ||
            "",
          focusKeyword:
            article.focus_keyword ||
            "",
          similarity: score,
          exactKeywordMatch,
          risk:
            score >= 75
              ? "high"
              : score >= 55
                ? "medium"
                : "low",
        };
      })
      .filter(
        (item) =>
          item.similarity >= 40
      )
      .sort(
        (a, b) =>
          b.similarity -
          a.similarity
      )
      .slice(0, 10);

    const highRisk = conflicts.filter(
      (item) =>
        item.risk === "high"
    );

    const mediumRisk = conflicts.filter(
      (item) =>
        item.risk === "medium"
    );

    const overallRisk =
      highRisk.length > 0
        ? "high"
        : mediumRisk.length > 0
          ? "medium"
          : "low";

    const recommendations: string[] = [];

    if (highRisk.length > 0) {
      recommendations.push(
        "A very similar published article already exists. Compare search intent before publishing another page targeting the same topic."
      );
      recommendations.push(
        "If both pages answer the same query, consolidate them or differentiate this article with a clearly different intent, angle or primary keyword."
      );
    } else if (mediumRisk.length > 0) {
      recommendations.push(
        "Potential topic overlap detected. Keep the focus keyword and search intent distinct from the existing page."
      );
    } else {
      recommendations.push(
        "No strong internal cannibalization conflict was detected in the published Coinlytx article set."
      );
    }

    if (
      conflicts.some(
        (item) =>
          item.exactKeywordMatch
      )
    ) {
      recommendations.push(
        "The same exact focus keyword is already assigned to another published article. Avoid competing pages unless their intents are intentionally different."
      );
    }

    return NextResponse.json({
      success: true,
      route: "cannibalization",
      version: "1.0",
      scannedPublishedArticles:
        allArticles.length,
      risk: overallRisk,
      summary: {
        highRisk:
          highRisk.length,
        mediumRisk:
          mediumRisk.length,
        totalConflicts:
          conflicts.length,
      },
      conflicts,
      recommendations,
      note:
        "This checks internal topic overlap in Coinlytx. Real Google cannibalization should also be validated with Search Console query/page performance.",
    });
  } catch (error) {
    console.error(
      "Cannibalization analysis error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route: "cannibalization",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze cannibalization.",
      },
      {
        status: 500,
      }
    );
  }
}
