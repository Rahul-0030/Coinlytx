import { createClient } from "@supabase/supabase-js";

export type SupabaseArticleCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SupabaseArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: string;

  seo_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  canonical_url: string | null;

  category_id: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: SupabaseArticleCategory | null;

  robots_index: boolean | null;
  robots_follow: boolean | null;

  word_count: number | null;

  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getPublishedArticleBySlug(
  slug: string
): Promise<SupabaseArticle | null> {
  try {
    const supabase = getPublicSupabase();

    const { data, error } = await supabase
      .from("articles")
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
        robots_index,
        robots_follow,
        word_count,
        published_at,
        created_at,
        updated_at,
        category:categories (
          id,
          name,
          slug
        )
        `
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("SUPABASE PUBLIC ARTICLE ERROR:", error);
      return null;
    }

    if (!data) return null;

    const raw = data as any;

    return {
      ...raw,
      category: Array.isArray(raw.category)
        ? raw.category[0] ?? null
        : raw.category ?? null,
    } as SupabaseArticle;
  } catch (error) {
    console.error("SUPABASE ARTICLE FETCH FAILED:", error);
    return null;
  }
}
