"use client";

import { useState } from "react";

type AnalysisResult = {
  success: boolean;
  error?: string;
  fetchedUrl?: string;

  article?: {
    title: string;
    metaDescription: string;
    canonical: string;

    robots: {
      robots: string;
      googlebot: string;
      noindex: boolean;
    };

    wordCount: number;

    headings: {
      h1: string[];
      h2: string[];
      h3: string[];
    };

    links: {
      internalCount: number;
      externalCount: number;

      internal: {
        url: string;
        anchor: string;
      }[];

      external: {
        url: string;
        anchor: string;
      }[];
    };

    images: {
      total: number;
      missingAltCount: number;
      missingAlt?: {
        src: string;
        alt: string;
        missingAlt: boolean;
      }[];
    };
  };

  scores?: {
    indexReadiness: number;
    seo: number;
    contentQuality: number;
    internalLinks: number;
    technicalSEO: number;
  };

  checks?: {
    criticalIssues: string[];
    improvements: string[];
    passedChecks: string[];
  };
};

type ScoreCardProps = {
  title: string;
  score: number;
};

function getScoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Work";
  return "Poor";
}

function getScoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function ScoreCard({ title, score }: ScoreCardProps) {
  const color = getScoreColor(score);

  return (
    <div style={styles.scoreCard}>
      <div style={styles.scoreTop}>
        <span style={styles.scoreTitle}>{title}</span>

        <span style={styles.scoreValue}>
          {score}/100
        </span>
      </div>

      <div style={styles.progressBackground}>
        <div
          style={{
            ...styles.progressBar,
            width: `${score}%`,
            background: color,
          }}
        />
      </div>

      <span
        style={{
          ...styles.statusText,
          color,
        }}
      >
        {getScoreLabel(score)}
      </span>
    </div>
  );
}

function StatCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div style={styles.statCard}>
      <strong style={styles.statValue}>
        {value}
      </strong>

      <span style={styles.statLabel}>
        {label}
      </span>
    </div>
  );
}

export default function SEODashboard() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] =
    useState<AnalysisResult | null>(null);

  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError("Please enter an article URL.");
      return;
    }

    try {
      new URL(cleanUrl);
    } catch {
      setError(
        "Please enter a valid URL beginning with http:// or https://"
      );
      return;
    }

    try {
      setAnalyzing(true);
      setResult(null);
      setError("");

      const response = await fetch(
        "/api/seo/analyze",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            url: cleanUrl,
          }),
        }
      );

      let data: AnalysisResult;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The SEO API returned an invalid response."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            `Analysis failed. HTTP ${response.status}`
        );
      }

      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Something went wrong while analyzing the article."
        );
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const article = result?.article;
  const scores = result?.scores;
  const checks = result?.checks;

  const hasResults =
    result?.success &&
    article &&
    scores &&
    checks;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}

        <header style={styles.header}>
          <div>
            <div style={styles.adminBadge}>
              COINLYTX ADMIN
            </div>

            <h1 style={styles.heading}>
              AI SEO & Indexing Agent
            </h1>

            <p style={styles.subheading}>
              Analyze Coinlytx articles for SEO,
              content quality, internal links,
              metadata and indexing signals.
            </p>
          </div>

          <div style={styles.privateBadge}>
            Private Tool
          </div>
        </header>

        {/* URL ANALYZER */}

        <section style={styles.analyzer}>
          <label style={styles.label}>
            Article URL
          </label>

          <div style={styles.inputRow}>
            <input
              type="url"
              value={url}
              placeholder="https://coinlytx.com/article-url/"
              onChange={(event) =>
                setUrl(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !analyzing
                ) {
                  handleAnalyze();
                }
              }}
              style={styles.input}
            />

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{
                ...styles.button,

                opacity: analyzing
                  ? 0.65
                  : 1,

                cursor: analyzing
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {analyzing
                ? "Analyzing..."
                : "Analyze Article"}
            </button>
          </div>

          <p style={styles.helperText}>
            Live page analysis checks metadata,
            headings, links, images and basic
            indexing signals.
          </p>

          {error && (
            <div style={styles.errorBox}>
              <strong>
                Analysis failed
              </strong>

              <span style={styles.errorText}>
                {error}
              </span>
            </div>
          )}
        </section>

        {/* EMPTY STATE */}

        {!analyzing && !hasResults && (
          <section style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              ◎
            </div>

            <h2 style={styles.emptyTitle}>
              Ready to analyze an article
            </h2>

            <p style={styles.emptyText}>
              Paste an individual Coinlytx
              article URL above and click
              Analyze Article.
            </p>
          </section>
        )}

        {/* LOADING */}

        {analyzing && (
          <section style={styles.emptyState}>
            <div style={styles.loader}>
              ●
            </div>

            <h2 style={styles.emptyTitle}>
              Analyzing article...
            </h2>

            <p style={styles.emptyText}>
              Fetching the page and checking
              SEO signals.
            </p>
          </section>
        )}

        {/* REAL RESULTS */}

        {hasResults && (
          <>
            {/* SEO OVERVIEW */}

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>
                    LIVE ARTICLE REPORT
                  </p>

                  <h2 style={styles.sectionTitle}>
                    SEO Health Overview
                  </h2>
                </div>

                <span style={styles.liveBadge}>
                  LIVE ANALYSIS
                </span>
              </div>

              <div style={styles.scoreGrid}>
                <ScoreCard
                  title="Index Readiness"
                  score={
                    scores.indexReadiness
                  }
                />

                <ScoreCard
                  title="SEO"
                  score={scores.seo}
                />

                <ScoreCard
                  title="Content Quality"
                  score={
                    scores.contentQuality
                  }
                />

                <ScoreCard
                  title="Internal Links"
                  score={
                    scores.internalLinks
                  }
                />

                <ScoreCard
                  title="Technical SEO"
                  score={
                    scores.technicalSEO
                  }
                />
              </div>

              {/* ARTICLE INFORMATION */}

              <div style={styles.articleInfo}>
                <span style={styles.infoLabel}>
                  ANALYZED ARTICLE
                </span>

                <h3 style={styles.articleTitle}>
                  {article.title ||
                    "No title detected"}
                </h3>

                <p style={styles.articleUrl}>
                  {result?.fetchedUrl || url}
                </p>

                {article.metaDescription && (
                  <p
                    style={
                      styles.metaDescription
                    }
                  >
                    {
                      article.metaDescription
                    }
                  </p>
                )}
              </div>

              {/* STATS */}

              <div style={styles.statsGrid}>
                <StatCard
                  value={article.wordCount}
                  label="Page Words"
                />

                <StatCard
                  value={
                    article.headings.h1
                      .length
                  }
                  label="H1"
                />

                <StatCard
                  value={
                    article.headings.h2
                      .length
                  }
                  label="H2"
                />

                <StatCard
                  value={
                    article.headings.h3
                      .length
                  }
                  label="H3"
                />

                <StatCard
                  value={
                    article.links
                      .internalCount
                  }
                  label="Internal Links"
                />

                <StatCard
                  value={
                    article.links
                      .externalCount
                  }
                  label="External Links"
                />

                <StatCard
                  value={
                    article.images.total
                  }
                  label="Images"
                />

                <StatCard
                  value={
                    article.images
                      .missingAltCount
                  }
                  label="Missing ALT"
                />
              </div>
            </section>

            {/* INDEX SIGNALS */}

            <section style={styles.section}>
              <p style={styles.eyebrow}>
                INDEXING SIGNALS
              </p>

              <h2 style={styles.sectionTitle}>
                Crawl & Page Signals
              </h2>

              <div style={styles.signalGrid}>
                <div style={styles.signalCard}>
                  <span
                    style={styles.signalLabel}
                  >
                    Canonical
                  </span>

                  <strong
                    style={
                      article.canonical
                        ? styles.signalGood
                        : styles.signalWarning
                    }
                  >
                    {article.canonical
                      ? "Detected"
                      : "Missing"}
                  </strong>

                  {article.canonical && (
                    <span
                      style={
                        styles.signalValue
                      }
                    >
                      {article.canonical}
                    </span>
                  )}
                </div>

                <div style={styles.signalCard}>
                  <span
                    style={styles.signalLabel}
                  >
                    Noindex
                  </span>

                  <strong
                    style={
                      article.robots
                        .noindex
                        ? styles.signalBad
                        : styles.signalGood
                    }
                  >
                    {article.robots.noindex
                      ? "YES"
                      : "NO"}
                  </strong>
                </div>

                <div style={styles.signalCard}>
                  <span
                    style={styles.signalLabel}
                  >
                    Meta Description
                  </span>

                  <strong
                    style={
                      article
                        .metaDescription
                        ? styles.signalGood
                        : styles.signalWarning
                    }
                  >
                    {article
                      .metaDescription
                      ? "Detected"
                      : "Missing"}
                  </strong>
                </div>

                <div style={styles.signalCard}>
                  <span
                    style={styles.signalLabel}
                  >
                    HTTPS
                  </span>

                  <strong
                    style={
                      (
                        result?.fetchedUrl ||
                        url
                      ).startsWith(
                        "https://"
                      )
                        ? styles.signalGood
                        : styles.signalBad
                    }
                  >
                    {(
                      result?.fetchedUrl ||
                      url
                    ).startsWith(
                      "https://"
                    )
                      ? "Enabled"
                      : "Not detected"}
                  </strong>
                </div>
              </div>
            </section>

            {/* ISSUES */}

            <section style={styles.issueColumns}>
              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>
                  🔴 Critical Issues
                </h3>

                {checks.criticalIssues
                  .length > 0 ? (
                  checks.criticalIssues.map(
                    (issue, index) => (
                      <div
                        key={`critical-${index}`}
                        style={styles.issue}
                      >
                        {issue}
                      </div>
                    )
                  )
                ) : (
                  <div style={styles.issue}>
                    No critical page-level
                    issues detected.
                  </div>
                )}
              </div>

              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>
                  🟠 Improvements
                </h3>

                {checks.improvements.length >
                0 ? (
                  checks.improvements.map(
                    (issue, index) => (
                      <div
                        key={`improvement-${index}`}
                        style={styles.issue}
                      >
                        {issue}
                      </div>
                    )
                  )
                ) : (
                  <div style={styles.issue}>
                    No basic improvements
                    detected.
                  </div>
                )}
              </div>

              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>
                  🟢 Passed Checks
                </h3>

                {checks.passedChecks.length >
                0 ? (
                  checks.passedChecks.map(
                    (check, index) => (
                      <div
                        key={`passed-${index}`}
                        style={styles.issue}
                      >
                        {check}
                      </div>
                    )
                  )
                ) : (
                  <div style={styles.issue}>
                    No passed checks were
                    returned.
                  </div>
                )}
              </div>
            </section>

            {/* HEADINGS */}

            <section style={styles.section}>
              <p style={styles.eyebrow}>
                PAGE STRUCTURE
              </p>

              <h2 style={styles.sectionTitle}>
                Headings Detected
              </h2>

              <div style={styles.headingColumns}>
                <div style={styles.headingBox}>
                  <h3 style={styles.headingBoxTitle}>
                    H1
                  </h3>

                  {article.headings.h1
                    .length > 0 ? (
                    article.headings.h1.map(
                      (heading, index) => (
                        <div
                          key={`h1-${index}`}
                          style={
                            styles.headingItem
                          }
                        >
                          {heading}
                        </div>
                      )
                    )
                  ) : (
                    <div
                      style={
                        styles.headingEmpty
                      }
                    >
                      No H1 detected
                    </div>
                  )}
                </div>

                <div style={styles.headingBox}>
                  <h3 style={styles.headingBoxTitle}>
                    H2
                  </h3>

                  {article.headings.h2
                    .length > 0 ? (
                    article.headings.h2.map(
                      (heading, index) => (
                        <div
                          key={`h2-${index}`}
                          style={
                            styles.headingItem
                          }
                        >
                          {heading}
                        </div>
                      )
                    )
                  ) : (
                    <div
                      style={
                        styles.headingEmpty
                      }
                    >
                      No H2 detected
                    </div>
                  )}
                </div>

                <div style={styles.headingBox}>
                  <h3 style={styles.headingBoxTitle}>
                    H3
                  </h3>

                  {article.headings.h3
                    .length > 0 ? (
                    article.headings.h3.map(
                      (heading, index) => (
                        <div
                          key={`h3-${index}`}
                          style={
                            styles.headingItem
                          }
                        >
                          {heading}
                        </div>
                      )
                    )
                  ) : (
                    <div
                      style={
                        styles.headingEmpty
                      }
                    >
                      No H3 detected
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* FUTURE MODULES */}

            <section style={styles.section}>
              <p style={styles.eyebrow}>
                NEXT ANALYSIS LAYERS
              </p>

              <h2 style={styles.sectionTitle}>
                Article Intelligence
              </h2>

              <p style={styles.sectionDescription}>
                These modules will be connected
                after the core crawler is
                accurate.
              </p>

              <div style={styles.moduleGrid}>
                <div style={styles.module}>
                  <div
                    style={styles.moduleIcon}
                  >
                    ✦
                  </div>

                  <h3
                    style={styles.moduleTitle}
                  >
                    Keyword Suggestions
                  </h3>

                  <p
                    style={styles.moduleText}
                  >
                    Primary, secondary,
                    semantic and related
                    keyword opportunities.
                  </p>

                  <span
                    style={
                      styles.comingSoon
                    }
                  >
                    AI layer coming next
                  </span>
                </div>

                <div style={styles.module}>
                  <div
                    style={styles.moduleIcon}
                  >
                    ✦
                  </div>

                  <h3
                    style={styles.moduleTitle}
                  >
                    Internal Link
                    Opportunities
                  </h3>

                  <p
                    style={styles.moduleText}
                  >
                    Find relevant Coinlytx
                    articles and recommend
                    exact anchor text.
                  </p>

                  <span
                    style={
                      styles.comingSoon
                    }
                  >
                    Site-wide analysis coming
                    next
                  </span>
                </div>

                <div style={styles.module}>
                  <div
                    style={styles.moduleIcon}
                  >
                    ✦
                  </div>

                  <h3
                    style={styles.moduleTitle}
                  >
                    External Sources
                  </h3>

                  <p
                    style={styles.moduleText}
                  >
                    Recommend authoritative
                    external references where
                    useful.
                  </p>

                  <span
                    style={
                      styles.comingSoon
                    }
                  >
                    Research layer coming next
                  </span>
                </div>

                <div style={styles.module}>
                  <div
                    style={styles.moduleIcon}
                  >
                    ✦
                  </div>

                  <h3
                    style={styles.moduleTitle}
                  >
                    Duplicate &
                    Cannibalization
                  </h3>

                  <p
                    style={styles.moduleText}
                  >
                    Compare the article with
                    existing Coinlytx content
                    for topic overlap.
                  </p>

                  <span
                    style={
                      styles.comingSoon
                    }
                  >
                    WordPress database layer
                    coming next
                  </span>
                </div>

                <div style={styles.module}>
                  <div
                    style={styles.moduleIcon}
                  >
                    ✦
                  </div>

                  <h3
                    style={styles.moduleTitle}
                  >
                    Competitor Analysis
                  </h3>

                  <p
                    style={styles.moduleText}
                  >
                    Compare topic coverage
                    against relevant search
                    competitors.
                  </p>

                  <span
                    style={
                      styles.comingSoon
                    }
                  >
                    Search layer coming next
                  </span>
                </div>

                <div style={styles.module}>
                  <div
                    style={styles.moduleIcon}
                  >
                    ✦
                  </div>

                  <h3
                    style={styles.moduleTitle}
                  >
                    English & Content
                  </h3>

                  <p
                    style={styles.moduleText}
                  >
                    Check grammar, clarity,
                    repetition, structure and
                    editorial quality.
                  </p>

                  <span
                    style={
                      styles.comingSoon
                    }
                  >
                    AI editorial layer coming
                    next
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, #172554 0%, #080d18 34%, #05070c 75%)",
  color: "#f8fafc",
  padding: "50px 24px 90px",
  fontFamily: "Inter, Arial, Helvetica, sans-serif",

  // Prevent inherited light page background
  position: "relative",
  isolation: "isolate",
},

  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "30px",
    marginBottom: "34px",
  },

  adminBadge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: "999px",
    background:
      "rgba(59,130,246,.12)",
    border:
      "1px solid rgba(96,165,250,.25)",
    color: "#93c5fd",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.5px",
    marginBottom: "16px",
  },

  heading: {
    margin: 0,
    fontSize: "clamp(32px,5vw,56px)",
    letterSpacing: "-2px",
    lineHeight: 1,
  },

  subheading: {
    maxWidth: "760px",
    color: "#94a3b8",
    fontSize: "16px",
    lineHeight: 1.7,
    marginTop: "18px",
  },

  privateBadge: {
    padding: "10px 14px",
    border:
      "1px solid rgba(255,255,255,.12)",
    borderRadius: "10px",
    color: "#94a3b8",
    background:
      "rgba(255,255,255,.04)",
    whiteSpace: "nowrap",
    fontSize: "13px",
  },

  analyzer: {
    padding: "24px",
    borderRadius: "20px",
    border:
      "1px solid rgba(255,255,255,.1)",
    background:
      "rgba(15,23,42,.75)",
    boxShadow:
      "0 20px 60px rgba(0,0,0,.25)",
    backdropFilter: "blur(15px)",
  },

  label: {
    display: "block",
    fontWeight: 700,
    marginBottom: "10px",
  },

  inputRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },

  input: {
    flex: "1 1 500px",
    minWidth: "220px",
    padding: "16px 18px",
    borderRadius: "12px",
    border: "1px solid #263244",
    background: "#080d16",
    color: "#ffffff",
    outline: "none",
    fontSize: "15px",
  },

  button: {
    border: 0,
    borderRadius: "12px",
    padding: "15px 24px",
    background:
      "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "14px",
  },

  helperText: {
    color: "#64748b",
    marginBottom: 0,
    fontSize: "13px",
    lineHeight: 1.6,
  },

  errorBox: {
    marginTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    padding: "14px 16px",
    borderRadius: "12px",
    border:
      "1px solid rgba(239,68,68,.3)",
    background:
      "rgba(239,68,68,.08)",
    color: "#fecaca",
  },

  errorText: {
    color: "#fca5a5",
    fontSize: "13px",
  },

  emptyState: {
    marginTop: "24px",
    padding: "70px 20px",
    textAlign: "center",
    borderRadius: "20px",
    border:
      "1px dashed rgba(255,255,255,.12)",
    background:
      "rgba(255,255,255,.025)",
  },

  emptyIcon: {
    fontSize: "50px",
    color: "#60a5fa",
  },

  emptyTitle: {
    marginBottom: "8px",
  },

  emptyText: {
    color: "#64748b",
  },

  loader: {
    fontSize: "42px",
    color: "#60a5fa",
    marginBottom: "12px",
  },

  section: {
    marginTop: "24px",
    padding: "26px",
    borderRadius: "20px",
    border:
      "1px solid rgba(255,255,255,.1)",
    background:
      "rgba(15,23,42,.72)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "15px",
    marginBottom: "22px",
  },

  eyebrow: {
    color: "#60a5fa",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.5px",
    margin: "0 0 7px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "24px",
  },

  sectionDescription: {
    color: "#94a3b8",
    lineHeight: 1.6,
  },

  liveBadge: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1px",
    color: "#86efac",
    border:
      "1px solid rgba(34,197,94,.3)",
    padding: "7px 10px",
    borderRadius: "8px",
    background:
      "rgba(34,197,94,.08)",
  },

  scoreGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(210px,1fr))",
    gap: "14px",
  },

  scoreCard: {
    padding: "18px",
    borderRadius: "14px",
    background: "#080d16",
    border: "1px solid #1e293b",
  },

  scoreTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
  },

  scoreTitle: {
    color: "#cbd5e1",
    fontSize: "14px",
  },

  scoreValue: {
    fontWeight: 800,
    color: "#ffffff",
  },

  progressBackground: {
    height: "6px",
    background: "#1e293b",
    borderRadius: "999px",
    marginTop: "16px",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    borderRadius: "999px",
    transition: "width .4s ease",
  },

  statusText: {
    display: "block",
    fontSize: "11px",
    marginTop: "9px",
    fontWeight: 700,
  },

  articleInfo: {
    marginTop: "25px",
    paddingTop: "23px",
    borderTop:
      "1px solid rgba(255,255,255,.08)",
  },

  infoLabel: {
    color: "#60a5fa",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "1.5px",
  },

  articleTitle: {
    margin: "9px 0 6px",
    fontSize: "20px",
    lineHeight: 1.4,
  },

  articleUrl: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    overflowWrap: "anywhere",
  },

  metaDescription: {
    maxWidth: "1000px",
    marginTop: "14px",
    color: "#94a3b8",
    lineHeight: 1.65,
    fontSize: "14px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(115px,1fr))",
    gap: "10px",
    marginTop: "22px",
  },

  statCard: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    padding: "15px",
    borderRadius: "12px",
    background: "#080d16",
    border: "1px solid #1e293b",
  },

  statValue: {
    fontSize: "20px",
    color: "#ffffff",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "11px",
  },

  signalGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: "12px",
    marginTop: "22px",
  },

  signalCard: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "17px",
    borderRadius: "14px",
    background: "#080d16",
    border: "1px solid #1e293b",
    overflow: "hidden",
  },

  signalLabel: {
    color: "#64748b",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: ".8px",
  },

  signalGood: {
    color: "#86efac",
  },

  signalWarning: {
    color: "#fbbf24",
  },

  signalBad: {
    color: "#fca5a5",
  },

  signalValue: {
    color: "#94a3b8",
    fontSize: "11px",
    overflowWrap: "anywhere",
  },

  issueColumns: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(280px,1fr))",
    gap: "16px",
    marginTop: "24px",
  },

  panel: {
    padding: "22px",
    borderRadius: "18px",
    background:
      "rgba(15,23,42,.72)",
    border:
      "1px solid rgba(255,255,255,.1)",
  },

  panelTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "17px",
  },

  issue: {
    padding: "12px 0",
    borderBottom:
      "1px solid rgba(255,255,255,.07)",
    color: "#cbd5e1",
    lineHeight: 1.5,
    fontSize: "14px",
  },

  headingColumns: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: "14px",
    marginTop: "22px",
  },

  headingBox: {
    padding: "18px",
    borderRadius: "14px",
    background: "#080d16",
    border: "1px solid #1e293b",
    maxHeight: "400px",
    overflowY: "auto",
  },

  headingBoxTitle: {
    marginTop: 0,
    color: "#93c5fd",
    fontSize: "15px",
  },

  headingItem: {
    padding: "10px 0",
    color: "#cbd5e1",
    borderBottom:
      "1px solid rgba(255,255,255,.06)",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  headingEmpty: {
    color: "#64748b",
    fontSize: "13px",
  },

  moduleGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: "15px",
    marginTop: "22px",
  },

  module: {
    padding: "22px",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    background: "#080d16",
  },

  moduleIcon: {
    fontSize: "20px",
    color: "#818cf8",
  },

  moduleTitle: {
    marginBottom: "8px",
    fontSize: "16px",
  },

  moduleText: {
    color: "#94a3b8",
    lineHeight: 1.6,
    fontSize: "13px",
    minHeight: "62px",
  },

  comingSoon: {
    display: "inline-block",
    marginTop: "8px",
    color: "#64748b",
    fontSize: "11px",
  },
};