"use client";

import { ArrowRight, BarChart3, Bolt } from "lucide-react";
import { useEffect, useState } from "react";

type HeroPost = {
  id: number;
  slug: string;
  title: {
    rendered: string;
  };
};

function cleanText(text: string) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Hero3D() {
  const [posts, setPosts] = useState<HeroPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadBreakingNews() {
      try {
        const response = await fetch(
          "https://coinlytx.com/wp-json/wp/v2/posts?per_page=5",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `WordPress request failed: ${response.status}`
          );
        }

        const data = (await response.json()) as HeroPost[];

        if (active) {
          setPosts(data);
        }
      } catch (error) {
        console.error("Unable to load breaking news:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBreakingNews();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="cinematic-hero">

      {/* =========================================
          FULL-WIDTH BITCOIN BACKGROUND
      ========================================== */}

      <div
        className="cinematic-space-art"
        aria-hidden="true"
      />

      {/* LEFT-SIDE READABILITY GRADIENT */}

      <div
        className="cinematic-hero-shade"
        aria-hidden="true"
      />

      {/* SUBTLE LIGHT EFFECT */}

      <div
        className="cinematic-space-light"
        aria-hidden="true"
      />

      {/* ANIMATED PARTICLES */}

      <div
        className="cinematic-space-particles"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* =========================================
          MAIN CONTENT
      ========================================== */}

      <div className="cinematic-hero-inner">

        {/* LEFT */}

        <div className="cinematic-hero-copy">

          <div className="cinematic-eyebrow">
            <span className="cinematic-dot" />
            GLOBAL CRYPTO NEWS
          </div>

          <h1>
            The Global
            <br />
            Crypto News
            <br />
            <span>Hub</span>
          </h1>

          <p>
            Real News. Real Markets. Real Web3.
          </p>

          <div className="cinematic-hero-actions">

            <a
              href="/crypto-news/"
              className="cinematic-primary-button"
            >
              Explore News
              <ArrowRight size={18} />
            </a>

            <a
              href="/crypto-prices/"
              className="cinematic-secondary-button"
            >
              <BarChart3 size={19} />
              View Markets
            </a>

          </div>

        </div>

        {/* CENTER
            This is intentionally empty.
            It reserves space for the Bitcoin
            visible in the background.
        */}

        <div
          className="cinematic-bitcoin-space"
          aria-hidden="true"
        />

        {/* RIGHT */}

        <aside className="cinematic-breaking">

          <div className="cinematic-breaking-header">

            <div className="cinematic-breaking-icon">
              <Bolt
                size={19}
                fill="currentColor"
              />
            </div>

            <strong>BREAKING NEWS</strong>

          </div>

          <div className="cinematic-breaking-line" />

          <div className="cinematic-breaking-list">

            {loading ? (
              <BreakingSkeleton />
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <a
                  key={post.id}
                  href={`/${post.slug}/`}
                  className="cinematic-breaking-story"
                >
                  {cleanText(post.title.rendered)}
                </a>
              ))
            ) : (
              <div className="cinematic-breaking-empty">
                Latest news temporarily unavailable.
              </div>
            )}

          </div>

          <a
            href="/crypto-news/"
            className="cinematic-breaking-view"
          >
            View All Breaking News
            <ArrowRight size={17} />
          </a>

        </aside>

      </div>

    </section>
  );
}

function BreakingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="cinematic-breaking-skeleton"
        />
      ))}
    </>
  );
}