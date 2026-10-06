import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArticleKeyInsights from "../../components/ArticleKeyInsights";

import {
  getPostBySlug,
  getLatestPosts,
  type WordPressPost,
} from "../../lib/wordpress";

import { generateArticleInsights } from "../../lib/article-insights";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

/* =========================================================
   HELPERS
========================================================= */

function decodeHtml(value: string = "") {
  return value
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string = "") {
  return decodeHtml(
    value.replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getFeaturedImage(post: WordPressPost) {
  const media =
    (post as any)?._embedded?.["wp:featuredmedia"]?.[0];

  return (
    media?.media_details?.sizes?.large?.source_url ||
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.source_url ||
    "/image/crypto-placeholder.jpg"
  );
}

function getImageAlt(post: WordPressPost) {
  const media =
    (post as any)?._embedded?.["wp:featuredmedia"]?.[0];

  return (
    media?.alt_text ||
    stripHtml(post.title?.rendered || "") ||
    "CoinlytX crypto news"
  );
}

function getAuthor(post: WordPressPost) {
  return (
    (post as any)?._embedded?.author?.[0]?.name ||
    "CoinlytX Team"
  );
}

/* =========================================================
   CATEGORY
========================================================= */

function getCategory(post: WordPressPost) {
  const groups =
    (post as any)?._embedded?.["wp:term"] || [];

  const terms = groups.flat();

  const categories = terms.filter(
    (term: any) => term?.taxonomy === "category"
  );

  /*
   * Prefer useful editorial categories instead of generic Blog.
   */

  const preferredSlugs = [
    "crypto-news",
    "press-release",
    "price-analysis",
    "learn",
    "sponsored",
    "global-trending",
  ];

  for (const preferredSlug of preferredSlugs) {
    const found = categories.find(
      (term: any) => term?.slug === preferredSlug
    );

    if (found) {
      return {
        name: found.name,
        slug: found.slug,
      };
    }
  }

  const nonGenericCategory = categories.find(
    (term: any) =>
      term?.slug !== "blog" &&
      term?.slug !== "uncategorized"
  );

  const category =
    nonGenericCategory ||
    categories[0];

  return {
    name: category?.name || "Crypto News",
    slug: category?.slug || "crypto-news",
  };
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function readingTime(content: string) {
  const words = stripHtml(content)
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(
    1,
    Math.ceil(words / 220)
  );
}

/* =========================================================
   SPLIT ARTICLE AFTER FIRST IMAGE
========================================================= */

function splitAfterFirstImage(html: string) {
  if (!html) {
    return {
      beforeInsights: "",
      afterInsights: "",
    };
  }

  /*
   * First try to capture the complete WordPress figure.
   * This keeps image + caption together.
   */

  const figureMatch = html.match(
    /<figure\b[^>]*>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/figure>/i
  );

  if (
    figureMatch &&
    typeof figureMatch.index === "number"
  ) {
    const end =
      figureMatch.index +
      figureMatch[0].length;

    return {
      beforeInsights:
        html.slice(0, end),

      afterInsights:
        html.slice(end),
    };
  }

  /*
   * Fallback for articles where WordPress stored
   * the image without a figure element.
   */

  const imageMatch = html.match(
    /<img\b[^>]*>/i
  );

  if (
    imageMatch &&
    typeof imageMatch.index === "number"
  ) {
    const end =
      imageMatch.index +
      imageMatch[0].length;

    return {
      beforeInsights:
        html.slice(0, end),

      afterInsights:
        html.slice(end),
    };
  }

  /*
   * No image in article:
   * Key Insights will appear before article text.
   */

  return {
    beforeInsights: "",
    afterInsights: html,
  };
}

/* =========================================================
   SEO METADATA
========================================================= */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const post =
    await getPostBySlug(slug);

  if (!post) {
    return {
      title:
        "Article Not Found | CoinlytX",

      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title =
    stripHtml(
      post.title?.rendered || ""
    );

  const excerpt =
    stripHtml(
      post.excerpt?.rendered || ""
    );

  const description =
    excerpt.length > 160
      ? `${excerpt
          .slice(0, 157)
          .trim()}...`
      : excerpt;

  const image =
    getFeaturedImage(post);

  const canonical =
    `https://coinlytx.com/${post.slug}/`;

  return {
    title,
    description,

    alternates: {
      canonical,
    },

    openGraph: {
      title,
      description,

      url: canonical,

      siteName: "CoinlytX",

      type: "article",

      publishedTime:
        post.date,

      modifiedTime:
        (post as any).modified ||
        post.date,

      images: [
        {
          url: image,
          alt: getImageAlt(post),
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },

    robots: {
      index: true,
      follow: true,

      googleBot: {
        index: true,
        follow: true,

        "max-image-preview":
          "large",

        "max-snippet": -1,

        "max-video-preview": -1,
      },
    },
  };
}

/* =========================================================
   ARTICLE PAGE
========================================================= */

export default async function ArticlePage({
  params,
}: PageProps) {
  const { slug } = await params;

  const post =
    await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const title =
    stripHtml(
      post.title?.rendered || ""
    );

  const content =
    post.content?.rendered || "";

  const excerpt =
    post.excerpt?.rendered || "";

  /*
   * Featured image is NOT manually displayed.
   * It remains available for SEO/OpenGraph/schema.
   */

  const image =
    getFeaturedImage(post);

  const author =
    getAuthor(post);

  const category =
    getCategory(post);

  const minutes =
    readingTime(content);

  const canonical =
    `https://coinlytx.com/${post.slug}/`;

  /* =======================================================
     SPLIT WORDPRESS ARTICLE
  ======================================================= */

  const {
    beforeInsights,
    afterInsights,
  } = splitAfterFirstImage(content);

  /* =======================================================
     EXACTLY THREE KEY INSIGHTS
  ======================================================= */

  const insights =
    generateArticleInsights(
      content,
      excerpt
    ).slice(0, 3);

  /* =======================================================
     LATEST ARTICLES
  ======================================================= */

  let latest: WordPressPost[] = [];

  try {
    latest =
      await getLatestPosts(7);
  } catch (error) {
    console.error(
      "Latest article fetch failed:",
      error
    );
  }

  const latestPosts =
    latest
      .filter(
        (item) =>
          item.id !== post.id
      )
      .slice(0, 5);

  /* =======================================================
     NEWS ARTICLE SCHEMA
  ======================================================= */

  const articleSchema = {
    "@context":
      "https://schema.org",

    "@type":
      "NewsArticle",

    headline:
      title,

    description:
      stripHtml(excerpt),

    image: [
      image,
    ],

    datePublished:
      post.date,

    dateModified:
      (post as any).modified ||
      post.date,

    mainEntityOfPage: {
      "@type":
        "WebPage",

      "@id":
        canonical,
    },

    author: {
      "@type":
        "Organization",

      name:
        author,
    },

    publisher: {
      "@type":
        "Organization",

      name:
        "CoinlytX",

      url:
        "https://coinlytx.com/",
    },
  };

  return (
    <>
      {/* ===============================================
          STRUCTURED DATA
      =============================================== */}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify(
              articleSchema
            ).replace(
              /</g,
              "\\u003c"
            ),
        }}
      />

      <main className="cfx-article">

        <div className="cfx-article-shell">

          {/* ===========================================
              LEFT ARTICLE
          =========================================== */}

          <article className="cfx-article-main">

            {/* =========================================
                BREADCRUMBS
            ========================================= */}

            <nav
              className="cfx-article-breadcrumbs"
              aria-label="Breadcrumb"
            >
              <Link href="/">
                Home
              </Link>

              <span>›</span>

              <Link
                href={`/${category.slug}/`}
              >
                {category.name}
              </Link>

              <span>›</span>

              <span>
                {title}
              </span>
            </nav>

            {/* =========================================
                CATEGORY
            ========================================= */}

            <Link
              href={`/${category.slug}/`}
              className="cfx-article-category"
            >
              {category.name}
            </Link>

            {/* =========================================
                TITLE
            ========================================= */}

            <h1 className="cfx-article-title">
              {title}
            </h1>

            {/* =========================================
                META
            ========================================= */}

            <div className="cfx-article-meta">

              <div className="cfx-article-author">

                <span className="cfx-author-avatar">
                  C
                </span>

                <span>
                  By{" "}
                  <strong>
                    {author}
                  </strong>
                </span>

              </div>

              <span className="cfx-meta-divider" />

              <time dateTime={post.date}>
                {formatDate(post.date)}
              </time>

              <span className="cfx-meta-divider" />

              <span>
                {minutes} min read
              </span>

            </div>

            {/* =========================================
                WORDPRESS CONTENT THROUGH FIRST IMAGE

                This displays the image already stored
                inside the WordPress article.

                No duplicate featured image.
            ========================================= */}

            {beforeInsights && (
              <div
                className="
                  cfx-article-content
                  cfx-article-content-before
                "
                dangerouslySetInnerHTML={{
                  __html:
                    beforeInsights,
                }}
              />
            )}

            {/* =========================================
                KEY INSIGHTS

                EXACTLY 3
                Appears AFTER first article image.
            ========================================= */}

            {insights.length > 0 && (
              <ArticleKeyInsights
                insights={insights}
              />
            )}

            {/* =========================================
                REST OF WORDPRESS ARTICLE
            ========================================= */}

            {afterInsights && (
              <div
                className="
                  cfx-article-content
                  cfx-article-content-after
                "
                dangerouslySetInnerHTML={{
                  __html:
                    afterInsights,
                }}
              />
            )}

            {/* =========================================
                ARTICLE FOOTER
            ========================================= */}

            <footer className="cfx-article-footer">

              <div>
                <span>
                  Published by
                </span>

                <strong>
                  {author}
                </strong>
              </div>

              <Link
                href={`/${category.slug}/`}
              >
                More {category.name} →
              </Link>

            </footer>

          </article>

          {/* ===========================================
              RIGHT SIDEBAR
          =========================================== */}

          <aside className="cfx-article-sidebar">

            {/* =========================================
                LIVE CRYPTO PRICES
            ========================================= */}

            <section className="cfx-article-sidebox">

              <div className="cfx-sidebox-heading">

                <div>
                  <span className="cfx-sidebox-dot" />

                  <h2>
                    Live Crypto Prices
                  </h2>
                </div>

                <Link href="/crypto-prices/">
                  See All →
                </Link>

              </div>

              <div className="cfx-price-list">

                {/* BITCOIN */}

                <div className="cfx-price-row">

                  <span className="cfx-price-coin cfx-btc">
                    ₿
                  </span>

                  <div>
                    <strong>
                      Bitcoin
                    </strong>

                    <span>
                      BTC
                    </span>
                  </div>

                  <div className="cfx-price-value">
                    <strong>
                      BTC
                    </strong>

                    <span>
                      Live Market
                    </span>
                  </div>

                </div>

                {/* ETHEREUM */}

                <div className="cfx-price-row">

                  <span className="cfx-price-coin cfx-eth">
                    ◆
                  </span>

                  <div>
                    <strong>
                      Ethereum
                    </strong>

                    <span>
                      ETH
                    </span>
                  </div>

                  <div className="cfx-price-value">
                    <strong>
                      ETH
                    </strong>

                    <span>
                      Live Market
                    </span>
                  </div>

                </div>

                {/* SOLANA */}

                <div className="cfx-price-row">

                  <span className="cfx-price-coin cfx-sol">
                    S
                  </span>

                  <div>
                    <strong>
                      Solana
                    </strong>

                    <span>
                      SOL
                    </span>
                  </div>

                  <div className="cfx-price-value">
                    <strong>
                      SOL
                    </strong>

                    <span>
                      Live Market
                    </span>
                  </div>

                </div>

                {/* BNB */}

                <div className="cfx-price-row">

                  <span className="cfx-price-coin cfx-bnb">
                    B
                  </span>

                  <div>
                    <strong>
                      BNB
                    </strong>

                    <span>
                      BNB
                    </span>
                  </div>

                  <div className="cfx-price-value">
                    <strong>
                      BNB
                    </strong>

                    <span>
                      Live Market
                    </span>
                  </div>

                </div>

              </div>

            </section>

            {/* =========================================
                LATEST ARTICLES
            ========================================= */}

            <section className="cfx-article-sidebox">

              <div className="cfx-sidebox-heading">

                <div>
                  <span className="cfx-sidebox-dot" />

                  <h2>
                    Latest Articles
                  </h2>
                </div>

                <Link href="/crypto-news/">
                  See All →
                </Link>

              </div>

              <div className="cfx-latest-list">

                {latestPosts.map(
                  (item) => (
                    <Link
                      href={`/${item.slug}/`}
                      className="cfx-latest-item"
                      key={item.id}
                    >

                      <div className="cfx-latest-image">

                        <img
                          src={
                            getFeaturedImage(
                              item
                            )
                          }
                          alt={
                            getImageAlt(
                              item
                            )
                          }
                          loading="lazy"
                        />

                      </div>

                      <div className="cfx-latest-copy">

                        <h3>
                          {stripHtml(
                            item.title
                              ?.rendered ||
                              ""
                          )}
                        </h3>

                        <time
                          dateTime={
                            item.date
                          }
                        >
                          {formatDate(
                            item.date
                          )}
                        </time>

                      </div>

                    </Link>
                  )
                )}

              </div>

            </section>

            {/* =========================================
                NEWSLETTER
            ========================================= */}

            <section className="cfx-newsletter-card">

              <div className="cfx-newsletter-icon">
                ✉
              </div>

              <div>

                <span className="cfx-newsletter-label">
                  COINLYTX DAILY
                </span>

                <h2>
                  Get Crypto News in Your Inbox
                </h2>

                <p>
                  Get the latest crypto news,
                  analysis and market updates
                  from CoinlytX.
                </p>

                <Link href="/contact/">
                  Stay Updated →
                </Link>

              </div>

            </section>

          </aside>

        </div>

      </main>
    </>
  );
}