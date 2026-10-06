"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { useMemo, useState } from "react";

import GlobalTrendingGlobe, {
  TrendingRegion,
} from "./GlobalTrendingGlobe";

import {
  WordPressPost,
  getFeaturedImage,
  getFeaturedImageAlt,
  stripHtml,
  formatPostDate,
} from "../lib/wordpress";

type GlobalTrendingProps = {
  posts: WordPressPost[];
};

type TrendingItem = {
  id: number;
  title: string;
  href: string;
  image: string | null | undefined;
  imageAlt: string;
  date: string;
  region: TrendingRegion;
};

const REGION_LABELS: Record<TrendingRegion, string> = {
  global: "Global",
  america: "America",
  europe: "Europe",
  asia: "Asia",
  "middle-east": "Middle East",
  africa: "Africa",
};

/* =========================================================
   DETECT ARTICLE REGION
========================================================= */

function detectRegion(title: string): TrendingRegion {
  const text = ` ${title.toLowerCase()} `;

  if (
    text.includes("america") ||
    text.includes("american") ||
    text.includes("united states") ||
    text.includes("u.s.") ||
    text.includes(" usa ") ||
    text.includes("washington") ||
    text.includes("wall street") ||
    text.includes("nasdaq") ||
    text.includes("canada") ||
    text.includes("mexico") ||
    text.includes("sec ")
  ) {
    return "america";
  }

  if (
    text.includes("europe") ||
    text.includes("european") ||
    text.includes("ecb") ||
    text.includes("britain") ||
    text.includes("british") ||
    text.includes("london") ||
    text.includes("germany") ||
    text.includes("france") ||
    text.includes("italy") ||
    text.includes("spain") ||
    text.includes("switzerland")
  ) {
    return "europe";
  }

  if (
    text.includes("middle east") ||
    text.includes("uae") ||
    text.includes("dubai") ||
    text.includes("saudi") ||
    text.includes("qatar") ||
    text.includes("israel") ||
    text.includes("iran") ||
    text.includes("turkey")
  ) {
    return "middle-east";
  }

  if (
    text.includes("africa") ||
    text.includes("african") ||
    text.includes("nigeria") ||
    text.includes("kenya") ||
    text.includes("egypt") ||
    text.includes("south africa")
  ) {
    return "africa";
  }

  if (
    text.includes("asia") ||
    text.includes("asian") ||
    text.includes("india") ||
    text.includes("china") ||
    text.includes("japan") ||
    text.includes("korea") ||
    text.includes("singapore") ||
    text.includes("hong kong") ||
    text.includes("indonesia") ||
    text.includes("pakistan")
  ) {
    return "asia";
  }

  return "global";
}

/* =========================================================
   PREPARE WORDPRESS POST
========================================================= */

function preparePost(post: WordPressPost): TrendingItem {
  const title = stripHtml(post.title.rendered);

  return {
    id: post.id,
    title,
    href: `/${post.slug}/`,
    image: getFeaturedImage(post),
    imageAlt: getFeaturedImageAlt(post) || title,
    date: formatPostDate(post.date),
    region: detectRegion(title),
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function GlobalTrending({
  posts,
}: GlobalTrendingProps) {
  const stories = useMemo(
    () => posts.slice(0, 20).map(preparePost),
    [posts]
  );

  const [activeRegion, setActiveRegion] =
    useState<TrendingRegion>("global");

  const [activeIndex, setActiveIndex] = useState(0);

  if (!stories.length) {
    return null;
  }

  /* =======================================================
     REGION FILTER
  ======================================================= */

  const regionStories =
    activeRegion === "global"
      ? stories
      : stories.filter(
          (story) => story.region === activeRegion
        );

  /*
    If a region currently has no detected stories,
    keep the panel populated with Global Trending stories.
  */
  const displayStories =
    regionStories.length > 0 ? regionStories : stories;

  const visibleStories = Array.from(
    {
      length: Math.min(5, displayStories.length),
    },
    (_, offset) =>
      displayStories[
        (activeIndex + offset) % displayStories.length
      ]
  );

  /* =======================================================
     GLOBE REGION CLICK
  ======================================================= */

  function selectRegion(region: TrendingRegion) {
    setActiveRegion(region);
    setActiveIndex(0);
  }

  function nextStory() {
    setActiveIndex(
      (current) =>
        (current + 1) % displayStories.length
    );
  }

  function previousStory() {
    setActiveIndex((current) =>
      current === 0
        ? displayStories.length - 1
        : current - 1
    );
  }

  return (
    <section
      className="gt3d-section"
      aria-label="Global Trending"
    >
      {/* ===================================================
          HEADER
      ==================================================== */}

      <div className="gt3d-header">
        <div className="gt3d-title-wrap">
          <span
            className="gt3d-title-line"
            aria-hidden="true"
          />

          <h2>
            Global <span>Trending</span>
          </h2>
        </div>

        <Link
          href="/global-trending/"
          className="gt3d-view-all"
        >
          View All
          <ArrowRight size={17} />
        </Link>
      </div>

      {/* ===================================================
          MAIN SECTION
      ==================================================== */}

      <div className="gt3d-layout">
        {/* =================================================
            INTERACTIVE GLOBE

            NO Global / America / Europe buttons here.
            Selection happens directly from the globe.
        ================================================== */}

        <div className="gt3d-world">
          <GlobalTrendingGlobe
            activeRegion={activeRegion}
            onRegionChange={selectRegion}
          />

          {/* Selected region indicator */}

          <div className="gt-active-region">
            <span className="gt-active-region-dot" />

            <div>
              <small>TRENDING REGION</small>

              <strong>
                {REGION_LABELS[activeRegion]}
              </strong>
            </div>
          </div>

          {/* Previous */}

          <button
            type="button"
            className="gt3d-world-control gt3d-world-prev"
            onClick={previousStory}
            aria-label="Previous trending story"
          >
            <ArrowLeft size={21} />
          </button>

          {/* Next */}

          <button
            type="button"
            className="gt3d-world-control gt3d-world-next"
            onClick={nextStory}
            aria-label="Next trending story"
          >
            <ArrowRight size={21} />
          </button>
        </div>

        {/* =================================================
            RIGHT NEWS PANEL
        ================================================== */}

        <div className="gt3d-ranking">
          <div className="gt-ranking-heading">
            <div>
              <span>LIVE TRENDING</span>

              <strong>
                {REGION_LABELS[activeRegion]}
              </strong>
            </div>

            <span className="gt-live-indicator">
              <i />
              LIVE
            </span>
          </div>

          {visibleStories.map((story, index) => (
            <article
              className="gt3d-ranking-card"
              key={`${story.id}-${index}`}
            >
              {/* Ranking number */}

              <span className="gt3d-rank">
                {index + 1}
              </span>

              {/* Featured image */}

              <Link
                href={story.href}
                className="gt3d-rank-image"
                aria-label={story.title}
              >
                {story.image ? (
                  <img
                    src={story.image}
                    alt={story.imageAlt}
                    loading="lazy"
                  />
                ) : (
                  <div className="gt3d-image-placeholder">
                    CoinlytX
                  </div>
                )}
              </Link>

              {/* Story information */}

              <div className="gt3d-rank-content">
                <div className="gt3d-rank-meta">
                  <span className="gt3d-rank-badge">
                    {story.region === "global"
                      ? "Trending"
                      : REGION_LABELS[story.region]}
                  </span>

                  <span className="gt3d-rank-date">
                    <CalendarDays size={12} />
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
                className="gt3d-story-arrow"
                aria-label={`Read ${story.title}`}
              >
                <ArrowRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      </div>

      {/* ===================================================
          STORY POSITION DOTS
      ==================================================== */}

      <div className="gt3d-dots">
        {displayStories
          .slice(0, 8)
          .map((story, index) => (
            <button
              type="button"
              key={`dot-${story.id}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show story ${index + 1}`}
              className={
                index === activeIndex
                  ? "gt3d-dot gt3d-dot-active"
                  : "gt3d-dot"
              }
            />
          ))}
      </div>
    </section>
  );
}