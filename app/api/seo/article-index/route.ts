import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArticleIndexRow = {
  id: string;
  source: "supabase" | "wordpress";
  source_id: string;
  article_id: string | null;
  title: string;
  slug: string;
  url: string;
  status: string | null;
  category: string | null;
  word_count: number | null;
  outgoing_internal_links: number | null;
  incoming_internal_links: number | null;
  internal_link_score: number | null;
  is_orphan: boolean | null;
  processed: boolean | null;
  last_analyzed_at: string | null;
  updated_at: string | null;
};

async function loadAllRows(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const rows: ArticleIndexRow[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("seo_article_index")
      .select(
        `
        id,
        source,
        source_id,
        article_id,
        title,
        slug,
        url,
        status,
        category,
        word_count,
        outgoing_internal_links,
        incoming_internal_links,
        internal_link_score,
        is_orphan,
        processed,
        last_analyzed_at,
        updated_at
        `
      )
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Unable to read SEO article index: ${error.message}`
      );
    }

    const batch = (data || []) as ArticleIndexRow[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

function dedupeBySlug(rows: ArticleIndexRow[]) {
  const map = new Map<string, ArticleIndexRow>();

  for (const row of rows) {
    const key = row.slug.trim().toLowerCase();

    if (!key) continue;

    const current = map.get(key);

    if (!current) {
      map.set(key, row);
      continue;
    }

    // Prefer Supabase when the same slug exists in both systems.
    if (
      current.source === "wordpress" &&
      row.source === "supabase"
    ) {
      map.set(key, row);
    }
  }

  return Array.from(map.values());
}

export async function GET(request: NextRequest) {
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

    const allRows = await loadAllRows(supabase);
    const uniqueRows = dedupeBySlug(allRows);

    const wordpressRecords = allRows.filter(
      (row) => row.source === "wordpress"
    ).length;

    const supabaseRecords = allRows.filter(
      (row) => row.source === "supabase"
    ).length;

    const processed = uniqueRows.filter(
      (row) => row.processed === true
    ).length;

    const analyzed = uniqueRows.filter(
      (row) => Boolean(row.last_analyzed_at)
    ).length;

    const incomingScanComplete =
      uniqueRows.length > 0 &&
      analyzed === uniqueRows.length;

    const orphanCount = uniqueRows.filter(
      (row) =>
        Boolean(row.last_analyzed_at) &&
        (row.incoming_internal_links || 0) === 0
    ).length;

    const weakCount = uniqueRows.filter((row) => {
      if (!row.last_analyzed_at) return false;

      const incoming =
        row.incoming_internal_links || 0;

      const outgoing =
        row.outgoing_internal_links || 0;

      return (
        incoming > 0 &&
        (incoming < 2 || outgoing < 2)
      );
    }).length;

    const healthyCount = uniqueRows.filter((row) => {
      if (!row.last_analyzed_at) return false;

      const incoming =
        row.incoming_internal_links || 0;

      const outgoing =
        row.outgoing_internal_links || 0;

      return incoming >= 2 && outgoing >= 2;
    }).length;

    const withOutgoingLinks = uniqueRows.filter(
      (row) => (row.outgoing_internal_links || 0) > 0
    ).length;

    const withoutOutgoingLinks = uniqueRows.filter(
      (row) => (row.outgoing_internal_links || 0) === 0
    ).length;

    const duplicateSourceRecords = Math.max(
      0,
      allRows.length - uniqueRows.length
    );

    const limitRaw = Number(
      request.nextUrl.searchParams.get("limit") || "100"
    );

    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 500)
        : 100;

    const queue = [...uniqueRows]
      .sort((a, b) => {
        const aProcessed = a.processed ? 1 : 0;
        const bProcessed = b.processed ? 1 : 0;

        if (aProcessed !== bProcessed) {
          return aProcessed - bProcessed;
        }

        const priority = (row: ArticleIndexRow) => {
          if (!row.last_analyzed_at) return 3;

          const incoming =
            row.incoming_internal_links || 0;

          const outgoing =
            row.outgoing_internal_links || 0;

          if (incoming === 0) return 0;

          if (incoming < 2 || outgoing < 2) {
            return 1;
          }

          return 2;
        };

        const aPriority = priority(a);
        const bPriority = priority(b);

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        const aOutgoing =
          a.outgoing_internal_links || 0;

        const bOutgoing =
          b.outgoing_internal_links || 0;

        if (aOutgoing !== bOutgoing) {
          return aOutgoing - bOutgoing;
        }

        return a.title.localeCompare(b.title);
      })
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        source: row.source,
        sourceId: row.source_id,
        articleId: row.article_id,
        title: row.title,
        slug: row.slug,
        url: row.url,
        category: row.category,
        wordCount: row.word_count || 0,
        outgoingInternalLinks:
          row.outgoing_internal_links || 0,
        incomingInternalLinks:
          row.incoming_internal_links || 0,
        internalLinkScore:
          row.internal_link_score || 0,
        isOrphan:
          Boolean(row.last_analyzed_at) &&
          (row.incoming_internal_links || 0) === 0,
        coverageStatus:
          !row.last_analyzed_at
            ? "pending"
            : (row.incoming_internal_links || 0) === 0
              ? "orphan"
              : (row.incoming_internal_links || 0) < 2 ||
                  (row.outgoing_internal_links || 0) < 2
                ? "weak"
                : "healthy",
        processed: row.processed === true,
        lastAnalyzedAt: row.last_analyzed_at,
      }));

    return NextResponse.json({
      success: true,
      route: "article-index",
      version: "3.0",
      stats: {
        sourceRecords: allRows.length,
        uniqueArticles: uniqueRows.length,
        wordpressRecords,
        supabaseRecords,
        duplicateSourceRecords,
        processed,
        remaining: Math.max(
          0,
          uniqueRows.length - processed
        ),
        withOutgoingLinks,
        withoutOutgoingLinks,
        analyzed,
        incomingScanComplete,
        orphanCount,
        weakCount,
        healthyCount,
      },
      queue,
      incomingLinkScanReady: incomingScanComplete,
      message: incomingScanComplete
        ? "Incoming-link scan complete. Orphan, weak and healthy article status is now available."
        : "Article inventory is synced. Run Scan Incoming Links to calculate true orphan pages.",
    });
  } catch (error) {
    console.error(
      "SEO article index dashboard error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route: "article-index",
        version: "3.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to load interlink dashboard.",
      },
      {
        status: 500,
      }
    );
  }
}
