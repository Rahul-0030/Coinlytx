import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getWordCount(html: string) {
  const cleanContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanContent
    ? cleanContent.split(/\s+/).filter(Boolean).length
    : 0;
}

export async function GET(_request: NextRequest) {
  try {
    const { supabase, user } =
      await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("articles")
      .select(`
        id,
        title,
        slug,
        excerpt,
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
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("GET ARTICLES ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load articles.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      articles: data ?? [],
      count: data?.length ?? 0,
    });
  } catch (error) {
    console.error("GET ARTICLES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load articles.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } =
      await getAuthenticatedSupabase();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const action = String(body.action ?? "save").trim();
    const title = String(body.title ?? "").trim();
    const rawSlug = String(body.slug ?? "").trim();
    const slug = cleanSlug(rawSlug);
    const excerpt = String(body.excerpt ?? "").trim();
    const content = String(body.content ?? "").trim();
    const seoTitle = String(body.seoTitle ?? "").trim();
    const metaDescription = String(
      body.metaDescription ?? ""
    ).trim();
    const focusKeyword = String(
      body.focusKeyword ?? ""
    ).trim();
    const canonicalUrl = String(
      body.canonicalUrl ?? ""
    ).trim();
    const categoryId = String(
      body.categoryId ?? ""
    ).trim();
    const featuredImageUrl = String(
      body.featuredImageUrl ?? ""
    ).trim();
    const featuredImageAlt = String(
      body.featuredImageAlt ?? ""
    ).trim();

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

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Slug can contain lowercase letters, numbers and hyphens only.",
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

    if (action !== "save" && action !== "publish") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid article action.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const wordCount = getWordCount(content);
    const finalCanonical =
      canonicalUrl || `https://coinlytx.com/${slug}`;
    const isPublishing = action === "publish";

    const insertData = {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      status: isPublishing ? "published" : "draft",
      seo_title: seoTitle || null,
      meta_description: metaDescription || null,
      focus_keyword: focusKeyword || null,
      canonical_url: finalCanonical,
      category_id: categoryId || null,
      featured_image_url: featuredImageUrl || null,
      featured_image_alt: featuredImageAlt || null,
      word_count: wordCount,
      robots_index: isPublishing,
      robots_follow: isPublishing,
      published_at: isPublishing ? now : null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("articles")
      .insert(insertData)
      .select(`
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
        robots_index,
        robots_follow,
        word_count,
        published_at,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error("CREATE ARTICLE ERROR:", error);

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
          error: "Unable to create article.",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: isPublishing
          ? "Article published successfully."
          : "Draft created successfully.",
        article: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ARTICLE CREATE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Article creation failed.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}
