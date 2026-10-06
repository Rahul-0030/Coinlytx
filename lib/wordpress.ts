/* =========================================================
   COINLYTX WORDPRESS API
   Existing WordPress:
   https://coinlytx.com
========================================================= */

const WORDPRESS_URL = "https://coinlytx.com";

const API_URL = `${WORDPRESS_URL}/wp-json/wp/v2`;

/* =========================================================
   TYPES
========================================================= */

export type WordPressRendered = {
  rendered: string;
};

export type WordPressMediaDetails = {
  width?: number;
  height?: number;
};

export type WordPressFeaturedMedia = {
  id: number;
  source_url: string;
  alt_text: string;
  caption?: WordPressRendered;
  media_details?: WordPressMediaDetails;
};

export type WordPressCategory = {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  parent: number;
};

export type WordPressTag = {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
};

export type WordPressAuthor = {
  id: number;
  name: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  avatar_urls?: Record<string, string>;
};

export type WordPressPost = {
  id: number;

  date: string;
  modified: string;

  slug: string;
  status: string;
  type: string;

  link: string;

  title: WordPressRendered;
  content: WordPressRendered;
  excerpt: WordPressRendered;

  author: number;

  featured_media: number;

  categories: number[];
  tags: number[];

  _embedded?: {
    author?: WordPressAuthor[];

    "wp:featuredmedia"?: WordPressFeaturedMedia[];

    "wp:term"?: Array<
      Array<WordPressCategory | WordPressTag>
    >;
  };
};

/* =========================================================
   HELPER
========================================================= */

async function wordpressFetch<T>(
  endpoint: string,
  revalidate = 300
): Promise<T> {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      next: {
        revalidate,
      },

      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `WordPress API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

/* =========================================================
   GET POSTS
========================================================= */

export async function getPosts(
  perPage = 10,
  page = 1
): Promise<WordPressPost[]> {
  return wordpressFetch<WordPressPost[]>(
    `/posts?per_page=${perPage}&page=${page}&_embed`
  );
}

/* =========================================================
   GET LATEST POSTS
========================================================= */

export async function getLatestPosts(
  amount = 8
): Promise<WordPressPost[]> {
  return wordpressFetch<WordPressPost[]>(
    `/posts?per_page=${amount}&_embed`
  );
}

/* =========================================================
   GET SINGLE POST BY SLUG
========================================================= */

export async function getPostBySlug(
  slug: string
): Promise<WordPressPost | null> {
  const posts =
    await wordpressFetch<WordPressPost[]>(
      `/posts?slug=${encodeURIComponent(
        slug
      )}&_embed`
    );

  return posts[0] ?? null;
}

/* =========================================================
   GET ALL CATEGORIES
========================================================= */

export async function getCategories(): Promise<
  WordPressCategory[]
> {
  return wordpressFetch<WordPressCategory[]>(
    "/categories?per_page=100&hide_empty=false"
  );
}

/* =========================================================
   GET CATEGORY BY SLUG
========================================================= */

export async function getCategoryBySlug(
  slug: string
): Promise<WordPressCategory | null> {
  const categories =
    await wordpressFetch<WordPressCategory[]>(
      `/categories?slug=${encodeURIComponent(
        slug
      )}`
    );

  return categories[0] ?? null;
}

/* =========================================================
   GET POSTS FROM CATEGORY ID
========================================================= */

export async function getPostsByCategory(
  categoryId: number,
  perPage = 8,
  page = 1
): Promise<WordPressPost[]> {
  return wordpressFetch<WordPressPost[]>(
    `/posts?categories=${categoryId}&per_page=${perPage}&page=${page}&_embed`
  );
}

/* =========================================================
   GET POSTS FROM CATEGORY SLUG
   IMPORTANT:
   We first find the WordPress category ID automatically.
   You do NOT need to hard-code category IDs.
========================================================= */

export async function getPostsByCategorySlug(
  slug: string,
  perPage = 8,
  page = 1
): Promise<WordPressPost[]> {
  const category =
    await getCategoryBySlug(slug);

  if (!category) {
    return [];
  }

  return getPostsByCategory(
    category.id,
    perPage,
    page
  );
}

/* =========================================================
   FEATURED IMAGE
========================================================= */

export function getFeaturedImage(
  post: WordPressPost
): string | null {
  return (
    post._embedded?.[
      "wp:featuredmedia"
    ]?.[0]?.source_url ?? null
  );
}

/* =========================================================
   FEATURED IMAGE ALT TEXT
========================================================= */

export function getFeaturedImageAlt(
  post: WordPressPost
): string {
  return (
    post._embedded?.[
      "wp:featuredmedia"
    ]?.[0]?.alt_text ||
    stripHtml(post.title.rendered)
  );
}

/* =========================================================
   AUTHOR
========================================================= */

export function getPostAuthor(
  post: WordPressPost
): WordPressAuthor | null {
  return (
    post._embedded?.author?.[0] ??
    null
  );
}

/* =========================================================
   STRIP WORDPRESS HTML
========================================================= */

export function stripHtml(
  html: string
): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   FORMAT DATE
========================================================= */

export function formatPostDate(
  date: string
): string {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date(date));
}
/* =========================================================
   PRESS RELEASE POSTS
========================================================= */

export async function getPressReleasePosts(
  perPage: number = 7
): Promise<WordPressPost[]> {
  const response = await fetch(
    `https://coinlytx.com/wp-json/wp/v2/posts?categories=21&per_page=${perPage}&_embed=1`,
    {
      next: {
        revalidate: 300,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to fetch CoinlytX press releases: ${response.status}`
    );
  }

  const posts =
    (await response.json()) as WordPressPost[];

  return posts;
}
/* =========================================================
   GLOBAL TRENDING POSTS
========================================================= */

export async function getGlobalTrendingPosts(
  perPage: number = 8
): Promise<WordPressPost[]> {
  const categoryResponse = await fetch(
    "https://coinlytx.com/wp-json/wp/v2/categories?slug=global-trending",
    {
      next: {
        revalidate: 300,
      },
    }
  );

  if (!categoryResponse.ok) {
    throw new Error(
      `Unable to find Global Trending category: ${categoryResponse.status}`
    );
  }

  const categories = await categoryResponse.json();

  if (!Array.isArray(categories) || categories.length === 0) {
    console.warn(
      "CoinlytX Global Trending category was not found."
    );

    return [];
  }

  const categoryId = categories[0].id;

  const postsResponse = await fetch(
    `https://coinlytx.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&_embed=1`,
    {
      next: {
        revalidate: 300,
      },
    }
  );

  if (!postsResponse.ok) {
    throw new Error(
      `Unable to fetch Global Trending posts: ${postsResponse.status}`
    );
  }

  return (await postsResponse.json()) as WordPressPost[];
}
/* =========================================================
   CRYPTO NEWS POSTS
========================================================= */

export async function getCryptoNewsPosts(
  perPage: number = 8
): Promise<WordPressPost[]> {
  try {
    /* Find the Crypto News category by slug */
    const categoryResponse = await fetch(
      "https://coinlytx.com/wp-json/wp/v2/categories?slug=crypto-news",
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!categoryResponse.ok) {
      throw new Error(
        `Unable to find Crypto News category: ${categoryResponse.status}`
      );
    }

    const categories = await categoryResponse.json();

    if (!Array.isArray(categories) || categories.length === 0) {
      console.warn(
        "CoinlytX Crypto News category was not found."
      );

      return [];
    }

    const categoryId = categories[0].id;

    /* Fetch posts from that category */
    const postsResponse = await fetch(
      `https://coinlytx.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&_embed=1`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!postsResponse.ok) {
      throw new Error(
        `Unable to fetch Crypto News posts: ${postsResponse.status}`
      );
    }

    return (await postsResponse.json()) as WordPressPost[];
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Crypto News:",
      error
    );

    return [];
  }
}
/* =========================================================
   SPONSORED POSTS
========================================================= */

export async function getSponsoredPosts(
  perPage: number = 6
): Promise<WordPressPost[]> {
  try {
    /* Find Sponsored category dynamically */
    const categoryResponse = await fetch(
      "https://coinlytx.com/wp-json/wp/v2/categories?slug=sponsored",
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!categoryResponse.ok) {
      throw new Error(
        `Unable to find Sponsored category: ${categoryResponse.status}`
      );
    }

    const categories = await categoryResponse.json();

    if (!Array.isArray(categories) || categories.length === 0) {
      console.warn(
        "CoinlytX Sponsored category was not found."
      );

      return [];
    }

    const categoryId = categories[0].id;

    /* Fetch Sponsored posts */
    const postsResponse = await fetch(
      `https://coinlytx.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&_embed=1`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!postsResponse.ok) {
      throw new Error(
        `Unable to fetch Sponsored posts: ${postsResponse.status}`
      );
    }

    return (await postsResponse.json()) as WordPressPost[];
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Sponsored posts:",
      error
    );

    return [];
  }
}
/* =========================================================
   LEARN POSTS
========================================================= */

export async function getLearnPosts(
  perPage: number = 15
): Promise<WordPressPost[]> {
  try {
    const categoryResponse = await fetch(
      "https://coinlytx.com/wp-json/wp/v2/categories?slug=learn",
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!categoryResponse.ok) {
      throw new Error(
        `Unable to find Learn category: ${categoryResponse.status}`
      );
    }

    const categories = await categoryResponse.json();

    if (!Array.isArray(categories) || categories.length === 0) {
      console.warn("CoinlytX Learn category was not found.");
      return [];
    }

    const categoryId = categories[0].id;

    const postsResponse = await fetch(
      `https://coinlytx.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&_embed=1`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!postsResponse.ok) {
      throw new Error(
        `Unable to fetch Learn posts: ${postsResponse.status}`
      );
    }

    return (await postsResponse.json()) as WordPressPost[];
  } catch (error) {
    console.error("Unable to load CoinlytX Learn posts:", error);
    return [];
  }
}


/* =========================================================
   PRICE ANALYSIS POSTS
========================================================= */

export async function getPriceAnalysisPosts(
  perPage: number = 15
): Promise<WordPressPost[]> {
  try {
    const categoryResponse = await fetch(
      "https://coinlytx.com/wp-json/wp/v2/categories?slug=price-analysis",
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!categoryResponse.ok) {
      throw new Error(
        `Unable to find Price Analysis category: ${categoryResponse.status}`
      );
    }

    const categories = await categoryResponse.json();

    if (!Array.isArray(categories) || categories.length === 0) {
      console.warn(
        "CoinlytX Price Analysis category was not found."
      );
      return [];
    }

    const categoryId = categories[0].id;

    const postsResponse = await fetch(
      `https://coinlytx.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&_embed=1`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!postsResponse.ok) {
      throw new Error(
        `Unable to fetch Price Analysis posts: ${postsResponse.status}`
      );
    }

    return (await postsResponse.json()) as WordPressPost[];
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Price Analysis posts:",
      error
    );

    return [];
  }
}
/* =========================================================
   GENERIC WORDPRESS ARCHIVE FETCHER
   Used by:
   /press-release/
   /crypto-news/
   /price-analysis/
   /learn/
   /sponsored/
   /global-trending/
========================================================= */

export type ArchivePostsResult = {
  posts: WordPressPost[];
  totalPosts: number;
  totalPages: number;
  currentPage: number;
};


/* =========================================================
   GET CATEGORY ID FROM WORDPRESS SLUG
========================================================= */

async function getCategoryIdBySlug(
  categorySlug: string
): Promise<number | null> {
  try {
    const response = await fetch(
      `https://coinlytx.com/wp-json/wp/v2/categories?slug=${encodeURIComponent(
        categorySlug
      )}`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Category request failed: ${response.status}`
      );
    }

    const categories = await response.json();

    if (
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      console.warn(
        `WordPress category not found: ${categorySlug}`
      );

      return null;
    }

    return categories[0].id;
  } catch (error) {
    console.error(
      `Unable to find WordPress category "${categorySlug}":`,
      error
    );

    return null;
  }
}


/* =========================================================
   GET PAGINATED ARCHIVE POSTS
========================================================= */

export async function getArchivePosts(
  categorySlug: string,
  page: number = 1,
  perPage: number = 12
): Promise<ArchivePostsResult> {
  const safePage =
    Number.isFinite(page) && page > 0
      ? Math.floor(page)
      : 1;

  const safePerPage = Math.min(
    Math.max(perPage, 1),
    100
  );

  try {
    const categoryId =
      await getCategoryIdBySlug(categorySlug);

    if (!categoryId) {
      return {
        posts: [],
        totalPosts: 0,
        totalPages: 0,
        currentPage: safePage,
      };
    }

    const response = await fetch(
      `https://coinlytx.com/wp-json/wp/v2/posts?categories=${categoryId}&page=${safePage}&per_page=${safePerPage}&_embed=1`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    /*
     * WordPress returns 400 when someone requests
     * a page number higher than the available pages.
     */
    if (!response.ok) {
      if (response.status === 400) {
        return {
          posts: [],
          totalPosts: 0,
          totalPages: 0,
          currentPage: safePage,
        };
      }

      throw new Error(
        `Archive request failed: ${response.status}`
      );
    }

    const posts =
      (await response.json()) as WordPressPost[];

    const totalPosts = Number(
      response.headers.get("X-WP-Total") || 0
    );

    const totalPages = Number(
      response.headers.get("X-WP-TotalPages") || 0
    );

    return {
      posts,
      totalPosts,
      totalPages,
      currentPage: safePage,
    };
  } catch (error) {
    console.error(
      `Unable to load archive "${categorySlug}":`,
      error
    );

    return {
      posts: [],
      totalPosts: 0,
      totalPages: 0,
      currentPage: safePage,
    };
  }
}
