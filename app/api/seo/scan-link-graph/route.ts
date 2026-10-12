import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP_API =
  "https://cms.coinlytx.com/wp-json/wp/v2/posts";

const WP_PAGE_SIZE = 50;
const WP_TIMEOUT_MS = 30000;

type SourceSystem =
  | "supabase"
  | "wordpress";

type GraphEdge = {
  source_system: SourceSystem;
  source_id: string;
  source_slug: string;
  target_slug: string;
  anchor_text: string;
  href: string;
};

type InventoryRow = {
  id: string;
  source: SourceSystem;
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
  created_at?: string | null;
  updated_at: string | null;
};

type WordPressPost = {
  id: number | string;
  slug?: string;
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
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSlug(value: string) {
  return decodeURIComponent(value)
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function getInternalTargetSlug(
  rawHref: string
) {
  const href =
    decodeHtml(rawHref).trim();

  if (!href) return "";

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return "";
  }

  try {
    const parsed =
      href.startsWith("/")
        ? new URL(
            href,
            "https://coinlytx.com"
          )
        : new URL(href);

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (
      hostname !== "coinlytx.com" &&
      hostname !== "cms.coinlytx.com"
    ) {
      return "";
    }

    const pathname =
      parsed.pathname
        .split("#")[0]
        .split("?")[0];

    const slug =
      normalizeSlug(pathname);

    if (!slug) return "";

    return slug;
  } catch {
    return "";
  }
}

function extractInternalEdges(
  html: string,
  sourceSystem: SourceSystem,
  sourceId: string,
  sourceSlug: string
) {
  const edges: GraphEdge[] = [];

  const anchorRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      anchorRegex.exec(html)) !==
    null
  ) {
    const href =
      match[1]?.trim() || "";

    const targetSlug =
      getInternalTargetSlug(href);

    if (!targetSlug) {
      continue;
    }

    if (
      targetSlug ===
      normalizeSlug(sourceSlug)
    ) {
      continue;
    }

    const anchorText =
      stripHtml(match[2] || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

    edges.push({
      source_system:
        sourceSystem,
      source_id:
        sourceId,
      source_slug:
        normalizeSlug(sourceSlug),
      target_slug:
        targetSlug,
      anchor_text:
        anchorText,
      href:
        href.slice(0, 2000),
    });
  }

  const deduped =
    new Map<
      string,
      GraphEdge
    >();

  for (const edge of edges) {
    const key = [
      edge.source_system,
      edge.source_id,
      edge.target_slug,
      edge.anchor_text,
      edge.href,
    ].join("::");

    if (!deduped.has(key)) {
      deduped.set(
        key,
        edge
      );
    }
  }

  return Array.from(
    deduped.values()
  );
}

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

async function insertEdges(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  edges: GraphEdge[]
) {
  if (!edges.length) {
    return 0;
  }

  let inserted = 0;

  for (
    const chunk of
      chunkArray(edges, 250)
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          "seo_internal_link_graph"
        )
        .upsert(
          chunk,
          {
            onConflict:
              "source_system,source_id,target_slug,anchor_text,href",
            ignoreDuplicates:
              true,
          }
        );

    if (error) {
      throw new Error(
        `Unable to save internal-link graph: ${error.message}`
      );
    }

    inserted +=
      chunk.length;
  }

  return inserted;
}

async function resetGraph(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const {
    error,
  } =
    await supabase
      .from(
        "seo_internal_link_graph"
      )
      .delete()
      .in(
        "source_system",
        [
          "supabase",
          "wordpress",
        ]
      );

  if (error) {
    throw new Error(
      `Unable to reset internal-link graph: ${error.message}`
    );
  }
}

async function scanSupabaseArticles(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const pageSize = 250;
  let from = 0;

  let articleCount = 0;
  let edgeCount = 0;

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .from("articles")
        .select(
          `
          id,
          slug,
          content
          `
        )
        .eq(
          "status",
          "published"
        )
        .not(
          "slug",
          "is",
          null
        )
        .range(
          from,
          from +
            pageSize -
            1
        );

    if (error) {
      throw new Error(
        `Unable to scan Supabase articles: ${error.message}`
      );
    }

    const articles =
      data || [];

    for (
      const article of
        articles
    ) {
      const slug =
        typeof article.slug ===
        "string"
          ? article.slug.trim()
          : "";

      if (!slug) {
        continue;
      }

      const html =
        typeof article.content ===
        "string"
          ? article.content
          : "";

      const edges =
        extractInternalEdges(
          html,
          "supabase",
          String(article.id),
          slug
        );

      edgeCount +=
        await insertEdges(
          supabase,
          edges
        );

      articleCount += 1;
    }

    if (
      articles.length <
      pageSize
    ) {
      break;
    }

    from +=
      pageSize;
  }

  return {
    articleCount,
    edgeCount,
  };
}

async function fetchWordPressPage(
  page: number
) {
  const url =
    new URL(WP_API);

  url.searchParams.set(
    "page",
    String(page)
  );

  url.searchParams.set(
    "per_page",
    String(WP_PAGE_SIZE)
  );

  url.searchParams.set(
    "status",
    "publish"
  );

  url.searchParams.set(
    "_fields",
    "id,slug,content"
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
              "CoinlytxLinkGraph/1.0",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `WordPress returned HTTP ${response.status}.`
      );
    }

    const raw =
      await response.json();

    const posts:
      WordPressPost[] =
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
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        `WordPress page ${page} took longer than ${
          WP_TIMEOUT_MS /
          1000
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

async function scanWordPressPage(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  page: number
) {
  const {
    posts,
    totalPages,
    totalPosts,
  } =
    await fetchWordPressPage(
      page
    );

  let edgeCount = 0;
  let articleCount = 0;

  for (
    const post of posts
  ) {
    const slug =
      typeof post.slug ===
      "string"
        ? post.slug.trim()
        : "";

    if (!slug) {
      continue;
    }

    const html =
      typeof post.content
        ?.rendered ===
      "string"
        ? post.content
            .rendered
        : "";

    const edges =
      extractInternalEdges(
        html,
        "wordpress",
        String(post.id),
        slug
      );

    edgeCount +=
      await insertEdges(
        supabase,
        edges
      );

    articleCount += 1;
  }

  return {
    articleCount,
    edgeCount,
    totalPages,
    totalPosts,
  };
}

async function loadAllInventoryRows(
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
          created_at,
          updated_at
          `
        )
        .range(
          from,
          from +
            pageSize -
            1
        );

    if (error) {
      throw new Error(
        `Unable to read article inventory: ${error.message}`
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

async function loadAllGraphEdges(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const rows:
    GraphEdge[] = [];

  const pageSize = 1000;
  let from = 0;

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "seo_internal_link_graph"
        )
        .select(
          `
          source_system,
          source_id,
          source_slug,
          target_slug,
          anchor_text,
          href
          `
        )
        .range(
          from,
          from +
            pageSize -
            1
        );

    if (error) {
      throw new Error(
        `Unable to read internal-link graph: ${error.message}`
      );
    }

    const batch =
      (data ||
        []) as GraphEdge[];

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

function calculateCoverageScore(
  incoming: number,
  outgoing: number
) {
  const incomingPart =
    Math.min(
      incoming,
      2
    ) /
    2 *
    60;

  const outgoingPart =
    Math.min(
      outgoing,
      3
    ) /
    3 *
    40;

  return Math.round(
    incomingPart +
      outgoingPart
  );
}

async function finalizeGraph(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const [
    inventory,
    graph,
  ] =
    await Promise.all([
      loadAllInventoryRows(
        supabase
      ),
      loadAllGraphEdges(
        supabase
      ),
    ]);

  const knownSlugs =
    new Set(
      inventory.map(
        (row) =>
          normalizeSlug(
            row.slug
          )
      )
    );

  const incomingSources =
    new Map<
      string,
      Set<string>
    >();

  const outgoingTargets =
    new Map<
      string,
      Set<string>
    >();

  for (
    const edge of graph
  ) {
    const sourceSlug =
      normalizeSlug(
        edge.source_slug
      );

    const targetSlug =
      normalizeSlug(
        edge.target_slug
      );

    if (
      !sourceSlug ||
      !targetSlug
    ) {
      continue;
    }

    if (
      !knownSlugs.has(
        targetSlug
      )
    ) {
      continue;
    }

    if (
      !incomingSources.has(
        targetSlug
      )
    ) {
      incomingSources.set(
        targetSlug,
        new Set()
      );
    }

    incomingSources
      .get(targetSlug)!
      .add(sourceSlug);

    if (
      !outgoingTargets.has(
        sourceSlug
      )
    ) {
      outgoingTargets.set(
        sourceSlug,
        new Set()
      );
    }

    outgoingTargets
      .get(sourceSlug)!
      .add(targetSlug);
  }

  const now =
    new Date()
      .toISOString();

  const updatedRows =
    inventory.map(
      (row) => {
        const slug =
          normalizeSlug(
            row.slug
          );

        const incoming =
          incomingSources.get(
            slug
          )?.size || 0;

        const outgoing =
          outgoingTargets.get(
            slug
          )?.size || 0;

        return {
          source:
            row.source,
          source_id:
            row.source_id,
          article_id:
            row.article_id,
          title:
            row.title,
          slug:
            row.slug,
          url:
            row.url,
          status:
            row.status ||
            "published",
          category:
            row.category,
          word_count:
            row.word_count ||
            0,
          outgoing_internal_links:
            outgoing,
          incoming_internal_links:
            incoming,
          internal_link_score:
            calculateCoverageScore(
              incoming,
              outgoing
            ),
          is_orphan:
            incoming === 0,
          processed:
            row.processed ===
            true,
          last_analyzed_at:
            now,
          updated_at:
            now,
        };
      }
    );

  for (
    const chunk of
      chunkArray(
        updatedRows,
        200
      )
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          "seo_article_index"
        )
        .upsert(
          chunk,
          {
            onConflict:
              "source,source_id",
          }
        );

    if (error) {
      throw new Error(
        `Unable to update incoming-link counts: ${error.message}`
      );
    }
  }

  const uniqueBySlug =
    new Map<
      string,
      {
        incoming: number;
        outgoing: number;
      }
    >();

  for (
    const row of updatedRows
  ) {
    const slug =
      normalizeSlug(
        row.slug
      );

    const current =
      uniqueBySlug.get(
        slug
      );

    if (
      !current ||
      row.source ===
        "supabase"
    ) {
      uniqueBySlug.set(
        slug,
        {
          incoming:
            row.incoming_internal_links,
          outgoing:
            row.outgoing_internal_links,
        }
      );
    }
  }

  const uniqueStats =
    Array.from(
      uniqueBySlug.values()
    );

  const orphanCount =
    uniqueStats.filter(
      (row) =>
        row.incoming === 0
    ).length;

  const weakCount =
    uniqueStats.filter(
      (row) =>
        row.incoming > 0 &&
        (
          row.incoming < 2 ||
          row.outgoing < 2
        )
    ).length;

  const healthyCount =
    uniqueStats.filter(
      (row) =>
        row.incoming >= 2 &&
        row.outgoing >= 2
    ).length;

  return {
    graphEdges:
      graph.length,
    uniqueArticles:
      uniqueStats.length,
    orphanCount,
    weakCount,
    healthyCount,
  };
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route:
      "scan-link-graph",
    version: "1.0",
    wordpressBatchSize:
      WP_PAGE_SIZE,
    phases: [
      "reset",
      "scan",
      "finalize",
    ],
    message:
      "Coinlytx incoming-link graph scanner is active.",
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
      phase?:
        | "reset"
        | "scan"
        | "finalize";
      wpPage?: number;
    } = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const phase =
      body.phase ||
      "scan";

    if (
      phase ===
      "reset"
    ) {
      await resetGraph(
        supabase
      );

      const supabaseScan =
        await scanSupabaseArticles(
          supabase
        );

      return NextResponse.json({
        success: true,
        route:
          "scan-link-graph",
        version: "1.0",
        phase:
          "reset",
        graphReset:
          true,
        supabase:
          supabaseScan,
      });
    }

    if (
      phase ===
      "finalize"
    ) {
      const summary =
        await finalizeGraph(
          supabase
        );

      return NextResponse.json({
        success: true,
        route:
          "scan-link-graph",
        version: "1.0",
        phase:
          "finalize",
        summary,
      });
    }

    const requestedPage =
      Number(
        body.wpPage || 1
      );

    const wpPage =
      Number.isFinite(
        requestedPage
      ) &&
      requestedPage >= 1
        ? Math.floor(
            requestedPage
          )
        : 1;

    const result =
      await scanWordPressPage(
        supabase,
        wpPage
      );

    const hasMore =
      wpPage <
      result.totalPages;

    return NextResponse.json({
      success: true,
      route:
        "scan-link-graph",
      version: "1.0",
      phase:
        "scan",
      wordpress: {
        currentPage:
          wpPage,
        scanned:
          result.articleCount,
        edgesFound:
          result.edgeCount,
        totalPosts:
          result.totalPosts,
        totalPages:
          result.totalPages,
        hasMore,
        nextPage:
          hasMore
            ? wpPage + 1
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Internal link graph scan error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route:
          "scan-link-graph",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to scan internal-link graph.",
      },
      {
        status: 500,
      }
    );
  }
}
