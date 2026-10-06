"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
} from "lucide-react";

import {
  useRef,
  useState,
} from "react";

import {
  WordPressPost,
  getFeaturedImage,
  getFeaturedImageAlt,
  stripHtml,
  formatPostDate,
} from "../lib/wordpress";

/* =========================================================
   TYPES
========================================================= */

type PressReleaseCarouselProps = {
  posts: WordPressPost[];
};

type PressReleaseItem = {
  id: number;
  href: string;
  title: string;
  image: string | null | undefined;
  imageAlt: string;
  date: string;
};

/* =========================================================
   PREPARE WORDPRESS POST
========================================================= */

function preparePost(
  post: WordPressPost
): PressReleaseItem {
  const title = stripHtml(
    post.title.rendered
  );

  return {
    id: post.id,

    href: `/${post.slug}/`,

    title,

    image: getFeaturedImage(post),

    imageAlt:
      getFeaturedImageAlt(post) ||
      title,

    date:
      formatPostDate(post.date),
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function PressReleaseCarousel({
  posts,
}: PressReleaseCarouselProps) {
  const releases = posts
    .slice(0, 7)
    .map(preparePost);

  const [activeIndex, setActiveIndex] =
    useState(0);

  /*
   * Swipe tracking.
   *
   * Refs are used instead of state because
   * we do not need React to re-render while
   * the finger is moving.
   */
  const touchStartX =
    useRef<number | null>(null);

  const touchStartY =
    useRef<number | null>(null);

  const touchCurrentX =
    useRef<number | null>(null);

  const isHorizontalSwipe =
    useRef(false);

  if (!releases.length) {
    return null;
  }

  /* =======================================================
     PREVIOUS
  ======================================================= */

  function previousRelease() {
    setActiveIndex((current) =>
      current === 0
        ? releases.length - 1
        : current - 1
    );
  }

  /* =======================================================
     NEXT
  ======================================================= */

  function nextRelease() {
    setActiveIndex((current) =>
      current ===
      releases.length - 1
        ? 0
        : current + 1
    );
  }

  /* =======================================================
     CARD POSITION
  ======================================================= */

  function getPosition(
    index: number
  ) {
    let difference =
      index - activeIndex;

    const total =
      releases.length;

    if (
      difference >
      total / 2
    ) {
      difference -= total;
    }

    if (
      difference <
      -total / 2
    ) {
      difference += total;
    }

    if (difference === 0) {
      return "active";
    }

    if (difference === -1) {
      return "left-one";
    }

    if (difference === 1) {
      return "right-one";
    }

    if (difference === -2) {
      return "left-two";
    }

    if (difference === 2) {
      return "right-two";
    }

    return "hidden";
  }

  /* =======================================================
     MOBILE SWIPE
  ======================================================= */

  function handleTouchStart(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    if (
      event.touches.length !== 1
    ) {
      return;
    }

    const touch =
      event.touches[0];

    touchStartX.current =
      touch.clientX;

    touchStartY.current =
      touch.clientY;

    touchCurrentX.current =
      touch.clientX;

    isHorizontalSwipe.current =
      false;
  }

  function handleTouchMove(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    if (
      touchStartX.current ===
        null ||
      touchStartY.current ===
        null ||
      event.touches.length !== 1
    ) {
      return;
    }

    const touch =
      event.touches[0];

    touchCurrentX.current =
      touch.clientX;

    const differenceX =
      touch.clientX -
      touchStartX.current;

    const differenceY =
      touch.clientY -
      touchStartY.current;

    /*
     * Only consider this a carousel
     * gesture when horizontal movement
     * is stronger than vertical movement.
     *
     * This allows normal page scrolling
     * up and down.
     */
    if (
      Math.abs(differenceX) >
        Math.abs(differenceY) &&
      Math.abs(differenceX) > 8
    ) {
      isHorizontalSwipe.current =
        true;
    }
  }

  function handleTouchEnd() {
    if (
      touchStartX.current ===
        null ||
      touchCurrentX.current ===
        null
    ) {
      resetTouch();
      return;
    }

    const distance =
      touchCurrentX.current -
      touchStartX.current;

    /*
     * Require a reasonable finger
     * movement before changing cards.
     *
     * This prevents ordinary taps on
     * article links from becoming swipes.
     */
    const SWIPE_THRESHOLD = 45;

    if (
      isHorizontalSwipe.current &&
      Math.abs(distance) >=
        SWIPE_THRESHOLD
    ) {
      if (distance < 0) {
        /*
         * Finger moved right -> left.
         * Show next article.
         */
        nextRelease();
      } else {
        /*
         * Finger moved left -> right.
         * Show previous article.
         */
        previousRelease();
      }
    }

    resetTouch();
  }

  function handleTouchCancel() {
    resetTouch();
  }

  function resetTouch() {
    touchStartX.current =
      null;

    touchStartY.current =
      null;

    touchCurrentX.current =
      null;

    isHorizontalSwipe.current =
      false;
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <section
      className="pr3d-section"
      aria-label="Press Releases"
    >
      {/* ===================================================
          SECTION HEADER
      ==================================================== */}

      <div className="pr3d-heading">
        <div>
          <span className="pr3d-label">
            OFFICIAL ANNOUNCEMENTS
          </span>

          <h2>
            Press Releases
          </h2>

          <p>
            Latest announcements,
            launches, partnerships and
            ecosystem updates from the
            blockchain industry.
          </p>
        </div>

        <Link
          href="/press-release/"
          className="pr3d-view-all"
        >
          View All

          <ArrowRight
            size={16}
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* ===================================================
          3D STAGE + TOUCH SWIPE
      ==================================================== */}

      <div
        className="pr3d-stage"
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
        {/* Decorative background */}

        <div
          className="pr3d-orbit pr3d-orbit-one"
          aria-hidden="true"
        />

        <div
          className="pr3d-orbit pr3d-orbit-two"
          aria-hidden="true"
        />

        <div
          className="pr3d-glow"
          aria-hidden="true"
        />

        {/* =================================================
            CARDS
        ================================================== */}

        <div className="pr3d-cards">
          {releases.map(
            (
              release,
              index
            ) => {
              const position =
                getPosition(
                  index
                );

              const isActive =
                position ===
                "active";

              return (
                <article
                  key={
                    release.id
                  }
                  className={`pr3d-card pr3d-${position}`}
                  aria-hidden={
                    position ===
                    "hidden"
                  }
                >
                  <Link
                    href={
                      release.href
                    }
                    className="pr3d-card-link"
                    tabIndex={
                      position ===
                      "hidden"
                        ? -1
                        : 0
                    }
                  >
                    {/* IMAGE */}

                    <div className="pr3d-image">
                      {release.image ? (
                        <img
                          src={
                            release.image
                          }
                          alt={
                            release.imageAlt
                          }
                          loading={
                            isActive
                              ? "eager"
                              : "lazy"
                          }
                          draggable={
                            false
                          }
                        />
                      ) : (
                        <div className="pr3d-placeholder">
                          CoinlytX
                        </div>
                      )}

                      <div
                        className="pr3d-image-overlay"
                        aria-hidden="true"
                      />

                      <span className="pr3d-badge">
                        PRESS RELEASE
                      </span>
                    </div>

                    {/* CONTENT */}

                    <div className="pr3d-content">
                      <div className="pr3d-date">
                        <CalendarDays
                          size={12}
                          aria-hidden="true"
                        />

                        {
                          release.date
                        }
                      </div>

                      <h3>
                        {
                          release.title
                        }
                      </h3>

                      <div className="pr3d-read">
                        Read Press
                        Release

                        <ArrowRight
                          size={15}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Link>
                </article>
              );
            }
          )}
        </div>

        {/* =================================================
            NAVIGATION
        ================================================== */}

        <button
          type="button"
          className="pr3d-control pr3d-prev"
          onClick={
            previousRelease
          }
          aria-label="Previous press release"
        >
          <ArrowLeft
            size={20}
          />
        </button>

        <button
          type="button"
          className="pr3d-control pr3d-next"
          onClick={
            nextRelease
          }
          aria-label="Next press release"
        >
          <ArrowRight
            size={20}
          />
        </button>
      </div>

      {/* ===================================================
          PAGINATION DOTS
      ==================================================== */}

      <div
        className="pr3d-pagination"
        aria-label="Press release carousel navigation"
      >
        {releases.map(
          (
            release,
            index
          ) => (
            <button
              type="button"
              key={
                release.id
              }
              className={
                index ===
                activeIndex
                  ? "pr3d-dot pr3d-dot-active"
                  : "pr3d-dot"
              }
              onClick={() =>
                setActiveIndex(
                  index
                )
              }
              aria-label={`Show press release ${
                index + 1
              }`}
            />
          )
        )}
      </div>
    </section>
  );
}