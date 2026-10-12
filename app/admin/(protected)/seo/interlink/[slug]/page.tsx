"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Recommendation = {
  sourceArticleId: string;
  sourceTitle: string;
  sourceSlug: string;
  sourceStatus: string;
  relevance: number;
  anchor: string;
  anchorOptions: string[];
  context: string;
  canInsertAutomatically: boolean;
};

type BacklinkResponse = {
  success: boolean;
  target?: {
    title: string;
    slug: string;
    articleId: string | null;
    incomingInternalLinks: number;
    outgoingInternalLinks: number;
    isOrphan: boolean;
  };
  scannedArticles?: number;
  recommendations?: Recommendation[];
  error?: string;
};

type QueueItem = {
  slug: string;
  coverageStatus:
    | "pending"
    | "orphan"
    | "weak"
    | "healthy";
};

type QueueResponse = {
  success: boolean;
  queue?: QueueItem[];
};

export default function OrphanFixPage() {
  const params = useParams();

  const slug =
    decodeURIComponent(
      String(params.slug || "")
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [target, setTarget] =
    useState<
      BacklinkResponse["target"] |
      null
    >(null);

  const [
    recommendations,
    setRecommendations,
  ] =
    useState<
      Recommendation[]
    >([]);

  const [scanned, setScanned] =
    useState(0);

  const [
    insertingArticleId,
    setInsertingArticleId,
  ] =
    useState("");

  const [
    insertedSourceIds,
    setInsertedSourceIds,
  ] =
    useState<string[]>([]);

  const [nextOrphan, setNextOrphan] =
    useState("");

  async function loadNextOrphan() {
    try {
      const response =
        await fetch(
          "/api/seo/article-index?limit=500",
          {
            cache:
              "no-store",
          }
        );

      const data =
        (await response.json()) as QueueResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        return;
      }

      const next =
        (data.queue || []).find(
          (item) =>
            item.coverageStatus ===
              "orphan" &&
            item.slug !== slug
        );

      setNextOrphan(
        next?.slug || ""
      );
    } catch {}
  }

  async function loadRecommendations() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/seo/orphan-backlinks",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                targetSlug:
                  slug,
              }),
          }
        );

      const data =
        (await response.json()) as BacklinkResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to find backlink opportunities."
        );
      }

      setTarget(
        data.target || null
      );

      setRecommendations(
        data.recommendations ||
          []
      );

      setScanned(
        data.scannedArticles ||
          0
      );

      await loadNextOrphan();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load orphan fixer."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (slug) {
      loadRecommendations();
    }
  }, [slug]);

  const readyCount =
    useMemo(
      () =>
        recommendations.filter(
          (item) =>
            item.canInsertAutomatically
        ).length,
      [recommendations]
    );

  async function insertBacklink(
    item: Recommendation
  ) {
    if (
      !item.canInsertAutomatically ||
      !item.anchor
    ) {
      return;
    }

    try {
      setInsertingArticleId(
        item.sourceArticleId
      );

      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/seo/insert-orphan-backlink",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                sourceArticleId:
                  item.sourceArticleId,
                targetSlug:
                  slug,
                anchor:
                  item.anchor,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to insert backlink."
        );
      }

      setInsertedSourceIds(
        (current) =>
          current.includes(
            item.sourceArticleId
          )
            ? current
            : [
                ...current,
                item.sourceArticleId,
              ]
      );

      setMessage(
        `Backlink inserted from "${item.sourceTitle}" using anchor "${data.anchor}".`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to insert backlink."
      );
    } finally {
      setInsertingArticleId(
        ""
      );
    }
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <div>
            <div style={eyebrowStyle}>
              COINLYTX INTERLINK FIXER
            </div>

            <h1 style={titleStyle}>
              Fix Orphan Article
            </h1>

            <p style={subtitleStyle}>
              Add incoming links from relevant migrated articles.
            </p>
          </div>

          <div style={actionsStyle}>
            <Link
              href="/admin/seo/interlink"
              style={secondaryLinkStyle}
            >
              ← Coverage Queue
            </Link>

            {target?.articleId && (
              <Link
                href={`/admin/posts/${target.articleId}/edit`}
                style={secondaryLinkStyle}
              >
                Edit Target
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        {message && (
          <div style={successStyle}>
            {message}
          </div>
        )}

        {loading ? (
          <section style={loadingStyle}>
            Searching migrated articles for relevant backlink opportunities...
          </section>
        ) : target ? (
          <>
            <section style={targetCardStyle}>
              <div>
                <div style={labelStyle}>
                  ORPHAN TARGET
                </div>

                <h2 style={targetTitleStyle}>
                  {target.title}
                </h2>

                <div style={slugStyle}>
                  /{target.slug}
                </div>
              </div>

              <div style={targetStatsStyle}>
                <Stat
                  label="Incoming"
                  value={
                    target.incomingInternalLinks
                  }
                />

                <Stat
                  label="Outgoing"
                  value={
                    target.outgoingInternalLinks
                  }
                />

                <Stat
                  label="Articles scanned"
                  value={scanned}
                />

                <Stat
                  label="Ready suggestions"
                  value={readyCount}
                />
              </div>
            </section>

            <section style={helpStyle}>
              Insert at least one strong incoming backlink. For important
              articles, 2–3 relevant incoming links are usually better than
              forcing many weak links. After fixing several articles, run
              <strong> Scan Incoming Links</strong> again on the coverage page.
            </section>

            <section style={listStyle}>
              <div style={listHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>
                    Recommended Source Articles
                  </h2>

                  <p style={sectionTextStyle}>
                    The system found exact words already present in these
                    articles, so the backlink can be inserted naturally.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    loadRecommendations
                  }
                  style={refreshButtonStyle}
                >
                  Refresh Suggestions
                </button>
              </div>

              {recommendations.length ===
              0 ? (
                <div style={emptyStyle}>
                  No suitable backlink opportunity was found automatically.
                  This article needs manual review.
                </div>
              ) : (
                recommendations.map(
                  (item, index) => {
                    const inserted =
                      insertedSourceIds.includes(
                        item.sourceArticleId
                      );

                    const inserting =
                      insertingArticleId ===
                      item.sourceArticleId;

                    return (
                      <article
                        key={`${item.sourceArticleId}-${index}`}
                        style={recommendationStyle}
                      >
                        <div style={recommendationTopStyle}>
                          <div>
                            <div style={rankStyle}>
                              #{index + 1} RECOMMENDATION
                            </div>

                            <h3 style={sourceTitleStyle}>
                              {item.sourceTitle}
                            </h3>

                            <div style={slugStyle}>
                              /{item.sourceSlug}
                            </div>
                          </div>

                          <div style={scoreStyle}>
                            {item.relevance}%
                          </div>
                        </div>

                        <div style={detailsGridStyle}>
                          <div style={detailCardStyle}>
                            <div style={detailLabelStyle}>
                              BEST ANCHOR
                            </div>

                            <div style={anchorStyle}>
                              {item.anchor ||
                                "No exact anchor found"}
                            </div>
                          </div>

                          <div style={detailCardStyle}>
                            <div style={detailLabelStyle}>
                              STATUS
                            </div>

                            <div
                              style={
                                item.canInsertAutomatically
                                  ? readyStyle
                                  : manualStyle
                              }
                            >
                              {item.canInsertAutomatically
                                ? "READY TO INSERT"
                                : "MANUAL REVIEW"}
                            </div>
                          </div>
                        </div>

                        {item.context && (
                          <div style={contextStyle}>
                            <div style={detailLabelStyle}>
                              PLACE LINK HERE
                            </div>

                            <div>
                              {item.context}
                            </div>
                          </div>
                        )}

                        {item.anchorOptions?.length >
                          1 && (
                          <div style={otherAnchorsStyle}>
                            <strong>
                              Other matching anchors:
                            </strong>{" "}
                            {item.anchorOptions
                              .slice(1)
                              .join(", ")}
                          </div>
                        )}

                        <div style={recommendationActionsStyle}>
                          <Link
                            href={`/admin/posts/${item.sourceArticleId}/edit`}
                            style={editSourceStyle}
                          >
                            Open Source Article
                          </Link>

                          <button
                            type="button"
                            disabled={
                              !item.canInsertAutomatically ||
                              inserting ||
                              inserted
                            }
                            onClick={() =>
                              insertBacklink(
                                item
                              )
                            }
                            style={{
                              ...insertButtonStyle,
                              opacity:
                                !item.canInsertAutomatically ||
                                inserting ||
                                inserted
                                  ? 0.55
                                  : 1,
                              cursor:
                                !item.canInsertAutomatically ||
                                inserting ||
                                inserted
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {inserted
                              ? "Inserted ✓"
                              : inserting
                                ? "Inserting..."
                                : "Insert Backlink"}
                          </button>
                        </div>
                      </article>
                    );
                  }
                )
              )}
            </section>

            {nextOrphan && (
              <section style={nextStyle}>
                <div>
                  <strong>
                    Continue the queue
                  </strong>

                  <div style={nextTextStyle}>
                    After inserting a good backlink, move to the next
                    orphan article.
                  </div>
                </div>

                <Link
                  href={`/admin/seo/interlink/${encodeURIComponent(
                    nextOrphan
                  )}`}
                  style={nextButtonStyle}
                >
                  Next Orphan →
                </Link>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={statStyle}>
      <div style={statValueStyle}>
        {value.toLocaleString()}
      </div>

      <div style={statLabelStyle}>
        {label}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  color: "#f8fafc",
  padding: "34px 20px 100px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "18px",
  flexWrap: "wrap",
  marginBottom: "22px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#22c55e",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: ".08em",
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0",
  fontSize: "34px",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "9px",
  flexWrap: "wrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: "9px",
  padding: "10px 13px",
  color: "#e2e8f0",
  textDecoration: "none",
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "10px",
  marginBottom: "15px",
  background: "rgba(127,29,29,.3)",
  border: "1px solid rgba(248,113,113,.3)",
  color: "#fca5a5",
};

const successStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "10px",
  marginBottom: "15px",
  background: "rgba(20,83,45,.3)",
  border: "1px solid rgba(34,197,94,.3)",
  color: "#86efac",
};

const loadingStyle: React.CSSProperties = {
  padding: "40px",
  textAlign: "center",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  color: "#94a3b8",
};

const targetCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  flexWrap: "wrap",
  padding: "22px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "14px",
  marginBottom: "14px",
};

const labelStyle: React.CSSProperties = {
  color: "#fca5a5",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: ".06em",
};

const targetTitleStyle: React.CSSProperties = {
  margin: "7px 0 5px",
  fontSize: "23px",
};

const slugStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  overflowWrap: "anywhere",
};

const targetStatsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const statStyle: React.CSSProperties = {
  minWidth: "100px",
  padding: "12px",
  borderRadius: "10px",
  background: "#020617",
  border: "1px solid #1e293b",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "21px",
  fontWeight: 900,
};

const statLabelStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "9px",
  textTransform: "uppercase",
};

const helpStyle: React.CSSProperties = {
  padding: "13px 15px",
  background: "rgba(30,64,175,.16)",
  border: "1px solid rgba(96,165,250,.25)",
  borderRadius: "10px",
  color: "#bfdbfe",
  fontSize: "12px",
  lineHeight: 1.6,
  marginBottom: "16px",
};

const listStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "14px",
  overflow: "hidden",
};

const listHeaderStyle: React.CSSProperties = {
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "center",
  flexWrap: "wrap",
  borderBottom: "1px solid #1e293b",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "19px",
};

const sectionTextStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "11px",
};

const refreshButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  cursor: "pointer",
  fontWeight: 800,
};

const emptyStyle: React.CSSProperties = {
  padding: "35px 20px",
  textAlign: "center",
  color: "#94a3b8",
};

const recommendationStyle: React.CSSProperties = {
  padding: "20px",
  borderBottom: "1px solid #1e293b",
};

const recommendationTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
};

const rankStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
};

const sourceTitleStyle: React.CSSProperties = {
  margin: "5px 0",
  fontSize: "17px",
};

const scoreStyle: React.CSSProperties = {
  minWidth: "54px",
  textAlign: "center",
  padding: "7px 9px",
  borderRadius: "8px",
  background: "rgba(37,99,235,.16)",
  border: "1px solid rgba(96,165,250,.3)",
  color: "#93c5fd",
  fontWeight: 900,
};

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
  marginTop: "14px",
};

const detailCardStyle: React.CSSProperties = {
  padding: "12px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: "9px",
};

const detailLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
  marginBottom: "5px",
};

const anchorStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontWeight: 900,
};

const readyStyle: React.CSSProperties = {
  color: "#86efac",
  fontWeight: 900,
  fontSize: "11px",
};

const manualStyle: React.CSSProperties = {
  color: "#fcd34d",
  fontWeight: 900,
  fontSize: "11px",
};

const contextStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "12px",
  borderRadius: "9px",
  background: "#111827",
  color: "#cbd5e1",
  lineHeight: 1.65,
  fontSize: "12px",
};

const otherAnchorsStyle: React.CSSProperties = {
  marginTop: "9px",
  color: "#94a3b8",
  fontSize: "11px",
};

const recommendationActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "9px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const editSourceStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  color: "#cbd5e1",
  textDecoration: "none",
  fontWeight: 800,
};

const insertButtonStyle: React.CSSProperties = {
  border: 0,
  padding: "9px 13px",
  borderRadius: "8px",
  background: "#059669",
  color: "#ffffff",
  fontWeight: 900,
};

const nextStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "17px",
  borderRadius: "12px",
  border: "1px solid #1e293b",
  background: "#0f172a",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const nextTextStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "11px",
};

const nextButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "8px",
  background: "#2563eb",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
};
