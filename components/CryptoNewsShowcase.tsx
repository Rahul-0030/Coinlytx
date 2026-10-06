"use client";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

import {
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";

import type { WordPressPost } from "../lib/wordpress";

/* =========================================================
   TYPES
========================================================= */

type CryptoNewsShowcaseProps = {
  posts: WordPressPost[];
};

type PreparedPost = {
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
  if (typeof window === "undefined") {
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

  const textarea =
    document.createElement("textarea");

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
    embedded?.["wp:featuredmedia"]?.[0]
      ?.source_url ||
    "/image/crypto-placeholder.jpg"
  );
}

function getImageAlt(post: WordPressPost) {
  const embedded = (post as any)?._embedded;

  return (
    embedded?.["wp:featuredmedia"]?.[0]
      ?.alt_text ||
    stripHtml(post.title?.rendered || "") ||
    "Crypto news"
  );
}

function formatDate(date: string) {
  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ).format(new Date(date));
  } catch {
    return "";
  }
}

function preparePost(
  post: WordPressPost
): PreparedPost {
  return {
    id: post.id,

    slug: post.slug,

    title: stripHtml(
      post.title?.rendered || ""
    ),

    image: getImage(post),

    alt: getImageAlt(post),

    date: formatDate(post.date),

    excerpt: stripHtml(
      post.excerpt?.rendered || ""
    ),
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function CryptoNewsShowcase({
  posts,
}: CryptoNewsShowcaseProps) {
  const preparedPosts = useMemo(
    () =>
      posts
        .slice(0, 8)
        .map(preparePost),
    [posts]
  );

  const [activeIndex, setActiveIndex] =
    useState(0);

  /* =======================================================
     MOBILE SWIPE REFS
  ======================================================= */

  const touchStartX =
    useRef<number | null>(null);

  const touchStartY =
    useRef<number | null>(null);

  const touchCurrentX =
    useRef<number | null>(null);

  const horizontalSwipe =
    useRef(false);

  if (preparedPosts.length === 0) {
    return null;
  }

  /* =======================================================
     POST POSITIONS
  ======================================================= */

  const getIndex = (offset: number) => {
    return (
      (activeIndex +
        offset +
        preparedPosts.length) %
      preparedPosts.length
    );
  };

  const previousPost =
    preparedPosts[getIndex(-1)];

  const activePost =
    preparedPosts[activeIndex];

  const nextPost =
    preparedPosts[getIndex(1)];

  const fourthPost =
    preparedPosts[getIndex(2)];

  /* =======================================================
     PREVIOUS
  ======================================================= */

  function previous() {
    setActiveIndex((current) =>
      current === 0
        ? preparedPosts.length - 1
        : current - 1
    );
  }

  /* =======================================================
     NEXT
  ======================================================= */

  function next() {
    setActiveIndex(
      (current) =>
        (current + 1) %
        preparedPosts.length
    );
  }

  /* =======================================================
     MOBILE TOUCH SWIPE
  ======================================================= */

  function handleTouchStart(
    event: TouchEvent<HTMLDivElement>
  ) {
    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];

    touchStartX.current =
      touch.clientX;

    touchStartY.current =
      touch.clientY;

    touchCurrentX.current =
      touch.clientX;

    horizontalSwipe.current =
      false;
  }

  function handleTouchMove(
    event: TouchEvent<HTMLDivElement>
  ) {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      event.touches.length !== 1
    ) {
      return;
    }

    const touch = event.touches[0];

    touchCurrentX.current =
      touch.clientX;

    const deltaX =
      touch.clientX -
      touchStartX.current;

    const deltaY =
      touch.clientY -
      touchStartY.current;

    /*
     * Only treat the movement as
     * horizontal swipe when horizontal
     * movement is stronger than vertical.
     */
    if (
      Math.abs(deltaX) >
        Math.abs(deltaY) &&
      Math.abs(deltaX) > 8
    ) {
      horizontalSwipe.current =
        true;
    }
  }

  function handleTouchEnd() {
    if (
      touchStartX.current === null ||
      touchCurrentX.current === null
    ) {
      resetTouch();
      return;
    }

    const distance =
      touchCurrentX.current -
      touchStartX.current;

    const SWIPE_THRESHOLD = 45;

    if (
      horizontalSwipe.current &&
      Math.abs(distance) >=
        SWIPE_THRESHOLD
    ) {
      /*
       * Swipe LEFT
       * Show next story
       */
      if (distance < 0) {
        next();
      }

      /*
       * Swipe RIGHT
       * Show previous story
       */
      else {
        previous();
      }
    }

    resetTouch();
  }

  function handleTouchCancel() {
    resetTouch();
  }

  function resetTouch() {
    touchStartX.current = null;
    touchStartY.current = null;
    touchCurrentX.current = null;

    horizontalSwipe.current =
      false;
  }

  /* =========================================================
     JSX
  ========================================================= */

  return (
    <section className="cnx-section">
      <div className="cnx-shell">

        {/* =================================================
            LEFT SIDE
        ================================================= */}

        <div className="cnx-intro">

          <div className="cnx-kicker">
            <span className="cnx-kicker-dot" />

            DIGITAL ASSET NEWSROOM
          </div>

          <h2 className="cnx-title">
            Crypto
            <span> News</span>
          </h2>

          <p className="cnx-description">
            Breaking developments, market
            intelligence and the stories shaping
            Bitcoin, Ethereum, altcoins and the
            wider Web3 economy.
          </p>

          <Link
            href="/crypto-news/"
            className="cnx-view-all"
          >
            Explore Crypto News

            <ExternalLink
              size={16}
              strokeWidth={2}
            />
          </Link>

          {/* ===============================================
              DESKTOP / MANUAL CONTROLS
          =============================================== */}

          <div className="cnx-controls">

            <button
              type="button"
              className="cnx-control"
              onClick={previous}
              aria-label="Previous crypto story"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="cnx-counter">

              <strong>
                {String(
                  activeIndex + 1
                ).padStart(2, "0")}
              </strong>

              <span />

              <small>
                {String(
                  preparedPosts.length
                ).padStart(2, "0")}
              </small>

            </div>

            <button
              type="button"
              className="cnx-control"
              onClick={next}
              aria-label="Next crypto story"
            >
              <ArrowRight size={19} />
            </button>

          </div>

          {/* ===============================================
              PROGRESS DOTS
          =============================================== */}

          <div className="cnx-progress">

            {preparedPosts.map(
              (post, index) => (

                <button
                  key={post.id}
                  type="button"
                  aria-label={`Show story ${
                    index + 1
                  }`}
                  className={
                    index === activeIndex
                      ? "cnx-progress-dot cnx-progress-dot-active"
                      : "cnx-progress-dot"
                  }
                  onClick={() =>
                    setActiveIndex(index)
                  }
                />

              )
            )}

          </div>

        </div>

        {/* =================================================
            RIGHT 3D STAGE
            MOBILE FINGER SWIPE ENABLED
        ================================================= */}

        <div
          className="cnx-stage"
          onTouchStart={
            handleTouchStart
          }
          onTouchMove={
            handleTouchMove
          }
          onTouchEnd={
            handleTouchEnd
          }
          onTouchCancel={
            handleTouchCancel
          }
        >

          {/* BACKGROUND GLOW */}

          <div
            className="cnx-stage-glow"
            aria-hidden="true"
          />

          {/* ORBITS */}

          <div
            className="cnx-orbit cnx-orbit-one"
            aria-hidden="true"
          />

          <div
            className="cnx-orbit cnx-orbit-two"
            aria-hidden="true"
          />

          {/* =================================================
              BACK LEFT STORY
          ================================================= */}

          <article className="cnx-story cnx-story-back-left">

            <Link
              href={`/${previousPost.slug}/`}
              className="cnx-image-link"
            >

              <div className="cnx-image-frame">

                <img
                  src={previousPost.image}
                  alt={previousPost.alt}
                  draggable={false}
                />

                <div className="cnx-image-shine" />

              </div>

            </Link>

            <div className="cnx-story-copy">

              <span className="cnx-story-date">
                {previousPost.date}
              </span>

              <Link
                href={`/${previousPost.slug}/`}
              >
                <h3>
                  {previousPost.title}
                </h3>
              </Link>

            </div>

          </article>

          {/* =================================================
              MAIN ACTIVE STORY
          ================================================= */}

          <article className="cnx-story cnx-story-main">

            <Link
              href={`/${activePost.slug}/`}
              className="cnx-image-link"
            >

              <div className="cnx-image-frame">

                <img
                  src={activePost.image}
                  alt={activePost.alt}
                  draggable={false}
                />

                <div className="cnx-image-shine" />

                <span className="cnx-live-chip">
                  <i />
                  FEATURED
                </span>

              </div>

            </Link>

            <div className="cnx-story-copy cnx-story-copy-main">

              <div className="cnx-story-meta">

                <span>
                  CRYPTO NEWS
                </span>

                <span className="cnx-meta-line" />

                <time>
                  {activePost.date}
                </time>

              </div>

              <Link
                href={`/${activePost.slug}/`}
              >
                <h3>
                  {activePost.title}
                </h3>
              </Link>

              {activePost.excerpt && (

                <p>
                  {activePost.excerpt}
                </p>

              )}

              <Link
                href={`/${activePost.slug}/`}
                className="cnx-read-story"
              >
                Read Story

                <ArrowRight size={16} />

              </Link>

            </div>

          </article>

          {/* =================================================
              RIGHT STORY
          ================================================= */}

          <article className="cnx-story cnx-story-right">

            <Link
              href={`/${nextPost.slug}/`}
              className="cnx-image-link"
            >

              <div className="cnx-image-frame">

                <img
                  src={nextPost.image}
                  alt={nextPost.alt}
                  draggable={false}
                />

                <div className="cnx-image-shine" />

              </div>

            </Link>

            <div className="cnx-story-copy">

              <span className="cnx-story-date">
                {nextPost.date}
              </span>

              <Link
                href={`/${nextPost.slug}/`}
              >
                <h3>
                  {nextPost.title}
                </h3>
              </Link>

            </div>

          </article>

          {/* =================================================
              SMALL FLOATING STORY
          ================================================= */}

          {preparedPosts.length > 3 && (

            <article className="cnx-mini-story">

              <Link
                href={`/${fourthPost.slug}/`}
                className="cnx-mini-image"
              >

                <img
                  src={fourthPost.image}
                  alt={fourthPost.alt}
                  draggable={false}
                />

              </Link>

              <div>

                <span>
                  {fourthPost.date}
                </span>

                <Link
                  href={`/${fourthPost.slug}/`}
                >
                  <h4>
                    {fourthPost.title}
                  </h4>
                </Link>

              </div>

            </article>

          )}

          {/* =================================================
              NEXT BUTTON
          ================================================= */}

          <button
            type="button"
            className="cnx-stage-next"
            onClick={next}
            aria-label="Next crypto story"
          >
            <ArrowRight size={22} />
          </button>

        </div>

      </div>
    </section>
  );
}