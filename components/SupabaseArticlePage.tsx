import Link from "next/link";
import type { SupabaseArticle } from "@/lib/supabase-articles";

type Props = {
  article: SupabaseArticle;
};

function formatDate(value: string | null) {
  if (!value) return "";

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

function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readingTime(content: string) {
  const words = stripHtml(content)
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

export default function SupabaseArticlePage({
  article,
}: Props) {
  const date =
    article.published_at ||
    article.created_at;

  const minutes =
    readingTime(article.content);

  const categoryName =
    article.category?.name ||
    "Crypto News";

  const categorySlug =
    article.category?.slug ||
    "crypto-news";

  const categoryUrl =
    `/${categorySlug}/`;

  const canonical =
    article.canonical_url ||
    `https://coinlytx.com/${article.slug}/`;

  const description =
    article.meta_description ||
    article.excerpt ||
    stripHtml(article.content).slice(0, 160);

  const imageAlt =
    article.featured_image_alt ||
    article.title;

  /* =========================================
     NEWS ARTICLE STRUCTURED DATA
  ========================================= */

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",

    headline: article.title,

    description,

    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },

    datePublished: date,

    dateModified:
      article.updated_at ||
      date,

    author: {
      "@type": "Organization",
      name: "CoinlytX Team",
      url: "https://coinlytx.com/",
    },

    publisher: {
      "@type": "Organization",
      name: "CoinlytX",
      url: "https://coinlytx.com/",
    },

    ...(article.featured_image_url
      ? {
          image: [
            article.featured_image_url,
          ],
        }
      : {}),

    articleSection: categoryName,

    inLanguage: "en-US",
  };

  /* =========================================
     BREADCRUMB STRUCTURED DATA
  ========================================= */

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",

    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://coinlytx.com/",
      },

      {
        "@type": "ListItem",
        position: 2,
        name: categoryName,
        item:
          `https://coinlytx.com/${categorySlug}/`,
      },

      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: canonical,
      },
    ],
  };

  return (
    <>
      {/* NEWS ARTICLE SCHEMA */}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleSchema
          ).replace(/</g, "\\u003c"),
        }}
      />

      {/* BREADCRUMB SCHEMA */}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema
          ).replace(/</g, "\\u003c"),
        }}
      />

      <main className="cfx-article">
        <div className="cfx-article-shell">

          <article className="cfx-article-main">

            {/* BREADCRUMBS */}

            <nav
              className="cfx-article-breadcrumbs"
              aria-label="Breadcrumb"
            >
              <Link href="/">
                Home
              </Link>

              <span>›</span>

              <Link href={categoryUrl}>
                {categoryName}
              </Link>

              <span>›</span>

              <span>
                {article.title}
              </span>
            </nav>

            {/* CATEGORY */}

            <Link
              href={categoryUrl}
              className="cfx-article-category"
            >
              {categoryName}
            </Link>

            {/* TITLE */}

            <h1 className="cfx-article-title">
              {article.title}
            </h1>

            {/* META */}

            <div className="cfx-article-meta">

              <div className="cfx-article-author">

                <span className="cfx-author-avatar">
                  C
                </span>

                <span>
                  By{" "}
                  <strong>
                    CoinlytX Team
                  </strong>
                </span>

              </div>

              <span className="cfx-meta-divider" />

              <time dateTime={date}>
                {formatDate(date)}
              </time>

              <span className="cfx-meta-divider" />

              <span>
                {minutes} min read
              </span>

            </div>

          
            {/* ARTICLE CONTENT */}

            <div
              className="cfx-article-content"
              dangerouslySetInnerHTML={{
                __html: article.content,
              }}
            />

            {/* ARTICLE FOOTER */}

            <footer className="cfx-article-footer">

              <div>
                <span>
                  Published by
                </span>

                <strong>
                  CoinlytX Team
                </strong>
              </div>

              <Link href={categoryUrl}>
                More {categoryName} →
              </Link>

            </footer>

          </article>

          {/* SIDEBAR */}

          <aside className="cfx-article-sidebar">

            <section className="cfx-article-sidebox">

              <div className="cfx-sidebox-heading">

                <div>
                  <span className="cfx-sidebox-dot" />

                  <h2>
                    CoinlytX
                  </h2>
                </div>

              </div>

              <p
                style={{
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                Latest cryptocurrency news,
                market updates, analysis and
                blockchain coverage.
              </p>

            </section>

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