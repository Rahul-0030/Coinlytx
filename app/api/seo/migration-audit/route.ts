import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InventoryRow = {
  source_id: string;
  article_id: string | null;
  title: string;
  slug: string;
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

type Issue = {
  type:
    | "unmapped"
    | "missing_article"
    | "slug_mismatch"
    | "empty_title"
    | "empty_content"
    | "missing_category"
    | "missing_image"
    | "missing_published_at"
    | "unexpected_status";
  wordpressId: string;
  articleId?: string | null;
  slug: string;
  detail: string;
};

function chunkArray<T>(
  items: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    chunks.push(
      items.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

async function loadAllWordPressInventory(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const rows:
    InventoryRow[] = [];

  const pageSize = 500;
  let from = 0;

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "seo_article_index"
        )
        .select(
          `
          source_id,
          article_id,
          title,
          slug
          `
        )
        .eq(
          "source",
          "wordpress"
        )
        .range(
          from,
          from +
            pageSize -
            1
        );

    if (error) {
      throw new Error(
        `Unable to read WordPress inventory: ${error.message}`
      );
    }

    const batch =
      (data ||
        []) as InventoryRow[];

    rows.push(
      ...batch
    );

    if (
      batch.length <
      pageSize
    ) {
      break;
    }

    from +=
      pageSize;
  }

  return rows;
}

async function loadArticlesByIds(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  ids: string[]
) {
  const rows:
    ArticleRow[] = [];

  for (
    const chunk of
      chunkArray(ids, 200)
  ) {
    const {
      data,
      error,
    } =
      await supabase
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
        .in(
          "id",
          chunk
        );

    if (error) {
      throw new Error(
        `Unable to read migrated articles: ${error.message}`
      );
    }

    rows.push(
      ...((data ||
        []) as ArticleRow[])
    );
  }

  return rows;
}

export async function GET() {
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

    const inventory =
      await loadAllWordPressInventory(
        supabase
      );

    const mapped =
      inventory.filter(
        (row) =>
          Boolean(
            row.article_id
          )
      );

    const unmapped =
      inventory.filter(
        (row) =>
          !row.article_id
      );

    const articleIds =
      mapped
        .map(
          (row) =>
            row.article_id
        )
        .filter(
          (
            id
          ): id is string =>
            Boolean(id)
        );

    const articles =
      await loadArticlesByIds(
        supabase,
        articleIds
      );

    const articleMap =
      new Map(
        articles.map(
          (article) => [
            article.id,
            article,
          ]
        )
      );

    const issues:
      Issue[] = [];

    for (
      const row of unmapped
    ) {
      issues.push({
        type:
          "unmapped",
        wordpressId:
          row.source_id,
        articleId:
          null,
        slug:
          row.slug,
        detail:
          "WordPress inventory row has no Supabase article_id mapping.",
      });
    }

    let slugMismatch = 0;
    let emptyTitle = 0;
    let emptyContent = 0;
    let missingCategory = 0;
    let missingImage = 0;
    let missingPublishedAt = 0;
    let unexpectedStatus = 0;
    let missingArticleRows = 0;

    for (
      const row of mapped
    ) {
      const article =
        row.article_id
          ? articleMap.get(
              row.article_id
            )
          : undefined;

      if (!article) {
        missingArticleRows += 1;

        issues.push({
          type:
            "missing_article",
          wordpressId:
            row.source_id,
          articleId:
            row.article_id,
          slug:
            row.slug,
          detail:
            "Mapped Supabase article row was not found.",
        });

        continue;
      }

      const expectedSlug =
        row.slug.trim();

      const actualSlug =
        (
          article.slug ||
          ""
        ).trim();

      if (
        expectedSlug !==
        actualSlug
      ) {
        slugMismatch += 1;

        issues.push({
          type:
            "slug_mismatch",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            `Inventory slug "${expectedSlug}" does not match migrated slug "${actualSlug}".`,
        });
      }

      if (
        !article.title?.trim()
      ) {
        emptyTitle += 1;

        issues.push({
          type:
            "empty_title",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            "Migrated article title is empty.",
        });
      }

      if (
        !article.content?.trim()
      ) {
        emptyContent += 1;

        issues.push({
          type:
            "empty_content",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            "Migrated article content is empty.",
        });
      }

      if (
        !article.category_id
      ) {
        missingCategory += 1;

        issues.push({
          type:
            "missing_category",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            "No Supabase category is assigned.",
        });
      }

      if (
        !article
          .featured_image_url
          ?.trim()
      ) {
        missingImage += 1;

        issues.push({
          type:
            "missing_image",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            "Featured image is missing.",
        });
      }

      if (
        !article.published_at
      ) {
        missingPublishedAt +=
          1;

        issues.push({
          type:
            "missing_published_at",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            "Original publication date is missing.",
        });
      }

      if (
        article.status !==
        "draft"
      ) {
        unexpectedStatus +=
          1;

        issues.push({
          type:
            "unexpected_status",
          wordpressId:
            row.source_id,
          articleId:
            article.id,
          slug:
            row.slug,
          detail:
            `Expected draft status before activation, found "${article.status}".`,
        });
      }
    }

    const blockers =
      unmapped.length +
      missingArticleRows +
      slugMismatch +
      emptyTitle +
      emptyContent;

    const warnings =
      missingCategory +
      missingImage +
      missingPublishedAt +
      unexpectedStatus;

    return NextResponse.json({
      success: true,
      route:
        "migration-audit",
      version: "1.0",
      readyToActivate:
        blockers === 0,
      summary: {
        wordpressInventory:
          inventory.length,
        mappedToSupabase:
          mapped.length,
        unmapped:
          unmapped.length,
        migratedArticlesFound:
          articles.length,
        blockers,
        warnings,
      },
      blockers: {
        missingArticleRows,
        slugMismatch,
        emptyTitle,
        emptyContent,
      },
      warnings: {
        missingCategory,
        missingImage,
        missingPublishedAt,
        unexpectedStatus,
      },
      sampleIssues:
        issues.slice(0, 50),
      message:
        blockers === 0
          ? "Migration audit passed critical checks. Review warnings before activating migrated articles."
          : "Migration audit found critical blockers. Do not bulk-publish migrated articles yet.",
    });
  } catch (error) {
    console.error(
      "Migration audit error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route:
          "migration-audit",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to audit migrated articles.",
      },
      {
        status: 500,
      }
    );
  }
}
