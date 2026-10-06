import Link from "next/link";
import type { WordPressPost } from "../lib/wordpress";

type EditorialNewsGridProps = {
  title: string;
  posts: WordPressPost[];
  viewAllHref: string;
  variant?: "learn" | "analysis";
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
  const embedded = (post as any)?._embedded;

  return (
    embedded?.["wp:featuredmedia"]?.[0]?.media_details?.sizes?.medium
      ?.source_url ||
    embedded?.["wp:featuredmedia"]?.[0]?.media_details?.sizes?.thumbnail
      ?.source_url ||
    embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
    "/image/crypto-placeholder.jpg"
  );
}


function getImageAlt(post: WordPressPost) {
  const embedded = (post as any)?._embedded;

  return (
    embedded?.["wp:featuredmedia"]?.[0]?.alt_text ||
    stripHtml(post.title?.rendered || "") ||
    "CoinlytX article"
  );
}


/* =========================================================
   RELATIVE DATE
========================================================= */

function formatArticleDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const minutes = Math.floor(
    difference / (1000 * 60)
  );

  const hours = Math.floor(
    difference / (1000 * 60 * 60)
  );

  const days = Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );

  if (minutes >= 0 && minutes < 60) {
    return minutes <= 1
      ? "Just now"
      : `${minutes} mins ago`;
  }

  if (hours >= 0 && hours < 24) {
    return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`;
  }

  if (days >= 0 && days < 3) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


/* =========================================================
   COMPONENT
========================================================= */

export default function EditorialNewsGrid({
  title,
  posts,
  viewAllHref,
  variant = "learn",
}: EditorialNewsGridProps) {
  if (!posts || posts.length === 0) {
    return null;
  }

  const visiblePosts = posts.slice(0, 15);

  return (
    <section
      className={`ednews-section ednews-${variant}`}
    >
      <div className="ednews-shell">

        {/* ===============================================
            HEADING
        =============================================== */}

        <div className="ednews-heading">

          <div className="ednews-heading-left">
            <span className="ednews-accent-line" />

            <h2>{title}</h2>
          </div>

          <Link
            href={viewAllHref}
            className="ednews-view-all"
          >
            View All

            <span aria-hidden="true">
              →
            </span>
          </Link>

        </div>


        {/* ===============================================
            ARTICLES
        =============================================== */}

        <div className="ednews-grid">

          {visiblePosts.map((post) => {
            const titleText = stripHtml(
              post.title?.rendered || ""
            );

            const href = `/${post.slug}/`;

            return (
              <article
                className="ednews-story"
                key={post.id}
              >

                {/* IMAGE */}

                <Link
                  href={href}
                  className="ednews-image"
                  aria-label={titleText}
                >
                  <img
                    src={getImage(post)}
                    alt={getImageAlt(post)}
                    loading="lazy"
                  />
                </Link>


                {/* ARTICLE TEXT */}

                <div className="ednews-content">

                  <Link
                    href={href}
                    className="ednews-title"
                  >
                    {titleText}
                  </Link>

                  <time
                    className="ednews-date"
                    dateTime={post.date}
                  >
                    {formatArticleDate(post.date)}
                  </time>

                </div>


                {/* HOVER ARROW */}

                <Link
                  href={href}
                  className="ednews-arrow"
                  aria-label={`Read ${titleText}`}
                >
                  →
                </Link>

              </article>
            );
          })}

        </div>

      </div>
    </section>
  );
}