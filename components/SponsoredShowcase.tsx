"use client";

import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
} from "lucide-react";

import type { WordPressPost } from "../lib/wordpress";

/* =========================================================
   TYPES
========================================================= */

type SponsoredShowcaseProps = {
  posts: WordPressPost[];
};

type SponsoredPost = {
  id: number;
  slug: string;
  title: string;
  image: string;
  alt: string;
  date: string;
  excerpt: string;
};

/* =========================================================
   HELPERS
========================================================= */

function decodeHtml(value: string = "") {
  if (typeof document === "undefined") {
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

  const textarea = document.createElement("textarea");

  textarea.innerHTML = value;

  return textarea.value;
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
    embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
    "/image/crypto-placeholder.jpg"
  );
}

function getAlt(post: WordPressPost) {
  const embedded = (post as any)?._embedded;

  return (
    embedded?.["wp:featuredmedia"]?.[0]?.alt_text ||
    stripHtml(post.title?.rendered || "") ||
    "Sponsored crypto content"
  );
}

function formatDate(date: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  } catch {
    return "";
  }
}

function preparePost(
  post: WordPressPost
): SponsoredPost {
  return {
    id: post.id,
    slug: post.slug,

    title: stripHtml(
      post.title?.rendered || ""
    ),

    image: getImage(post),

    alt: getAlt(post),

    date: formatDate(post.date),

    excerpt: stripHtml(
      post.excerpt?.rendered || ""
    ),
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function SponsoredShowcase({
  posts,
}: SponsoredShowcaseProps) {
  const sponsoredPosts = posts
    .slice(0, 4)
    .map(preparePost);

  if (sponsoredPosts.length === 0) {
    return null;
  }

  const featured = sponsoredPosts[0];

  const sidePosts = sponsoredPosts.slice(1, 4);

  return (
    <section className="spx-section">
      {/* Decorative background */}

      <div
        className="spx-glow spx-glow-one"
        aria-hidden="true"
      />

      <div
        className="spx-glow spx-glow-two"
        aria-hidden="true"
      />

      <div
        className="spx-grid-decoration"
        aria-hidden="true"
      />

      <div className="spx-shell">

        {/* =================================================
            LEFT INTRO
        ================================================= */}

        <div className="spx-intro">
          <div className="spx-label">
            <span className="spx-label-dot" />

            SPONSORED
          </div>

          <h2 className="spx-heading">
            Exclusive
            <span>
              Partner Content
            </span>
          </h2>

          <p className="spx-description">
            Discover featured brands, exclusive
            campaigns and sponsored stories from
            across the crypto, blockchain and Web3
            ecosystem.
          </p>

          <Link
            href="/sponsored/"
            className="spx-view-all"
          >
            View All Sponsored

            <ArrowRight size={17} />
          </Link>

          <div className="spx-trust">
            <Sparkles size={15} />

            <span>
              Featured partner stories
            </span>
          </div>
        </div>


        {/* =================================================
            FEATURED STORY
        ================================================= */}

        <article className="spx-featured">

          {/* IMAGE IS SEPARATE */}

          <Link
            href={`/${featured.slug}/`}
            className="spx-featured-image-link"
          >
            <div className="spx-featured-image">
              <img
                src={featured.image}
                alt={featured.alt}
              />

              <div className="spx-image-overlay" />

              <div className="spx-sponsored-chip">
                SPONSORED
              </div>

              <div
                className="spx-image-shine"
                aria-hidden="true"
              />
            </div>
          </Link>


          {/* CONTENT IS SEPARATE */}

          <div className="spx-featured-content">
            <div className="spx-featured-meta">
              <span>
                PARTNER STORY
              </span>

              <i />

              <time>
                {featured.date}
              </time>
            </div>

            <Link
              href={`/${featured.slug}/`}
            >
              <h3>
                {featured.title}
              </h3>
            </Link>

            {featured.excerpt && (
              <p>
                {featured.excerpt}
              </p>
            )}

            <Link
              href={`/${featured.slug}/`}
              className="spx-read-more"
            >
              Read Sponsored Story

              <ArrowRight size={16} />
            </Link>
          </div>
        </article>


        {/* =================================================
            RIGHT SIDE STORIES
        ================================================= */}

        <div className="spx-side-list">

          {sidePosts.map((post, index) => (
            <article
              className="spx-side-story"
              key={post.id}
            >

              {/* SMALL IMAGE */}

              <Link
                href={`/${post.slug}/`}
                className="spx-side-image"
              >
                <img
                  src={post.image}
                  alt={post.alt}
                />

                <span className="spx-side-number">
                  0{index + 2}
                </span>
              </Link>


              {/* SEPARATE CONTENT */}

              <div className="spx-side-content">
                <div className="spx-side-label">
                  SPONSORED
                </div>

                <Link
                  href={`/${post.slug}/`}
                >
                  <h3>
                    {post.title}
                  </h3>
                </Link>

                <div className="spx-side-footer">
                  <time>
                    {post.date}
                  </time>

                  <Link
                    href={`/${post.slug}/`}
                    aria-label={`Read ${post.title}`}
                    className="spx-side-arrow"
                  >
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

            </article>
          ))}

        </div>

      </div>
    </section>
  );
}