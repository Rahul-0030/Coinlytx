import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP_API =
  "https://cms.coinlytx.com/wp-json/wp/v2/posts";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;
const WP_TIMEOUT_MS = 30000;

type WpTerm = {
  id?: number;
  name?: string;
  slug?: string;
  taxonomy?: string;
};

type WpFeaturedMedia = {
  source_url?: string;
  alt_text?: string;
  caption?: {
    rendered?: string;
  };
};

type WpPost = {
  id: number | string;
  slug?: string;
  link?: string;
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
  title?: {
    rendered?: string;
  };
  excerpt?: {
    rendered?: string;
  };
  content?: {
    rendered?: string;
  };
  featured_media?: number;
  yoast_head_json?: {
    title?: string;
    description?: string;
    canonical?: string;
  };
  _embedded?: {
    "wp:featuredmedia"?: WpFeaturedMedia[];
    "wp:term"?: WpTerm[][];
  };
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
};

type PreparedArticle = {
  wordpressId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string | null;
  categoryId: string | null;
  categoryName: string | null;
  featuredImageUrl: string;
  featuredImageAlt: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  wordCount: number;
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

function normalizePublishedAt(post: WpPost) {
  const gmt = post.date_gmt?.trim();

  if (gmt) {
    return gmt.endsWith("Z")
      ? gmt
      : `${gmt}Z`;
  }

  const local = post.date?.trim();

  if (!local) return null;

  const parsed = new Date(local);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function getFeaturedImage(post: WpPost) {
  const media =
    post._embedded?.["wp:featuredmedia"]?.[0];

  return {
    url:
      typeof media?.source_url === "string"
        ? media.source_url.trim()
        : "",
    alt:
      typeof media?.alt_text === "string"
        ? media.alt_text.trim()
        : "",
  };
}

function getWpCategories(post: WpPost) {
  const groups =
    post._embedded?.["wp:term"] || [];

  const terms =
    groups.flat().filter(
      (term) =>
        term &&
        term.taxonomy === "category"
    );

  return terms;
}

function findCategory(
  wpCategories: WpTerm[],
  categories: CategoryRow[]
) {
  for (const wpCategory of wpCategories) {
    const wpSlug =
      typeof wpCategory.slug === "string"
        ? wpCategory.slug.trim().toLowerCase()
        : "";

    if (!wpSlug) continue;

    const match = categories.find(
      (category) =>
        category.slug.trim().toLowerCase() === wpSlug
    );

    if (match) {
      return {
        id: match.id,
        name: match.name,
      };
    }
  }

  return {
    id: null,
    name:
      typeof wpCategories[0]?.name === "string"
        ? wpCategories[0].name.trim() || null
        : null,
  };
}

function prepareArticle(
  post: WpPost,
  categories: CategoryRow[]
): PreparedArticle | null {
  const slug =
    typeof post.slug === "string"
      ? post.slug.trim()
      : "";

  if (!slug) return null;

  const title =
    stripHtml(post.title?.rendered || "") ||
    "Untitled Article";

  const excerpt =
    stripHtml(post.excerpt?.rendered || "");

  const content =
    typeof post.content?.rendered === "string"
      ? post.content.rendered
      : "";

  const featured =
    getFeaturedImage(post);

  const wpCategories =
    getWpCategories(post);

  const category =
    findCategory(
      wpCategories,
      categories
    );

  const seoTitle =
    typeof post.yoast_head_json?.title === "string"
      ? stripHtml(post.yoast_head_json.title)
      : "";

  const metaDescription =
    typeof post.yoast_head_json?.description === "string"
      ? stripHtml(post.yoast_head_json.description)
      : "";

  const canonicalUrl =
    typeof post.yoast_head_json?.canonical === "string" &&
    post.yoast_head_json.canonical.trim()
      ? post.yoast_head_json.canonical.trim()
      : `https://coinlytx.com/${slug}`;

  return {
    wordpressId: String(post.id),
    title,
    slug,
    excerpt,
    content,
    publishedAt:
      normalizePublishedAt(post),
    categoryId:
      category.id,
    categoryName:
      category.name,
    featuredImageUrl:
      featured.url,
    featuredImageAlt:
      featured.alt || title,
    seoTitle,
    metaDescription,
    canonicalUrl,
    wordCount:
      countWords(content),
  };
}

async function fetchWordPressPage(
  page: number,
  perPage: number
) {
  const url =
    new URL(WP_API);

  url.searchParams.set(
    "page",
    String(page)
  );

  url.searchParams.set(
    "per_page",
    String(perPage)
  );

  url.searchParams.set(
    "status",
    "publish"
  );

  url.searchParams.set(
    "_embed",
    "1"
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      WP_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",
          cache: "no-store",
          signal:
            controller.signal,
          headers: {
            Accept:
              "application/json",
            "User-Agent":
              "CoinlytxMigration/1.0",
          },
        }
      );

    if (!response.ok) {
      let details = "";

      try {
        details =
          await response.text();
      } catch {
        details = "";
      }

      throw new Error(
        `WordPress returned HTTP ${response.status}${
          details
            ? `: ${details.slice(0, 180)}`
            : ""
        }`
      );
    }

    const raw =
      await response.json();

    const posts:
      WpPost[] =
      Array.isArray(raw)
        ? raw
        : [];

    const totalPages =
      Number(
        response.headers.get(
          "x-wp-totalpages"
        ) || "1"
      );

    const totalPosts =
      Number(
        response.headers.get(
          "x-wp-total"
        ) || "0"
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
        } seconds.`
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function loadCategories(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const {
    data,
    error,
  } =
    await supabase
      .from("categories")
      .select("id,name,slug")
      .order("name");

  if (error) {
    throw new Error(
      `Unable to load Supabase categories: ${error.message}`
    );
  }

  return (
    (data || []) as CategoryRow[]
  );
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route:
      "migrate-wordpress",
    version: "1.0",
    defaultPageSize:
      DEFAULT_PAGE_SIZE,
    maxPageSize:
      MAX_PAGE_SIZE,
    defaultMode:
      "dry-run",
    message:
      "Coinlytx WordPress migration route is active. POST with dryRun=true before importing.",
  });
}

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth
        .getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    let body: {
      page?: number;
      perPage?: number;
      dryRun?: boolean;
    } = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const requestedPage =
      Number(body.page || 1);

    const page =
      Number.isFinite(
        requestedPage
      ) &&
      requestedPage >= 1
        ? Math.floor(
            requestedPage
          )
        : 1;

    const requestedPerPage =
      Number(
        body.perPage ||
          DEFAULT_PAGE_SIZE
      );

    const perPage =
      Number.isFinite(
        requestedPerPage
      ) &&
      requestedPerPage >= 1
        ? Math.min(
            Math.floor(
              requestedPerPage
            ),
            MAX_PAGE_SIZE
          )
        : DEFAULT_PAGE_SIZE;

    const dryRun =
      body.dryRun !== false;

    const categories =
      await loadCategories(
        supabase
      );

    const {
      posts,
      totalPages,
      totalPosts,
    } =
      await fetchWordPressPage(
        page,
        perPage
      );

    const prepared =
      posts
        .map((post) =>
          prepareArticle(
            post,
            categories
          )
        )
        .filter(
          (
            article
          ): article is PreparedArticle =>
            article !== null
        );

    if (dryRun) {
      return NextResponse.json({
        success: true,
        route:
          "migrate-wordpress",
        version: "1.0",
        dryRun: true,
        page,
        perPage,
        totalPages,
        totalPosts,
        preparedCount:
          prepared.length,
        categoryCount:
          categories.length,
        preview:
          prepared.map(
            (article) => ({
              wordpressId:
                article.wordpressId,
              title:
                article.title,
              slug:
                article.slug,
              publishedAt:
                article.publishedAt,
              categoryId:
                article.categoryId,
              categoryName:
                article.categoryName,
              featuredImageUrl:
                article.featuredImageUrl,
              wordCount:
                article.wordCount,
              seoTitle:
                article.seoTitle,
              metaDescription:
                article.metaDescription,
            })
          ),
      });
    }

    let imported = 0;
    let skippedExisting = 0;

    const errors: Array<{
      wordpressId: string;
      slug: string;
      error: string;
    }> = [];

    const importedArticles: Array<{
      wordpressId: string;
      articleId: string;
      slug: string;
      title: string;
    }> = [];

    for (
      const article of prepared
    ) {
      try {
        const {
          data:
            existingRows,
          error:
            existingError,
        } =
          await supabase
            .from("articles")
            .select(
              "id,slug,status"
            )
            .eq(
              "slug",
              article.slug
            )
            .limit(1);

        if (existingError) {
          throw new Error(
            existingError.message
          );
        }

        const existing =
          existingRows?.[0];

        if (existing?.id) {
          skippedExisting += 1;

          const {
            error:
              mappingError,
          } =
            await supabase
              .from(
                "seo_article_index"
              )
              .update({
                article_id:
                  existing.id,
              })
              .eq(
                "source",
                "wordpress"
              )
              .eq(
                "source_id",
                article.wordpressId
              );

          if (
            mappingError
          ) {
            throw new Error(
              `Existing article found, but inventory mapping failed: ${mappingError.message}`
            );
          }

          continue;
        }

        const {
          data:
            insertedRows,
          error:
            insertError,
        } =
          await supabase
            .from("articles")
            .insert({
              title:
                article.title,
              slug:
                article.slug,
              excerpt:
                article.excerpt,
              content:
                article.content,

              /*
               * Safe migration:
               * imported WordPress posts stay as drafts.
               * WordPress remains the public fallback until you publish
               * the migrated Supabase version.
               */
              status:
                "draft",

              seo_title:
                article.seoTitle,
              meta_description:
                article.metaDescription,
              focus_keyword:
                "",
              canonical_url:
                article.canonicalUrl,

              category_id:
                article.categoryId,

              featured_image_url:
                article.featuredImageUrl,
              featured_image_alt:
                article.featuredImageAlt,

              robots_index:
                true,
              robots_follow:
                true,

              word_count:
                article.wordCount,

              /*
               * Keep the original WordPress publication date for
               * migration history. Draft status prevents public takeover.
               */
              published_at:
                article.publishedAt,
            })
            .select(
              "id,slug,title"
            )
            .single();

        if (
          insertError ||
          !insertedRows?.id
        ) {
          throw new Error(
            insertError?.message ||
              "Article insert returned no ID."
          );
        }

        const articleId =
          String(
            insertedRows.id
          );

        const {
          error:
            mappingError,
        } =
          await supabase
            .from(
              "seo_article_index"
            )
            .update({
              article_id:
                articleId,
            })
            .eq(
              "source",
              "wordpress"
            )
            .eq(
              "source_id",
              article.wordpressId
            );

        if (
          mappingError
        ) {
          throw new Error(
            `Article imported, but inventory mapping failed: ${mappingError.message}`
          );
        }

        imported += 1;

        importedArticles.push({
          wordpressId:
            article.wordpressId,
          articleId,
          slug:
            article.slug,
          title:
            article.title,
        });
      } catch (error) {
        errors.push({
          wordpressId:
            article.wordpressId,
          slug:
            article.slug,
          error:
            error instanceof Error
              ? error.message
              : "Unknown migration error.",
        });
      }
    }

    return NextResponse.json({
      success:
        errors.length === 0,
      route:
        "migrate-wordpress",
      version: "1.0",
      dryRun: false,
      page,
      perPage,
      totalPages,
      totalPosts,
      preparedCount:
        prepared.length,
      imported,
      skippedExisting,
      errors,
      importedArticles,
      hasMore:
        page < totalPages,
      nextPage:
        page < totalPages
          ? page + 1
          : null,
    });
  } catch (error) {
    console.error(
      "WordPress migration error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route:
          "migrate-wordpress",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to migrate WordPress articles.",
      },
      {
        status: 500,
      }
    );
  }
}
