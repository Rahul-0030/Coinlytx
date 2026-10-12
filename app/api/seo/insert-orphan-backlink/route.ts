import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORBIDDEN_TAGS = new Set([
  "a",
  "script",
  "style",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

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

function normalizeHrefToSlug(value: string) {
  const href = value.trim();

  if (!href) return "";

  try {
    const url = new URL(
      href,
      "https://coinlytx.com"
    );

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      host !== "coinlytx.com" &&
      host !== "cms.coinlytx.com"
    ) {
      return "";
    }

    return normalizeSlug(url.pathname);
  } catch {
    return "";
  }
}

function hasExistingTargetLink(
  html: string,
  targetSlug: string
) {
  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const linkedSlug =
      normalizeHrefToSlug(
        match[1] || ""
      );

    if (linkedSlug === targetSlug) {
      return true;
    }
  }

  return false;
}

function countWords(html: string) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  return text
    ? text.split(/\s+/).filter(Boolean).length
    : 0;
}

function insertAnchorSafely(
  html: string,
  anchor: string,
  href: string
) {
  const cleanAnchor = anchor.trim();

  if (!cleanAnchor) {
    return {
      success: false,
      html,
      matchedText: "",
    };
  }

  const parts = html.split(/(<[^>]+>)/g);
  const stack: string[] = [];
  const target = cleanAnchor.toLocaleLowerCase();

  for (
    let index = 0;
    index < parts.length;
    index += 1
  ) {
    const part = parts[index];

    if (
      part.startsWith("<") &&
      part.endsWith(">")
    ) {
      const closing =
        part.match(
          /^<\s*\/\s*([a-z0-9]+)/i
        );

      if (closing) {
        const tag =
          closing[1].toLowerCase();

        for (
          let stackIndex =
            stack.length - 1;
          stackIndex >= 0;
          stackIndex -= 1
        ) {
          if (
            stack[stackIndex] === tag
          ) {
            stack.splice(
              stackIndex,
              1
            );
            break;
          }
        }

        continue;
      }

      const opening =
        part.match(
          /^<\s*([a-z0-9]+)/i
        );

      if (!opening) {
        continue;
      }

      const tag =
        opening[1].toLowerCase();

      const selfClosing =
        /\/\s*>$/.test(part) ||
        [
          "img",
          "br",
          "hr",
          "meta",
          "link",
          "input",
          "source",
        ].includes(tag);

      if (!selfClosing) {
        stack.push(tag);
      }

      continue;
    }

    const blocked =
      stack.some(
        (tag) =>
          FORBIDDEN_TAGS.has(tag)
      );

    if (blocked || !part) {
      continue;
    }

    const lower =
      part.toLocaleLowerCase();

    const position =
      lower.indexOf(target);

    if (position < 0) {
      continue;
    }

    const matchedText =
      part.slice(
        position,
        position +
          cleanAnchor.length
      );

    parts[index] =
      part.slice(0, position) +
      `<a href="${href}">${matchedText}</a>` +
      part.slice(
        position +
          cleanAnchor.length
      );

    return {
      success: true,
      html: parts.join(""),
      matchedText,
    };
  }

  return {
    success: false,
    html,
    matchedText: "",
  };
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route:
      "insert-orphan-backlink",
    version: "1.0",
    message:
      "Coinlytx orphan backlink insertion route is active.",
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
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    let body: {
      sourceArticleId?: string;
      targetSlug?: string;
      anchor?: string;
    } = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const sourceArticleId =
      String(
        body.sourceArticleId || ""
      ).trim();

    const targetSlug =
      normalizeSlug(
        body.targetSlug || ""
      );

    const anchor =
      String(
        body.anchor || ""
      ).trim();

    if (
      !sourceArticleId ||
      !targetSlug ||
      !anchor
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "sourceArticleId, targetSlug and anchor are required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: sourceArticle,
      error: sourceError,
    } =
      await supabase
        .from("articles")
        .select(
          "id,title,slug,content,status"
        )
        .eq(
          "id",
          sourceArticleId
        )
        .single();

    if (
      sourceError ||
      !sourceArticle
    ) {
      throw new Error(
        sourceError?.message ||
          "Source article was not found."
      );
    }

    const sourceSlug =
      normalizeSlug(
        sourceArticle.slug || ""
      );

    if (
      sourceSlug === targetSlug
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An article cannot link to itself.",
        },
        {
          status: 400,
        }
      );
    }

    const html =
      typeof sourceArticle.content ===
        "string"
        ? sourceArticle.content
        : "";

    if (
      hasExistingTargetLink(
        html,
        targetSlug
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          error:
            "This source article already links to the target article.",
        },
        {
          status: 409,
        }
      );
    }

    const href =
      `/${targetSlug}`;

    const insertion =
      insertAnchorSafely(
        html,
        anchor,
        href
      );

    if (!insertion.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The suggested anchor was not found in a safe body-text position. Choose another recommendation or anchor.",
        },
        {
          status: 422,
        }
      );
    }

    const {
      error: updateError,
    } =
      await supabase
        .from("articles")
        .update({
          content:
            insertion.html,
          word_count:
            countWords(
              insertion.html
            ),
        })
        .eq(
          "id",
          sourceArticleId
        );

    if (updateError) {
      throw new Error(
        `Unable to update source article: ${updateError.message}`
      );
    }

    /*
     * Add the discovered edge immediately.
     * A full Scan Incoming Links can still be run later to fully
     * recalculate all coverage numbers.
     */
    const {
      error: graphError,
    } =
      await supabase
        .from(
          "seo_internal_link_graph"
        )
        .upsert(
          {
            source_system:
              "supabase",
            source_id:
              sourceArticleId,
            source_slug:
              sourceSlug,
            target_slug:
              targetSlug,
            anchor_text:
              insertion.matchedText,
            href,
          },
          {
            onConflict:
              "source_system,source_id,target_slug,anchor_text,href",
            ignoreDuplicates:
              true,
          }
        );

    if (graphError) {
      console.warn(
        "Article updated, but graph edge could not be written:",
        graphError.message
      );
    }

    return NextResponse.json({
      success: true,
      route:
        "insert-orphan-backlink",
      version: "1.0",
      source: {
        articleId:
          sourceArticleId,
        title:
          sourceArticle.title,
        slug:
          sourceArticle.slug,
        status:
          sourceArticle.status,
      },
      target: {
        slug:
          targetSlug,
        href,
      },
      anchor:
        insertion.matchedText,
      message:
        "Backlink inserted into the source article. Save is complete in Supabase.",
    });
  } catch (error) {
    console.error(
      "Insert orphan backlink error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route:
          "insert-orphan-backlink",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to insert orphan backlink.",
      },
      {
        status: 500,
      }
    );
  }
}
