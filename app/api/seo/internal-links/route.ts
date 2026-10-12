import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP_API =
  "https://cms.coinlytx.com/wp-json/wp/v2/posts";

type Candidate = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  focusKeyword: string;
  source: "supabase" | "wordpress";
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "about",
  "after", "before", "while", "where", "when", "what", "which", "who",
  "why", "how", "are", "was", "were", "has", "have", "had", "will",
  "would", "could", "should", "can", "may", "might", "its", "their",
  "they", "them", "you", "your", "our", "but", "not", "than", "then",
  "also", "more", "most", "some", "any", "all", "new", "news",
  "article", "updated", "update", "coinlytx",
]);

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
    .replace(/&#8211;/gi, "-")
    .replace(/&#8212;/gi, "-");
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

function normalize(value: string) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function findExactPhrase(sourceText: string, phrase: string) {
  const source = stripHtml(sourceText);
  const target = stripHtml(phrase).trim();

  if (!source || !target) return "";

  const index = source.toLowerCase().indexOf(target.toLowerCase());

  if (index < 0) return "";

  return source.slice(index, index + target.length);
}

function findAnchorOptions(
  sourceText: string,
  candidate: Candidate
) {
  const rawOptions: string[] = [];

  if (candidate.focusKeyword.trim()) {
    rawOptions.push(candidate.focusKeyword.trim());
  }

  if (candidate.title.trim()) {
    rawOptions.push(candidate.title.trim());
  }

  const words = tokenize(candidate.title);

  for (let size = Math.min(5, words.length); size >= 2; size--) {
    for (let start = 0; start <= words.length - size; start++) {
      rawOptions.push(words.slice(start, start + size).join(" "));
    }
  }

  rawOptions.push(...words.filter((word) => word.length >= 4));

  const matches: string[] = [];
  const seen = new Set<string>();

  for (const option of rawOptions) {
    const exact = findExactPhrase(sourceText, option);

    if (!exact) continue;

    const key = exact.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    matches.push(exact);
  }

  return matches.slice(0, 3);
}

function getAnchorContext(
  sourceText: string,
  anchor: string
) {
  if (!anchor) return "";

  const source = stripHtml(sourceText);
  const index = source.toLowerCase().indexOf(anchor.toLowerCase());

  if (index < 0) return "";

  let start = Math.max(0, index - 90);
  let end = Math.min(source.length, index + anchor.length + 90);

  const previousSentence = Math.max(
    source.lastIndexOf(". ", index),
    source.lastIndexOf("? ", index),
    source.lastIndexOf("! ", index)
  );

  if (previousSentence >= 0 && index - previousSentence <= 150) {
    start = previousSentence + 2;
  }

  const nextStops = [
    source.indexOf(". ", index + anchor.length),
    source.indexOf("? ", index + anchor.length),
    source.indexOf("! ", index + anchor.length),
  ].filter((value) => value >= 0);

  if (nextStops.length) {
    const nextSentence = Math.min(...nextStops);

    if (nextSentence - index <= 180) {
      end = nextSentence + 1;
    }
  }

  let context = source.slice(start, end).trim();

  if (start > 0) context = `…${context}`;
  if (end < source.length) context = `${context}…`;

  return context;
}

function calculateRelevance(
  sourceTitle: string,
  sourceContent: string,
  sourceFocusKeyword: string,
  candidate: Candidate
) {
  const sourceTitleTokens = unique(tokenize(sourceTitle));
  const sourceContentTokens = unique(tokenize(sourceContent));
  const sourceKeywordTokens = unique(tokenize(sourceFocusKeyword));

  const candidateTitleTokens = unique(tokenize(candidate.title));
  const candidateExcerptTokens = unique(tokenize(candidate.excerpt));
  const candidateKeywordTokens = unique(tokenize(candidate.focusKeyword));

  const candidateTokens = unique([
    ...candidateTitleTokens,
    ...candidateExcerptTokens,
    ...candidateKeywordTokens,
  ]);

  if (!candidateTokens.length) return 0;

  let score = 0;

  for (const word of candidateTitleTokens) {
    if (sourceTitleTokens.includes(word)) score += 10;
    if (sourceKeywordTokens.includes(word)) score += 12;
    if (sourceContentTokens.includes(word)) score += 4;
  }

  for (const word of candidateKeywordTokens) {
    if (sourceTitleTokens.includes(word)) score += 12;
    if (sourceKeywordTokens.includes(word)) score += 15;
    if (sourceContentTokens.includes(word)) score += 6;
  }

  for (const word of candidateExcerptTokens) {
    if (sourceTitleTokens.includes(word)) score += 3;
    if (sourceContentTokens.includes(word)) score += 1;
  }

  const overlap = candidateTokens.filter(
    (word) =>
      sourceTitleTokens.includes(word) ||
      sourceContentTokens.includes(word) ||
      sourceKeywordTokens.includes(word)
  ).length;

  score += Math.round((overlap / candidateTokens.length) * 35);

  return Math.min(100, score);
}

function getSearchTerms(
  title: string,
  content: string,
  focusKeyword: string
) {
  const terms: string[] = [];

  if (focusKeyword.trim()) {
    terms.push(focusKeyword.trim());
  }

  const titleWords = unique(tokenize(title)).slice(0, 6);

  if (titleWords.length >= 2) {
    terms.push(titleWords.slice(0, 5).join(" "));
  }

  const frequencies = new Map<string, number>();

  for (const word of tokenize(content)) {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  const importantContentWords = [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);

  if (importantContentWords.length >= 2) {
    terms.push(importantContentWords.slice(0, 4).join(" "));
  }

  terms.push(...titleWords.slice(0, 3));

  return unique(
    terms
      .map((term) => term.trim())
      .filter(Boolean)
  ).slice(0, 6);
}

async function fetchWordPressPosts(
  searchTerms: string[]
): Promise<Candidate[]> {
  if (!searchTerms.length) return [];

  const requests = searchTerms.map(async (term) => {
    try {
      const url = new URL(WP_API);

      url.searchParams.set("search", term);
      url.searchParams.set("per_page", "20");
      url.searchParams.set("status", "publish");
      url.searchParams.set("_fields", "id,slug,title,excerpt");

      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "CoinlytxSEOAgent/3.0",
        },
      });

      if (!response.ok) {
        console.warn(
          "WordPress internal-link search failed:",
          term,
          response.status
        );

        return [];
      }

      const posts = await response.json();

      if (!Array.isArray(posts)) return [];

      return posts.map(
        (post: any): Candidate => ({
          id: `wp-${post.id}`,
          title: stripHtml(post?.title?.rendered || ""),
          slug: typeof post?.slug === "string" ? post.slug : "",
          excerpt: stripHtml(post?.excerpt?.rendered || ""),
          focusKeyword: "",
          source: "wordpress",
        })
      );
    } catch (error) {
      console.warn("WordPress search error:", term, error);
      return [];
    }
  });

  const results = await Promise.all(requests);
  const posts = results.flat();
  const map = new Map<string, Candidate>();

  for (const post of posts) {
    if (!post.slug) continue;
    if (!map.has(post.slug)) map.set(post.slug, post);
  }

  return [...map.values()];
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

    const body = await request.json();

    const title =
      typeof body?.title === "string" ? body.title.trim() : "";

    const content =
      typeof body?.content === "string" ? body.content : "";

    const focusKeyword =
      typeof body?.focusKeyword === "string"
        ? body.focusKeyword.trim()
        : "";

    const currentArticleId =
      typeof body?.currentArticleId === "string"
        ? body.currentArticleId
        : "";

    const currentSlug =
      typeof body?.currentSlug === "string"
        ? body.currentSlug.trim()
        : "";

    if (!title && !content.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Add article title or content before finding internal links.",
        },
        { status: 400 }
      );
    }

    let supabaseQuery = supabase
      .from("articles")
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        focus_keyword
        `
      )
      .eq("status", "published")
      .not("slug", "is", null)
      .limit(500);

    if (currentArticleId) {
      supabaseQuery = supabaseQuery.neq("id", currentArticleId);
    }

    const {
      data: supabaseData,
      error: supabaseError,
    } = await supabaseQuery;

    if (supabaseError) throw supabaseError;

    const supabaseCandidates: Candidate[] =
      (supabaseData || []).map((article: any) => ({
        id: article.id,
        title: article.title || "",
        slug: article.slug || "",
        excerpt: article.excerpt || "",
        focusKeyword: article.focus_keyword || "",
        source: "supabase",
      }));

    const searchTerms = getSearchTerms(
      title,
      content,
      focusKeyword
    );

    const wordpressCandidates =
      await fetchWordPressPosts(searchTerms);

    const combinedMap = new Map<string, Candidate>();

    for (const candidate of [
      ...supabaseCandidates,
      ...wordpressCandidates,
    ]) {
      if (!candidate.slug) continue;
      if (currentSlug && candidate.slug === currentSlug) continue;

      if (!combinedMap.has(candidate.slug)) {
        combinedMap.set(candidate.slug, candidate);
      }
    }

    const candidates = [...combinedMap.values()];

    const sourceText = [
      title,
      focusKeyword,
      stripHtml(content),
    ].join(" ");

    const recommendations = candidates
      .map((candidate) => {
        const anchorOptions = findAnchorOptions(
          sourceText,
          candidate
        );

        const anchor = anchorOptions[0] || "";

        const baseRelevance = calculateRelevance(
          title,
          content,
          focusKeyword,
          candidate
        );

        const anchorWordCount = anchor
          ? anchor.trim().split(/\s+/).length
          : 0;

        const anchorBonus =
          anchorWordCount >= 3
            ? 15
            : anchorWordCount === 2
              ? 10
              : anchorWordCount === 1
                ? 4
                : 0;

        const relevance = Math.min(
          100,
          baseRelevance + anchorBonus
        );

        return {
          articleId: candidate.id,
          title: candidate.title,
          slug: candidate.slug,
          url: `https://coinlytx.com/${candidate.slug}`,
          source: candidate.source,
          relevance,
          anchor,
          anchorOptions,
          context: getAnchorContext(sourceText, anchor),
          canInsertAutomatically: Boolean(anchor),
        };
      })
      .filter(
        (item) =>
          item.slug &&
          item.relevance >= 8
      )
      .sort((a, b) => {
        if (
          a.canInsertAutomatically !==
          b.canInsertAutomatically
        ) {
          return a.canInsertAutomatically ? -1 : 1;
        }

        const aWords = a.anchor
          ? a.anchor.split(/\s+/).length
          : 0;

        const bWords = b.anchor
          ? b.anchor.split(/\s+/).length
          : 0;

        if (aWords !== bWords) {
          return bWords - aWords;
        }

        return b.relevance - a.relevance;
      })
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      searchTerms,
      totalCandidates: candidates.length,
      supabaseCandidates: supabaseCandidates.length,
      wordpressCandidates: wordpressCandidates.length,
      recommendations,
    });
  } catch (error) {
    console.error(
      "Internal link recommendation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate internal link recommendations.",
      },
      { status: 500 }
    );
  }
}
