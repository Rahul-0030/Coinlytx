import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
   AUTH HELPER
========================================================= */

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
    };
  }

  return {
    supabase,
    user,
  };
}

/* =========================================================
   GET ARTICLE
========================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const { supabase, user } =
      await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("articles")
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        content,
        content_format,
        status,
        seo_title,
        meta_description,
        focus_keyword,
        canonical_url,
        category_id,
        featured_image_url,
        featured_image_alt,
        robots_index,
        robots_follow,
        word_count,
        published_at,
        created_at,
        updated_at
        `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found.",
          details: error?.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      article: data,
    });
  } catch (error) {
    console.error("GET ARTICLE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load article.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH ARTICLE

   action:
   save     = save changes without changing publish status
   publish  = publish immediately
========================================================= */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const { supabase, user } =
      await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    /* =====================================================
       READ REQUEST
    ===================================================== */

    const action = String(
      body.action ?? "save"
    ).trim();

    const title = String(
      body.title ?? ""
    ).trim();

    const slug = String(
      body.slug ?? ""
    ).trim();

    const excerpt = String(
      body.excerpt ?? ""
    ).trim();

    const content = String(
      body.content ?? ""
    ).trim();

    const seoTitle = String(
      body.seoTitle ?? ""
    ).trim();

    const metaDescription = String(
      body.metaDescription ?? ""
    ).trim();

    const focusKeyword = String(
      body.focusKeyword ?? ""
    ).trim();

    const canonicalUrl = String(
      body.canonicalUrl ?? ""
    ).trim();

    // NEW: category + featured image
    const categoryId = String(
      body.categoryId ?? ""
    ).trim();

    const featuredImageUrl = String(
      body.featuredImageUrl ?? ""
    ).trim();

    const featuredImageAlt = String(
      body.featuredImageAlt ?? ""
    ).trim();

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "Article title is required.",
        },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: "Article slug is required.",
        },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: "Article content is required.",
        },
        { status: 400 }
      );
    }

    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Slug can contain lowercase letters, numbers and hyphens only.",
        },
        { status: 400 }
      );
    }

    if (
      action !== "save" &&
      action !== "publish"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid article action.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       WORD COUNT
    ===================================================== */

    const cleanContent = content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const wordCount = cleanContent
      ? cleanContent
          .split(" ")
          .filter(Boolean).length
      : 0;

    const finalCanonical =
      canonicalUrl ||
      `https://coinlytx.com/${slug}`;

    /* =====================================================
       CHECK CURRENT ARTICLE
    ===================================================== */

    const {
      data: existingArticle,
      error: existingError,
    } = await supabase
      .from("articles")
      .select(
        "id, status, published_at"
      )
      .eq("id", id)
      .single();

    if (
      existingError ||
      !existingArticle
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found.",
          details:
            existingError?.message,
        },
        { status: 404 }
      );
    }

    /* =====================================================
       BUILD UPDATE
    ===================================================== */

    const updateData: {
      title: string;
      slug: string;
      excerpt: string | null;
      content: string;

      seo_title: string | null;
      meta_description: string | null;
      focus_keyword: string | null;
      canonical_url: string;

      category_id: string | null;
      featured_image_url: string | null;
      featured_image_alt: string | null;

      word_count: number;
      updated_at: string;

      status?: string;
      published_at?: string | null;
      robots_index?: boolean;
      robots_follow?: boolean;
    } = {
      title,
      slug,
      excerpt: excerpt || null,
      content,

      seo_title:
        seoTitle || null,

      meta_description:
        metaDescription || null,

      focus_keyword:
        focusKeyword || null,

      canonical_url:
        finalCanonical,

      // NEW: save category and featured image
      category_id:
        categoryId || null,

      featured_image_url:
        featuredImageUrl || null,

      featured_image_alt:
        featuredImageAlt || null,

      word_count:
        wordCount,

      updated_at:
        new Date().toISOString(),
    };

    /* =====================================================
       PUBLISH
    ===================================================== */

    if (action === "publish") {
      updateData.status =
        "published";

      // Keep original publication date if already published
      updateData.published_at =
        existingArticle.published_at ||
        new Date().toISOString();

      updateData.robots_index = true;
      updateData.robots_follow = true;
    }

    /* =====================================================
       UPDATE SUPABASE
    ===================================================== */

    const { data, error } =
      await supabase
        .from("articles")
        .update(updateData)
        .eq("id", id)
        .select(
          `
          id,
          title,
          slug,
          excerpt,
          content,
          status,
          seo_title,
          meta_description,
          focus_keyword,
          canonical_url,
          category_id,
          featured_image_url,
          featured_image_alt,
          word_count,
          robots_index,
          robots_follow,
          published_at,
          created_at,
          updated_at
          `
        )
        .single();

    if (error) {
      console.error(
        "UPDATE ARTICLE ERROR:",
        error
      );

      if (error.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Another article already uses this URL slug.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to update article.",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    return NextResponse.json({
      success: true,

      message:
        action === "publish"
          ? "Article published successfully."
          : "Article updated successfully.",

      article: data,
    });
  } catch (error) {
    console.error(
      "ARTICLE PATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Article update failed.",

        details:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}