import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArticleCandidate = {
  id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
  status: string | null;
  focus_keyword: string | null;
};

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could",
  "did","do","does","for","from","had","has","have","how","if","in","into","is",
  "it","its","may","more","most","of","on","or","our","should","than","that","the",
  "their","there","these","they","this","to","was","were","what","when","where",
  "which","who","why","will","with","would","you","your"
]);

const GENERIC = new Set([
  "ai","growth","market","markets","crypto","cryptocurrency","bitcoin","blockchain",
  "technology","digital","business","finance","financial","marketing","data","web3",
  "innovation","investors","price","prices","news","global","company","companies",
  "industry","platform","project"
]);

const FORBIDDEN_TAGS = new Set([
  "a","script","style","code","pre","h1","h2","h3","h4","h5","h6"
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

function normalizeWord(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .trim();
}

function tokenize(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(normalizeWord)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function normalizeSlug(value: string) {
  let result = value.trim();

  try {
    result = decodeURIComponent(result);
  } catch {}

  return result
    .replace(/^https?:\/\/(?:www\.)?coinlytx\.com\//i, "")
    .replace(/^https?:\/\/cms\.coinlytx\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();
}

function hasExistingTargetLink(html: string, targetSlug: string) {
  const regex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1] || "", "https://coinlytx.com");
      const host = url.hostname.toLowerCase().replace(/^www\./, "");

      if (host !== "coinlytx.com" && host !== "cms.coinlytx.com") {
        continue;
      }

      if (normalizeSlug(url.pathname) === targetSlug) {
        return true;
      }
    } catch {}
  }

  return false;
}

function safeTextChunks(html: string) {
  const parts = html.split(/(<[^>]+>)/g);
  const stack: string[] = [];
  const chunks: string[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("<") && part.endsWith(">")) {
      const closing = part.match(/^<\s*\/\s*([a-z0-9]+)/i);

      if (closing) {
        const tag = closing[1].toLowerCase();

        for (let i = stack.length - 1; i >= 0; i -= 1) {
          if (stack[i] === tag) {
            stack.splice(i, 1);
            break;
          }
        }

        continue;
      }

      const opening = part.match(/^<\s*([a-z0-9]+)/i);

      if (!opening) continue;

      const tag = opening[1].toLowerCase();
      const selfClosing =
        /\/\s*>$/.test(part) ||
        ["img","br","hr","meta","link","input","source"].includes(tag);

      if (!selfClosing) stack.push(tag);
      continue;
    }

    if (stack.some((tag) => FORBIDDEN_TAGS.has(tag))) continue;

    const cleaned = decodeHtml(part).replace(/\s+/g, " ").trim();

    if (cleaned) chunks.push(cleaned);
  }

  return chunks;
}

function buildDocumentFrequency(articles: ArticleCandidate[]) {
  const df = new Map<string, number>();

  for (const article of articles) {
    const words = new Set(
      tokenize(
        `${article.title || ""} ${stripHtml(article.content || "").slice(0, 6000)}`
      )
    );

    for (const word of words) {
      df.set(word, (df.get(word) || 0) + 1);
    }
  }

  return df;
}

function buildTargetProfile(
  title: string,
  focusKeyword: string,
  body: string,
  documentFrequency: Map<string, number>,
  documentCount: number
) {
  const weights = new Map<string, number>();

  const add = (text: string, boost: number, cap: number) => {
    const counts = new Map<string, number>();

    for (const token of tokenize(text)) {
      counts.set(token, Math.min(cap, (counts.get(token) || 0) + 1));
    }

    for (const [token, count] of counts) {
      const df = documentFrequency.get(token) || 0;
      const idf = Math.log((documentCount + 1) / (df + 1)) + 1;
      const genericPenalty = GENERIC.has(token) ? 0.35 : 1;

      weights.set(
        token,
        (weights.get(token) || 0) + count * boost * idf * genericPenalty
      );
    }
  };

  add(title, 6, 2);
  add(focusKeyword, 7, 2);
  add(body.slice(0, 9000), 1, 3);

  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([token, weight]) => ({ token, weight }));
}

function findBestAnchor(
  html: string,
  targetProfile: Array<{ token: string; weight: number }>
) {
  const weights = new Map(targetProfile.map((x) => [x.token, x.weight]));
  let bestAnchor = "";
  let bestScore = 0;

  for (const chunk of safeTextChunks(html)) {
    const rawWords = chunk.split(/\s+/).filter(Boolean);

    for (let size = 2; size <= 5; size += 1) {
      for (let i = 0; i <= rawWords.length - size; i += 1) {
        const raw = rawWords.slice(i, i + size);
        const normalized = raw.map(normalizeWord).filter(Boolean);

        const meaningful = [
          ...new Set(
            normalized.filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
          ),
        ];

        const matched = meaningful.filter((word) => weights.has(word));

        if (matched.length < 2) continue;
        if (matched.every((word) => GENERIC.has(word))) continue;

        const matchedWeight = matched.reduce(
          (sum, word) => sum + (weights.get(word) || 0),
          0
        );

        const score =
          matchedWeight +
          matched.length * 6 +
          (size === 3 ? 6 : size === 2 ? 4 : size === 4 ? 3 : 0);

        if (score > bestScore) {
          bestScore = score;
          bestAnchor = raw.join(" ");
        }
      }
    }
  }

  return { anchor: bestAnchor, anchorScore: bestScore };
}

function getContext(sourceText: string, anchor: string) {
  if (!anchor) return "";

  const index = sourceText
    .toLowerCase()
    .indexOf(anchor.toLowerCase());

  if (index < 0) return "";

  return sourceText
    .slice(
      Math.max(0, index - 140),
      Math.min(sourceText.length, index + anchor.length + 190)
    )
    .trim();
}

function calculateRelevance(
  sourceTitle: string,
  sourceBody: string,
  targetProfile: Array<{ token: string; weight: number }>,
  anchor: string,
  anchorScore: number
) {
  const titleTokens = new Set(tokenize(sourceTitle));
  const bodyTokens = new Set(tokenize(sourceBody.slice(0, 9000)));

  const totalWeight = targetProfile.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;

  let bodyMatched = 0;
  let titleMatched = 0;
  let highValueMatches = 0;

  targetProfile.forEach((item, index) => {
    if (bodyTokens.has(item.token)) bodyMatched += item.weight;
    if (titleTokens.has(item.token)) titleMatched += item.weight;

    if (index < 8 && bodyTokens.has(item.token)) {
      highValueMatches += 1;
    }
  });

  let score =
    (bodyMatched / totalWeight) * 58 +
    (titleMatched / totalWeight) * 28 +
    Math.min(9, highValueMatches * 1.5);

  if (anchor) {
    score += Math.min(12, anchorScore / 8);

    const anchorTokens = tokenize(anchor);

    if (anchorTokens.length >= 2 && anchorTokens.length <= 5) {
      score += 4;
    }

    if (anchorTokens.some((word) => !GENERIC.has(word))) {
      score += 3;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function canAutoInsert(
  relevance: number,
  anchor: string,
  targetProfile: Array<{ token: string; weight: number }>
) {
  if (relevance < 50 || !anchor) return false;

  const anchorTokens = tokenize(anchor);
  const targetTokens = new Set(targetProfile.map((x) => x.token));

  const matched = anchorTokens.filter((word) => targetTokens.has(word));
  const meaningful = matched.filter((word) => !GENERIC.has(word));

  return (
    anchorTokens.length >= 2 &&
    anchorTokens.length <= 5 &&
    matched.length >= 2 &&
    meaningful.length >= 1
  );
}

async function loadAllArticles(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const rows: ArticleCandidate[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("articles")
      .select("id,title,slug,content,status,focus_keyword")
      .not("slug", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Unable to read migrated articles: ${error.message}`);
    }

    const batch = (data || []) as ArticleCandidate[];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "orphan-backlinks",
    version: "3.0",
    message:
      "Coinlytx orphan backlink finder is active with target-content topical scoring.",
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
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetSlug = normalizeSlug(body.targetSlug || "");

    if (!targetSlug) {
      return NextResponse.json(
        { success: false, error: "Target article slug is required." },
        { status: 400 }
      );
    }

    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("seo_article_index")
      .select(
        "id,title,slug,article_id,source,incoming_internal_links,outgoing_internal_links,is_orphan"
      )
      .eq("slug", targetSlug)
      .limit(10);

    if (inventoryError) {
      throw new Error(
        `Unable to load target article: ${inventoryError.message}`
      );
    }

    if (!inventoryRows?.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Target article was not found in the SEO article index.",
        },
        { status: 404 }
      );
    }

    const targetRecord =
      inventoryRows.find((row) => Boolean(row.article_id)) || inventoryRows[0];

    const targetTitle =
      typeof targetRecord.title === "string" ? targetRecord.title : targetSlug;

    let targetFocusKeyword = "";
    let targetContent = "";

    if (targetRecord.article_id) {
      const { data: targetArticle, error: targetArticleError } = await supabase
        .from("articles")
        .select("focus_keyword,content")
        .eq("id", targetRecord.article_id)
        .maybeSingle();

      if (targetArticleError) {
        throw new Error(
          `Unable to load target article content: ${targetArticleError.message}`
        );
      }

      targetFocusKeyword = targetArticle?.focus_keyword || "";
      targetContent = stripHtml(targetArticle?.content || "");
    }

    const allArticles = await loadAllArticles(supabase);
    const documentFrequency = buildDocumentFrequency(allArticles);

    const targetProfile = buildTargetProfile(
      targetTitle,
      targetFocusKeyword,
      targetContent,
      documentFrequency,
      allArticles.length
    );

    const recommendations = allArticles
      .filter((article) => {
        const slug = normalizeSlug(article.slug || "");

        return (
          slug &&
          slug !== targetSlug &&
          article.status === "published" &&
          Boolean(article.content)
        );
      })
      .map((article) => {
        const html = article.content || "";

        if (hasExistingTargetLink(html, targetSlug)) return null;

        const bodyText = stripHtml(html);
        const { anchor, anchorScore } = findBestAnchor(html, targetProfile);

        const relevance = calculateRelevance(
          article.title || "",
          bodyText,
          targetProfile,
          anchor,
          anchorScore
        );

        return {
          sourceArticleId: article.id,
          sourceTitle: article.title || "Untitled Article",
          sourceSlug: article.slug || "",
          sourceStatus: article.status || "published",
          relevance,
          anchor,
          anchorOptions: anchor ? [anchor] : [],
          context: getContext(bodyText, anchor),
          canInsertAutomatically: canAutoInsert(
            relevance,
            anchor,
            targetProfile
          ),
          quality:
            relevance >= 70
              ? "strong"
              : relevance >= 50
                ? "good"
                : "manual",
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> => item !== null
      )
      .filter((item) => item.relevance >= 30)
      .sort((a, b) => {
        if (
          a.canInsertAutomatically !==
          b.canInsertAutomatically
        ) {
          return a.canInsertAutomatically ? -1 : 1;
        }

        return b.relevance - a.relevance;
      })
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      route: "orphan-backlinks",
      version: "3.0",
      target: {
        title: targetTitle,
        slug: targetSlug,
        articleId: targetRecord.article_id || null,
        incomingInternalLinks:
          targetRecord.incoming_internal_links || 0,
        outgoingInternalLinks:
          targetRecord.outgoing_internal_links || 0,
        isOrphan: targetRecord.is_orphan === true,
      },
      scoring: {
        targetContentUsed: Boolean(targetContent),
        publishedSourcesOnly: true,
        autoInsertMinimumRelevance: 50,
        safeAnchorWords: "2-5",
        safeTextNodesOnly: true,
      },
      targetKeywords: targetProfile.slice(0, 12).map((item) => item.token),
      scannedArticles: allArticles.length,
      recommendations,
    });
  } catch (error) {
    console.error("Orphan backlink finder error:", error);

    return NextResponse.json(
      {
        success: false,
        route: "orphan-backlinks",
        version: "3.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to find backlink opportunities.",
      },
      { status: 500 }
    );
  }
}
