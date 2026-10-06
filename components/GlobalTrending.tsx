"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

import GlobalTrendingGlobe, {
  type TrendingRegion,
} from "./GlobalTrendingGlobe";

import {
  type WordPressPost,
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

export default function GlobalTrending({
  posts,
}: GlobalTrendingProps) {
  const stories = useMemo(
    () => posts.slice(0, 20).map(preparePost),
    [posts]
  );

  const [activeRegion, setActiveRegion] =
    useState<TrendingRegion>("global");

  if (!stories.length) {
    return null;
  }

  const regionStories =
    activeRegion === "global"
      ? stories
      : stories.filter(
          (story) => story.region === activeRegion
        );

  /*
   * If there aren't enough region-specific stories,
   * fill the remaining positions with other recent stories.
   */
  const primaryStories =
    regionStories.length > 0 ? regionStories : stories;

  const storyIds = new Set(primaryStories.map((story) => story.id));

  const fallbackStories = stories.filter(
    (story) => !storyIds.has(story.id)
  );

  const visibleStories = [
    ...primaryStories,
    ...fallbackStories,
  ].slice(0, 5);

  function selectRegion(region: TrendingRegion) {
    setActiveRegion(region);
  }

  return (
    <section
      className="gt-section"
      aria-labelledby="global-trending-title"
    >
      {/* HEADER */}

      <div className="gt-header">
        <h2 id="global-trending-title">
          Global <span>Trending</span>
        </h2>

        <Link
          href="/global-trending/"
          className="gt-view-all"
        >
          View All
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {/* CONTENT */}

      <div className="gt-panel">
        {/* GLOBE */}

        <div className="gt-globe-column">
          <GlobalTrendingGlobe
            activeRegion={activeRegion}
            onRegionChange={selectRegion}
          />

          <div className="gt-region-status">
            <span className="gt-region-status-dot" />

            <div>
              <span>Trending Region</span>

              <strong>
                {REGION_LABELS[activeRegion]}
              </strong>
            </div>
          </div>
        </div>

        {/* STORIES */}

        <div className="gt-stories">
          <div className="gt-stories-heading">
            <h3>
              {REGION_LABELS[activeRegion]} Stories
            </h3>

            <span className="gt-stories-line" />
          </div>

          <div className="gt-story-list">
            {visibleStories.map((story, index) => (
              <article
                key={story.id}
                className="gt-story-card"
              >
                <span className="gt-story-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <Link
                  href={story.href}
                  className="gt-story-image"
                  aria-label={story.title}
                >
                  {story.image ? (
                    <img
                      src={story.image}
                      alt={story.imageAlt}
                      loading={index < 2 ? "eager" : "lazy"}
                    />
                  ) : (
                    <span className="gt-story-image-fallback">
                      CX
                    </span>
                  )}
                </Link>

                <div className="gt-story-content">
                  <div className="gt-story-meta">
                    <span>
                      {REGION_LABELS[story.region]}
                    </span>

                    <span className="gt-story-meta-separator">
                      •
                    </span>

                    <span>
                      <CalendarDays
                        size={11}
                        aria-hidden="true"
                      />

                      {story.date}
                    </span>
                  </div>

                  <h4>
                    <Link href={story.href}>
                      {story.title}
                    </Link>
                  </h4>

                  <Link
                    href={story.href}
                    className="gt-story-read"
                  >
                    Read Story
                    <ArrowRight
                      size={12}
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}