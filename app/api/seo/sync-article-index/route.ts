import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP_API = "https://cms.coinlytx.com/wp-json/wp/v2/posts";

/*
 * Keep WordPress batches small.
 * Article bodies can be large, so 100 posts in one request may hang.
 */
const WP_PAGE_SIZE = 20;
const WP_TIMEOUT_MS = 30000;

type IndexRow = {
  source: "supabase" | "wordpress";
  source_id: string;
  article_id: string | null;
  title: string;
  slug: string;
  url: string;
  status: string;
  category: string | null;
  word_count: number;
  outgoing_internal_links: number;
  updated_at: string;
};

type WordPressPost = {
  id: number | string;
  slug?: string;
  title?: {
    rendered?: string;
  };
  content?: {
    rendered?: string;
  };
};

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
    .replace(/&#8221;/gi, '"');
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

function countWords(html: string) {
  const text = stripHtml(html);

  if (!text) return 0;

  return text.split(/\s+/).filter(Boolean).length;
}

function normalizePathname(value: string) {
  let pathname = value.trim();

  if (!pathname) return "";

  pathname = pathname.split("#")[0].split("?")[0];

  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function extractInternalLinks(html: string) {
  const links: string[] = [];
  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const rawHref = match[1]?.trim() || "";

    if (!rawHref) continue;

    if (
      rawHref.startsWith("#") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:") ||
      rawHref.startsWith("javascript:")
    ) {
      continue;
    }

    if (rawHref.startsWith("/")) {
      const path = normalizePathname(rawHref);

      if (path && path !== "/") {
        links.push(path);
      }

      continue;
    }

    try {
      const url = new URL(rawHref);
      const hostname = url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

      if (
        hostname === "coinlytx.com" ||
        hostname === "cms.coinlytx.com"
      ) {
        const path = normalizePathname(url.pathname);

        if (path && path !== "/") {
          links.push(path);
        }
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...new Set(links)];
}

function cleanTitle(value: string) {
  return stripHtml(value);
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function upsertRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: IndexRow[]
) {
  if (!rows.length) return;

  for (const chunk of chunkArray(rows, 100)) {
    const { error } = await supabase
      .from("seo_article_index")
      .upsert(chunk, {
        onConflict: "source,source_id",
      });

    if (error) {
      throw new Error(
        `Supabase article-index upsert failed: ${error.message}`
      );
    }
  }
}

async function syncSupabaseArticles(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const rows: IndexRow[] = [];
  const pageSize = 250;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("articles")
      .select(
        `
        id,
        title,
        slug,
        status,
        content,
        word_count
        `
      )
      .eq("status", "published")
      .not("slug", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to read Supabase articles: ${error.message}`
      );
    }

    const articles = data || [];

    for (const article of articles) {
      const slug =
        typeof article.slug === "string"
          ? article.slug.trim()
          : "";

      if (!slug) continue;

      const html =
        typeof article.content === "string"
          ? article.content
          : "";

      rows.push({
        source: "supabase",
        source_id: String(article.id),
        article_id: String(article.id),
        title:
          typeof article.title === "string" &&
          article.title.trim()
            ? article.title.trim()
            : "Untitled Article",
        slug,
        url: `https://coinlytx.com/${slug}`,
        status: "published",
        category: null,
        word_count:
          typeof article.word_count === "number"
            ? article.word_count
            : countWords(html),
        outgoing_internal_links:
          extractInternalLinks(html).length,
        updated_at: new Date().toISOString(),
      });
    }

    if (articles.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  await upsertRows(supabase, rows);

  return rows.length;
}

async function fetchWordPressPage(page: number) {
  const url = new URL(WP_API);

  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(WP_PAGE_SIZE));
  url.searchParams.set("status", "publish");
  url.searchParams.set(
    "_fields",
    "id,slug,title,content"
  );

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WP_TIMEOUT_MS
  );

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CoinlytxSEOIndex/4.0",
      },
    });

    if (!response.ok) {
      let details = "";

      try {
        details = await response.text();
      } catch {
        details = "";
      }

      throw new Error(
        `WordPress returned HTTP ${response.status}${
          details ? `: ${details.slice(0, 180)}` : ""
        }`
      );
    }

    const raw = await response.json();

    const posts: WordPressPost[] = Array.isArray(raw)
      ? raw
      : [];

    const totalPages = Number(
      response.headers.get("x-wp-totalpages") || "1"
    );

    const totalPosts = Number(
      response.headers.get("x-wp-total") || "0"
    );

    return {
      posts,
      totalPages,
      totalPosts,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        `WordPress page ${page} took longer than ${
          WP_TIMEOUT_MS / 1000
        } seconds. The request was stopped safely.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "sync-article-index",
    version: "4.0",
    wordpressBatchSize: WP_PAGE_SIZE,
    message:
      "Coinlytx article-index sync route is active. Migrated article mappings are preserved.",
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

    let body: {
      wpPage?: number;
    } = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedPage = Number(body.wpPage || 1);

    const wpPage =
      Number.isFinite(requestedPage) &&
      requestedPage >= 1
        ? Math.floor(requestedPage)
        : 1;

    let supabaseSynced = 0;

    if (wpPage === 1) {
      supabaseSynced =
        await syncSupabaseArticles(supabase);
    }

    const {
      posts,
      totalPages,
      totalPosts,
    } = await fetchWordPressPage(wpPage);

    const wordpressRows: IndexRow[] = [];

    for (const post of posts) {
      const slug =
        typeof post.slug === "string"
          ? post.slug.trim()
          : "";

      if (!slug) continue;

      const html =
        typeof post.content?.rendered === "string"
          ? post.content.rendered
          : "";

      const title =
        typeof post.title?.rendered === "string"
          ? cleanTitle(post.title.rendered)
          : "";

      const sourceId = String(post.id);

      const {
        data: existingIndexRows,
        error: existingIndexError,
      } = await supabase
        .from("seo_article_index")
        .select("article_id")
        .eq("source", "wordpress")
        .eq("source_id", sourceId)
        .limit(1);

      if (existingIndexError) {
        throw new Error(
          `Unable to preserve migrated article mapping for WordPress post ${sourceId}: ${existingIndexError.message}`
        );
      }

      const existingArticleId =
        existingIndexRows?.[0]?.article_id || null;

      wordpressRows.push({
        source: "wordpress",
        source_id: sourceId,
        article_id: existingArticleId,
        title: title || "Untitled Article",
        slug,
        url: `https://coinlytx.com/${slug}`,
        status: "published",
        category: null,
        word_count: countWords(html),
        outgoing_internal_links:
          extractInternalLinks(html).length,
        updated_at: new Date().toISOString(),
      });
    }

    await upsertRows(supabase, wordpressRows);

    const hasMore = wpPage < totalPages;

    return NextResponse.json({
      success: true,
      route: "sync-article-index",
      version: "4.0",
      wordpressBatchSize: WP_PAGE_SIZE,
      supabase: {
        synced: supabaseSynced,
      },
      wordpress: {
        currentPage: wpPage,
        synced: wordpressRows.length,
        totalPosts,
        totalPages,
        hasMore,
        nextPage: hasMore
          ? wpPage + 1
          : null,
      },
    });
  } catch (error) {
    console.error(
      "SEO article index sync error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route: "sync-article-index",
        version: "4.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync article index.",
      },
      {
        status: 500,
      }
    );
  }
}
