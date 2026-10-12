import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InventoryRow = {
  article_id: string | null;
};

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
  status: string | null;
  category_id: string | null;
  featured_image_url: string | null;
  published_at: string | null;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function loadMappedWordPressIds(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const ids: string[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("seo_article_index")
      .select("article_id")
      .eq("source", "wordpress")
      .not("article_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to read migrated WordPress mappings: ${error.message}`
      );
    }

    const batch = (data || []) as InventoryRow[];

    for (const row of batch) {
      if (row.article_id) {
        ids.push(row.article_id);
      }
    }

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return [...new Set(ids)];
}

async function loadArticles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
) {
  const rows: ArticleRow[] = [];

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await supabase
      .from("articles")
      .select(
        `
        id,
        title,
        slug,
        content,
        status,
        category_id,
        featured_image_url,
        published_at
        `
      )
      .in("id", chunk);

    if (error) {
      throw new Error(
        `Unable to read migrated Supabase articles: ${error.message}`
      );
    }

    rows.push(...((data || []) as ArticleRow[]));
  }

  return rows;
}

function isCriticalReady(article: ArticleRow) {
  return Boolean(
    article.title?.trim() &&
      article.slug?.trim() &&
      article.content?.trim() &&
      article.published_at &&
      article.category_id
  );
}

function hasFeaturedImage(article: ArticleRow) {
  return Boolean(article.featured_image_url?.trim());
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "activate-migrated-articles",
    version: "1.0",
    message:
      "Coinlytx safe migrated-article activation route is active.",
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
      limit?: number;
      dryRun?: boolean;
    } = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedLimit = Number(body.limit || 20);
    const limit = Math.max(1, Math.min(50, requestedLimit));
    const dryRun = body.dryRun !== false;

    const mappedIds = await loadMappedWordPressIds(supabase);
    const articles = await loadArticles(supabase, mappedIds);

    const alreadyPublished = articles.filter(
      (article) => article.status === "published"
    );

    const drafts = articles.filter(
      (article) => article.status === "draft"
    );

    const blockedCritical = drafts.filter(
      (article) => !isCriticalReady(article)
    );

    const missingImage = drafts.filter(
      (article) =>
        isCriticalReady(article) &&
        !hasFeaturedImage(article)
    );

    const eligible = drafts.filter(
      (article) =>
        isCriticalReady(article) &&
        hasFeaturedImage(article)
    );

    const batch = eligible.slice(0, limit);
    const batchIds = batch.map((article) => article.id);

    if (!dryRun && batchIds.length > 0) {
      const { error: updateError } = await supabase
        .from("articles")
        .update({
          status: "published",
        })
        .in("id", batchIds)
        .eq("status", "draft");

      if (updateError) {
        throw new Error(
          `Unable to publish migrated articles: ${updateError.message}`
        );
      }
    }

    const publishedNow = dryRun ? 0 : batchIds.length;
    const remainingEligible = dryRun
      ? eligible.length
      : Math.max(0, eligible.length - publishedNow);

    return NextResponse.json({
      success: true,
      route: "activate-migrated-articles",
      version: "1.0",
      dryRun,
      safeMode: true,
      summary: {
        mappedWordPressArticles: mappedIds.length,
        articlesFound: articles.length,
        alreadyPublished: alreadyPublished.length,
        draftArticles: drafts.length,
        blockedCritical: blockedCritical.length,
        skippedMissingImage: missingImage.length,
        eligibleToPublish: eligible.length,
        publishedNow,
        remainingEligible,
      },
      publishedArticleIds: dryRun ? [] : batchIds,
      hasMore: remainingEligible > 0,
      message: dryRun
        ? "Dry run complete. Only critical-ready drafts with featured images are eligible."
        : remainingEligible > 0
          ? `Published ${publishedNow} safe migrated articles. More eligible drafts remain.`
          : `Published ${publishedNow} safe migrated articles. All safe eligible drafts are now activated.`,
    });
  } catch (error) {
    console.error("Activate migrated articles error:", error);

    return NextResponse.json(
      {
        success: false,
        route: "activate-migrated-articles",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to activate migrated articles.",
      },
      {
        status: 500,
      }
    );
  }
}
