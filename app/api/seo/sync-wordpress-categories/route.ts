import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP_CATEGORIES_API =
  "https://cms.coinlytx.com/wp-json/wp/v2/categories";

type WpCategory = {
  id: number;
  name?: string;
  slug?: string;
  count?: number;
};

type SupabaseCategory = {
  id: string;
  name: string;
  slug: string;
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
    .replace(/&#8221;/gi, '"')
    .trim();
}

async function fetchAllWordPressCategories() {
  const all: WpCategory[] = [];
  let page = 1;

  while (true) {
    const url = new URL(WP_CATEGORIES_API);

    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");
    url.searchParams.set("hide_empty", "false");
    url.searchParams.set(
      "_fields",
      "id,name,slug,count"
    );

    const response = await fetch(
      url.toString(),
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "CoinlytxCategorySync/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `WordPress categories returned HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    const categories: WpCategory[] =
      Array.isArray(data)
        ? data
        : [];

    all.push(...categories);

    const totalPages = Number(
      response.headers.get(
        "x-wp-totalpages"
      ) || "1"
    );

    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  return all;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route:
      "sync-wordpress-categories",
    version: "1.0",
    message:
      "Coinlytx WordPress category sync route is active.",
  });
}

export async function POST() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

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

    const wpCategories =
      await fetchAllWordPressCategories();

    const {
      data: existingRows,
      error: existingError,
    } =
      await supabase
        .from("categories")
        .select("id,name,slug");

    if (existingError) {
      throw new Error(
        `Unable to read Supabase categories: ${existingError.message}`
      );
    }

    const existing =
      (existingRows ||
        []) as SupabaseCategory[];

    const existingBySlug =
      new Map(
        existing.map((category) => [
          category.slug
            .trim()
            .toLowerCase(),
          category,
        ])
      );

    const created: SupabaseCategory[] =
      [];

    const skipped: Array<{
      wordpressId: number;
      name: string;
      slug: string;
    }> = [];

    for (
      const wpCategory of
        wpCategories
    ) {
      const slug =
        typeof wpCategory.slug ===
        "string"
          ? wpCategory.slug
              .trim()
              .toLowerCase()
          : "";

      const name =
        typeof wpCategory.name ===
        "string"
          ? decodeHtml(
              wpCategory.name
            )
          : "";

      if (!slug || !name) {
        continue;
      }

      if (
        existingBySlug.has(
          slug
        )
      ) {
        skipped.push({
          wordpressId:
            wpCategory.id,
          name,
          slug,
        });

        continue;
      }

      const {
        data: inserted,
        error: insertError,
      } =
        await supabase
          .from("categories")
          .insert({
            name,
            slug,
          })
          .select(
            "id,name,slug"
          )
          .single();

      if (insertError) {
        throw new Error(
          `Unable to insert category "${name}": ${insertError.message}`
        );
      }

      const row =
        inserted as SupabaseCategory;

      created.push(row);

      existingBySlug.set(
        slug,
        row
      );
    }

    return NextResponse.json({
      success: true,
      route:
        "sync-wordpress-categories",
      version: "1.0",
      wordpressCategories:
        wpCategories.length,
      created:
        created.length,
      alreadyExisting:
        skipped.length,
      categories:
        created,
    });
  } catch (error) {
    console.error(
      "WordPress category sync error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        route:
          "sync-wordpress-categories",
        version: "1.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync WordPress categories.",
      },
      {
        status: 500,
      }
    );
  }
}
