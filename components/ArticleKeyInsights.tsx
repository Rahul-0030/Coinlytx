"use client";

import { useEffect, useRef, useState } from "react";

type ArticleKeyInsightsProps = {
  insights: string[];
};

export default function ArticleKeyInsights({
  insights,
}: ArticleKeyInsightsProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = sectionRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.18,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const items = insights.slice(0, 3);

  if (!items.length) return null;

  return (
    <section
      ref={sectionRef}
      className={`article-insights ${
        visible ? "article-insights-visible" : ""
      }`}
      aria-labelledby="key-insights-heading"
    >
      <div className="article-insights-glow" />

      <div className="article-insights-header">
        <div className="article-insights-title">
          <span
            className="article-insights-spark"
            aria-hidden="true"
          >
            ✦
          </span>

          <h2 id="key-insights-heading">
            Key Insights
          </h2>
        </div>

        <span className="article-insights-label">
          QUICK TAKEAWAYS
        </span>
      </div>

      <div className="article-insights-progress">
        <span />
      </div>

      <div className="article-insights-grid">
        {items.map((insight, index) => (
          <article
            className="article-insight-card"
            key={`${index}-${insight}`}
            style={
              {
                "--insight-delay": `${index * 170}ms`,
              } as React.CSSProperties
            }
          >
            <div className="article-insight-number">
              {String(index + 1).padStart(2, "0")}
            </div>

            <p>{insight}</p>

            <div
              className="article-insight-line"
              aria-hidden="true"
            />
          </article>
        ))}
      </div>
    </section>
  );
}