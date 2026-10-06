import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import {
  WordPressPost,
  getFeaturedImage,
  getFeaturedImageAlt,
  stripHtml,
  formatPostDate,
} from "../lib/wordpress";

type FeaturedNewsCardsProps = {
  posts: WordPressPost[];
};

type NewsItem = {
  id: number;
  href: string;
  image: string | null | undefined;
  imageAlt: string;
  title: string;
  excerpt: string;
  date: string;
};

function preparePost(post: WordPressPost): NewsItem {
  const title = stripHtml(post.title.rendered);

  return {
    id: post.id,
    href: `/${post.slug}/`,
    image: getFeaturedImage(post),
    imageAlt: getFeaturedImageAlt(post) || title,
    title,
    excerpt: stripHtml(post.excerpt.rendered),
    date: formatPostDate(post.date),
  };
}

function shorten(text: string, max: number) {
  if (!text) return "";

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max).trim()}...`;
}

function NewsImage({
  story,
  eager = false,
}: {
  story: NewsItem;
  eager?: boolean;
}) {
  if (!story.image) {
    return (
      <div className="nx-image-placeholder">
        CoinlytX
      </div>
    );
  }

  return (
    <img
      src={story.image}
      alt={story.imageAlt}
      loading={eager ? "eager" : "lazy"}
    />
  );
}

export default function FeaturedNewsCards({
  posts,
}: FeaturedNewsCardsProps) {
  if (!posts?.length) {
    return null;
  }

  /*
   * OPTION 2 LAYOUT
   *
   * 1  = Main featured story
   * 2–5 = Right-side stories
   * 6–9 = Bottom stories
   */

  const featured = preparePost(posts[0]);

  const sideStories = posts
    .slice(1, 5)
    .map(preparePost);

  const bottomStories = posts
    .slice(5, 9)
    .map(preparePost);

  return (
    <section
      className="nx-news"
      aria-label="CoinlytX latest news"
    >
      <div className="nx-news-glow nx-glow-one" />
      <div className="nx-news-glow nx-glow-two" />

      {/* ==================================================
          TOP NEWS AREA
      =================================================== */}

      <div className="nx-top-grid">

        {/* ================================================
            FEATURED STORY
        ================================================= */}

        <article className="nx-featured">

          <Link
            href={featured.href}
            className="nx-featured-image"
            aria-label={featured.title}
          >
            <NewsImage
              story={featured}
              eager
            />

            <div className="nx-image-depth" />

            <span className="nx-featured-tag">
              MARKET
            </span>
          </Link>


          <div className="nx-featured-content">

            <div className="nx-meta">

              <span className="nx-date">
                <CalendarDays
                  size={14}
                  aria-hidden="true"
                />

                {featured.date}
              </span>

            </div>


            <h2>
              <Link href={featured.href}>
                {featured.title}
              </Link>
            </h2>


            {featured.excerpt && (
              <p>
                {shorten(
                  featured.excerpt,
                  190
                )}
              </p>
            )}


            <Link
              href={featured.href}
              className="nx-main-button"
            >
              Read Full Story

              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </Link>

          </div>

        </article>


        {/* ================================================
            RIGHT STORIES
        ================================================= */}

        <div className="nx-side-list">

          {sideStories.map(
            (story, index) => (
              <article
                className="nx-side-card"
                key={story.id}
              >

                <Link
                  href={story.href}
                  className="nx-side-image"
                  aria-label={story.title}
                >
                  <NewsImage
                    story={story}
                    eager={index < 2}
                  />
                </Link>


                <div className="nx-side-content">

                  <div className="nx-side-meta">

                    <span className="nx-category">
                      {index === 0
                        ? "TECH"
                        : index === 1
                        ? "BLOCKCHAIN"
                        : index === 2
                        ? "WEB3"
                        : "MARKET"}
                    </span>


                    <span className="nx-date">
                      <CalendarDays
                        size={12}
                        aria-hidden="true"
                      />

                      {story.date}
                    </span>

                  </div>


                  <h3>
                    <Link href={story.href}>
                      {story.title}
                    </Link>
                  </h3>

                </div>


                <Link
                  href={story.href}
                  className="nx-arrow-button"
                  aria-label={`Read ${story.title}`}
                >
                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                  />
                </Link>

              </article>
            )
          )}

        </div>

      </div>


      {/* ==================================================
          BOTTOM STORIES
      =================================================== */}

      {bottomStories.length > 0 && (
        <div className="nx-bottom-grid">

          {bottomStories.map(
            (story, index) => (
              <article
                className="nx-bottom-card"
                key={story.id}
              >

                <Link
                  href={story.href}
                  className="nx-bottom-image"
                  aria-label={story.title}
                >
                  <NewsImage story={story} />
                </Link>


                <div className="nx-bottom-content">

                  <div className="nx-bottom-meta">

                    <span className="nx-category">
                      {index === 0
                        ? "REGULATION"
                        : index === 1
                        ? "ALTCOINS"
                        : index === 2
                        ? "MARKET"
                        : "BLOCKCHAIN"}
                    </span>


                    <span className="nx-date">
                      <CalendarDays
                        size={11}
                        aria-hidden="true"
                      />

                      {story.date}
                    </span>

                  </div>


                  <h3>
                    <Link href={story.href}>
                      {story.title}
                    </Link>
                  </h3>


                  <Link
                    href={story.href}
                    className="nx-read-link"
                  >
                    Read Story

                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                    />
                  </Link>

                </div>

              </article>
            )
          )}

        </div>
      )}

    </section>
  );
}