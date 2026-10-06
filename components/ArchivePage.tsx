import Link from "next/link";
import type { WordPressPost } from "../lib/wordpress";
import type { ArchiveConfig } from "../lib/archive-config";

type ArchivePageProps = {
  config: ArchiveConfig;
  posts: WordPressPost[];
  currentPage: number;
  totalPages: number;
  totalPosts: number;
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

function getImage(post: WordPressPost) {
  const media =
    (post as any)?._embedded?.["wp:featuredmedia"]?.[0];

  return (
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.media_details?.sizes?.medium?.source_url ||
    media?.source_url ||
    "/image/crypto-placeholder.jpg"
  );
}

function getAlt(post: WordPressPost) {
  const media =
    (post as any)?._embedded?.["wp:featuredmedia"]?.[0];

  return (
    media?.alt_text ||
    stripHtml(post.title?.rendered || "") ||
    "CoinlytX article"
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getExcerpt(post: WordPressPost) {
  const excerpt = stripHtml(
    post.excerpt?.rendered || ""
  );

  if (excerpt.length <= 150) {
    return excerpt;
  }

  return `${excerpt.slice(0, 147).trim()}...`;
}

/* =========================================================
   PAGINATION
========================================================= */

function createPagination(
  currentPage: number,
  totalPages: number
) {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  const pages: Array<number | "..."> = [];

  pages.push(1);

  if (currentPage > 4) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(
    totalPages - 1,
    currentPage + 1
  );

  for (let page = start; page <= end; page++) {
    pages.push(page);
  }

  if (currentPage < totalPages - 3) {
    pages.push("...");
  }

  pages.push(totalPages);

  return pages;
}

function pageHref(
  slug: string,
  page: number
) {
  if (page <= 1) {
    return `/${slug}/`;
  }

  return `/${slug}/page/${page}/`;
}

/* =========================================================
   ARCHIVE PAGE
========================================================= */

export default function ArchivePage({
  config,
  posts,
  currentPage,
  totalPages,
  totalPosts,
}: ArchivePageProps) {
  const pagination = createPagination(
    currentPage,
    totalPages
  );

  /*
   * Use the first few posts for the sidebar.
   * We can later replace this with actual "Most Read"
   * analytics when you have view-count data.
   */
  const sidebarPosts = posts.slice(0, 5);

  return (
    <main
      className={`cfx-archive cfx-archive-${config.accent}`}
    >
      {/* =================================================
          HERO
      ================================================= */}

      <section className="cfx-archive-hero">
        <div className="cfx-archive-hero-glow" />

        <div className="cfx-archive-hero-inner">

          <nav
            className="cfx-archive-breadcrumb"
            aria-label="Breadcrumb"
          >
            <Link href="/">
              Home
            </Link>

            <span aria-hidden="true">
              ›
            </span>

            <span>
              {config.title}
            </span>
          </nav>

          <div className="cfx-archive-hero-copy">

            <span className="cfx-archive-eyebrow">
              COINLYTX
            </span>

            <h1>
              {config.title}
            </h1>

            <p>
              {config.description}
            </p>

          </div>

          <div
            className="cfx-archive-hero-art"
            aria-hidden="true"
          >
            <div className="cfx-archive-orb cfx-archive-orb-one" />
            <div className="cfx-archive-orb cfx-archive-orb-two" />

            <div className="cfx-archive-cube">
              <span />
              <span />
              <span />
            </div>
          </div>

        </div>
      </section>


      {/* =================================================
          CONTENT
      ================================================= */}

      <section className="cfx-archive-content">
        <div className="cfx-archive-layout">

          {/* ===============================================
              MAIN COLUMN
          =============================================== */}

          <div className="cfx-archive-main">

            <div className="cfx-archive-section-heading">

              <div>
                <span>
                  {config.label}
                </span>

                <h2>
                  Latest {config.title}
                </h2>
              </div>

              <p>
                {totalPosts > 0
                  ? `${totalPosts} articles`
                  : "Latest articles"}
              </p>

            </div>


            {/* =============================================
                POSTS
            ============================================= */}

            <div className="cfx-archive-posts">

              {posts.length > 0 ? (
                posts.map((post) => {
                  const title = stripHtml(
                    post.title?.rendered || ""
                  );

                  const href =
                    `/${post.slug}/`;

                  return (
                    <article
                      className="cfx-archive-card"
                      key={post.id}
                    >

                      <Link
                        href={href}
                        className="cfx-archive-card-image"
                      >
                        <img
                          src={getImage(post)}
                          alt={getAlt(post)}
                          loading="lazy"
                        />

                        <span>
                          {config.label}
                        </span>
                      </Link>


                      <div className="cfx-archive-card-content">

                        <div className="cfx-archive-card-meta">

                          <span>
                            {config.label}
                          </span>

                          <time dateTime={post.date}>
                            {formatDate(post.date)}
                          </time>

                        </div>

                        <Link href={href}>
                          <h3>
                            {title}
                          </h3>
                        </Link>

                        <p>
                          {getExcerpt(post)}
                        </p>

                        <Link
                          href={href}
                          className="cfx-archive-read"
                        >
                          Read More
                          <span aria-hidden="true">
                            →
                          </span>
                        </Link>

                      </div>

                    </article>
                  );
                })
              ) : (
                <div className="cfx-archive-empty">
                  <h2>
                    No articles found
                  </h2>

                  <p>
                    There are currently no posts available
                    in this section.
                  </p>
                </div>
              )}

            </div>


            {/* =============================================
                SEO-FRIENDLY PAGINATION
            ============================================= */}

            {totalPages > 1 && (
              <nav
                className="cfx-pagination"
                aria-label={`${config.title} pagination`}
              >

                {currentPage > 1 && (
                  <Link
                    href={pageHref(
                      config.slug,
                      currentPage - 1
                    )}
                    className="cfx-pagination-direction"
                  >
                    ←
                    <span>
                      Previous
                    </span>
                  </Link>
                )}


                <div className="cfx-pagination-pages">

                  {pagination.map((page, index) => {
                    if (page === "...") {
                      return (
                        <span
                          className="cfx-pagination-dots"
                          key={`dots-${index}`}
                        >
                          …
                        </span>
                      );
                    }

                    return (
                      <Link
                        key={page}
                        href={pageHref(
                          config.slug,
                          page
                        )}
                        className={
                          page === currentPage
                            ? "cfx-pagination-number active"
                            : "cfx-pagination-number"
                        }
                        aria-current={
                          page === currentPage
                            ? "page"
                            : undefined
                        }
                      >
                        {page}
                      </Link>
                    );
                  })}

                </div>


                {currentPage < totalPages && (
                  <Link
                    href={pageHref(
                      config.slug,
                      currentPage + 1
                    )}
                    className="cfx-pagination-direction"
                  >
                    <span>
                      Next
                    </span>
                    →
                  </Link>
                )}

              </nav>
            )}

          </div>


          {/* ===============================================
              SIDEBAR
          =============================================== */}

          <aside className="cfx-archive-sidebar">

            <div className="cfx-sidebar-widget">

              <div className="cfx-sidebar-heading">
                <span className="cfx-sidebar-live" />

                <h2>
                  Latest Stories
                </h2>
              </div>

              <div className="cfx-sidebar-stories">

                {sidebarPosts.map(
                  (post, index) => (
                    <Link
                      href={`/${post.slug}/`}
                      className="cfx-sidebar-story"
                      key={post.id}
                    >
                      <span className="cfx-sidebar-number">
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <span className="cfx-sidebar-story-content">
                        <strong>
                          {stripHtml(
                            post.title?.rendered || ""
                          )}
                        </strong>

                        <small>
                          {formatDate(post.date)}
                        </small>
                      </span>

                      <span
                        className="cfx-sidebar-arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </Link>
                  )
                )}

              </div>

            </div>


            {/* =============================================
                DISCOVER
            ============================================= */}

            <div className="cfx-sidebar-widget cfx-sidebar-discover">

              <span className="cfx-sidebar-small-label">
                DISCOVER COINLYTX
              </span>

              <h2>
                Explore More
              </h2>

              <p>
                Follow the latest crypto news,
                analysis, educational guides and
                blockchain developments.
              </p>

              <div className="cfx-sidebar-links">

                <Link href="/crypto-news/">
                  Crypto News
                  <span>→</span>
                </Link>

                <Link href="/price-analysis/">
                  Price Analysis
                  <span>→</span>
                </Link>

                <Link href="/learn/">
                  Learn Crypto
                  <span>→</span>
                </Link>

                <Link href="/press-release/">
                  Press Release
                  <span>→</span>
                </Link>

              </div>

            </div>

          </aside>

        </div>
      </section>
    </main>
  );
}