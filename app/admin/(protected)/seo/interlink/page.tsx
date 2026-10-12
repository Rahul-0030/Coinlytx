"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Stats = {
  sourceRecords: number;
  uniqueArticles: number;
  wordpressRecords: number;
  supabaseRecords: number;
  duplicateSourceRecords: number;
  processed: number;
  remaining: number;
  withOutgoingLinks: number;
  withoutOutgoingLinks: number;
  analyzed: number;
  incomingScanComplete: boolean;
  orphanCount: number;
  weakCount: number;
  healthyCount: number;
};

type QueueItem = {
  id: string;
  source: "supabase" | "wordpress";
  sourceId: string;
  articleId: string | null;
  title: string;
  slug: string;
  url: string;
  category: string | null;
  wordCount: number;
  outgoingInternalLinks: number;
  incomingInternalLinks: number;
  internalLinkScore: number;
  isOrphan: boolean;
  coverageStatus: "pending" | "orphan" | "weak" | "healthy";
  processed: boolean;
  lastAnalyzedAt: string | null;
};

type DashboardResponse = {
  success: boolean;
  stats?: Stats;
  queue?: QueueItem[];
  incomingLinkScanReady?: boolean;
  message?: string;
  error?: string;
};

type SyncResponse = {
  success: boolean;
  supabase?: {
    synced: number;
  };
  wordpress?: {
    currentPage: number;
    synced: number;
    totalPosts: number;
    totalPages: number;
    hasMore: boolean;
    nextPage: number | null;
  };
  error?: string;
};

type LinkGraphResponse = {
  success: boolean;
  phase?: "reset" | "scan" | "finalize";
  supabase?: {
    articleCount: number;
    edgeCount: number;
  };
  wordpress?: {
    currentPage: number;
    scanned: number;
    edgesFound: number;
    totalPosts: number;
    totalPages: number;
    hasMore: boolean;
    nextPage: number | null;
  };
  summary?: {
    graphEdges: number;
    uniqueArticles: number;
    orphanCount: number;
    weakCount: number;
    healthyCount: number;
  };
  error?: string;
};

export default function InterlinkCoveragePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [syncPage, setSyncPage] = useState(0);
  const [syncTotalPages, setSyncTotalPages] = useState(0);
  const [syncWordPressCount, setSyncWordPressCount] = useState(0);
  const [syncSupabaseCount, setSyncSupabaseCount] = useState(0);

  const [scanningLinks, setScanningLinks] = useState(false);
  const [scanPage, setScanPage] = useState(0);
  const [scanTotalPages, setScanTotalPages] = useState(0);
  const [scanWordPressCount, setScanWordPressCount] = useState(0);
  const [scanEdges, setScanEdges] = useState(0);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/seo/article-index?limit=100",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as DashboardResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load interlink dashboard."
        );
      }

      setStats(data.stats || null);
      setQueue(data.queue || []);

      if (data.message) {
        setMessage(data.message);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load interlink dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const syncPercent = useMemo(() => {
    if (!syncing || syncTotalPages <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (syncPage / syncTotalPages) * 100
      )
    );
  }, [syncPage, syncTotalPages, syncing]);

  const scanPercent = useMemo(() => {
    if (!scanningLinks || scanTotalPages <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (scanPage / scanTotalPages) * 100
      )
    );
  }, [scanPage, scanTotalPages, scanningLinks]);

  async function syncAllArticles() {
    if (syncing) return;

    try {
      setSyncing(true);
      setError("");
      setMessage(
        "Starting article sync. Keep this admin page open until it finishes."
      );
      setSyncPage(0);
      setSyncTotalPages(0);
      setSyncWordPressCount(0);
      setSyncSupabaseCount(0);

      let page = 1;
      let totalPages = 1;
      let totalWordPressSynced = 0;
      let supabaseSynced = 0;

      while (page <= totalPages) {
        setMessage(
          page === 1
            ? "Syncing Supabase articles and WordPress page 1..."
            : `Syncing WordPress page ${page} of ${totalPages}...`
        );

        const response = await fetch(
          "/api/seo/sync-article-index",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wpPage: page,
            }),
          }
        );

        const data =
          (await response.json()) as SyncResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              `Article sync failed on WordPress page ${page}.`
          );
        }

        if (page === 1) {
          supabaseSynced =
            data.supabase?.synced || 0;
          setSyncSupabaseCount(
            supabaseSynced
          );
        }

        totalPages =
          data.wordpress?.totalPages || 1;

        totalWordPressSynced +=
          data.wordpress?.synced || 0;

        setSyncTotalPages(totalPages);
        setSyncPage(page);
        setSyncWordPressCount(
          totalWordPressSynced
        );

        const hasMore =
          data.wordpress?.hasMore === true;

        if (!hasMore) {
          break;
        }

        page =
          data.wordpress?.nextPage ||
          page + 1;
      }

      setMessage(
        `Sync complete. ${supabaseSynced} Supabase records and ${totalWordPressSynced} WordPress records were synced.`
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sync all articles."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function scanIncomingLinks() {
    if (scanningLinks) return;

    try {
      setScanningLinks(true);
      setError("");
      setMessage(
        "Preparing internal-link graph. Keep this page open until the scan finishes."
      );
      setScanPage(0);
      setScanTotalPages(0);
      setScanWordPressCount(0);
      setScanEdges(0);

      const resetResponse = await fetch(
        "/api/seo/scan-link-graph",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phase: "reset",
          }),
        }
      );

      const resetData =
        (await resetResponse.json()) as LinkGraphResponse;

      if (!resetResponse.ok || !resetData.success) {
        throw new Error(
          resetData.error ||
            "Unable to prepare the internal-link graph."
        );
      }

      let totalEdges =
        resetData.supabase?.edgeCount || 0;

      setScanEdges(totalEdges);

      let page = 1;
      let totalPages = 1;
      let totalWordPressScanned = 0;

      while (page <= totalPages) {
        setMessage(
          page === 1
            ? "Scanning WordPress internal links..."
            : `Scanning WordPress page ${page} of ${totalPages}...`
        );

        const response = await fetch(
          "/api/seo/scan-link-graph",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              phase: "scan",
              wpPage: page,
            }),
          }
        );

        const data =
          (await response.json()) as LinkGraphResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              `Incoming-link scan failed on WordPress page ${page}.`
          );
        }

        totalPages =
          data.wordpress?.totalPages || 1;

        totalWordPressScanned +=
          data.wordpress?.scanned || 0;

        totalEdges +=
          data.wordpress?.edgesFound || 0;

        setScanTotalPages(totalPages);
        setScanPage(page);
        setScanWordPressCount(
          totalWordPressScanned
        );
        setScanEdges(totalEdges);

        if (
          data.wordpress?.hasMore !== true
        ) {
          break;
        }

        page =
          data.wordpress?.nextPage ||
          page + 1;
      }

      setMessage(
        "Finalizing incoming-link counts and orphan status..."
      );

      const finalResponse = await fetch(
        "/api/seo/scan-link-graph",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phase: "finalize",
          }),
        }
      );

      const finalData =
        (await finalResponse.json()) as LinkGraphResponse;

      if (!finalResponse.ok || !finalData.success) {
        throw new Error(
          finalData.error ||
            "Unable to finalize incoming-link scan."
        );
      }

      const summary = finalData.summary;

      setMessage(
        summary
          ? `Incoming-link scan complete. ${summary.orphanCount} orphan, ${summary.weakCount} weak and ${summary.healthyCount} healthy articles found.`
          : "Incoming-link scan complete."
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to scan incoming internal links."
      );
    } finally {
      setScanningLinks(false);
    }
  }

  if (loading && !stats) {
    return (
      <main style={loadingStyle}>
        Loading interlink coverage...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <div>
            <div style={eyebrowStyle}>
              COINLYTX SEO
            </div>

            <h1 style={titleStyle}>
              Interlink Coverage
            </h1>

            <p style={subtitleStyle}>
              Sync every article into one queue, then fix internal
              linking one article at a time.
            </p>
          </div>

          <div style={topActionsStyle}>
            <Link
              href="/admin/seo"
              style={secondaryLinkStyle}
            >
              ← SEO Agent
            </Link>

            <button
              type="button"
              onClick={syncAllArticles}
              disabled={syncing}
              style={{
                ...primaryButtonStyle,
                opacity: syncing ? 0.65 : 1,
                cursor: syncing
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {syncing
                ? "Syncing Articles..."
                : "Sync All Articles"}
            </button>

            <button
              type="button"
              onClick={scanIncomingLinks}
              disabled={
                scanningLinks ||
                syncing ||
                !stats ||
                stats.uniqueArticles === 0
              }
              style={{
                ...scanButtonStyle,
                opacity:
                  scanningLinks ||
                  syncing ||
                  !stats ||
                  stats.uniqueArticles === 0
                    ? 0.6
                    : 1,
                cursor:
                  scanningLinks ||
                  syncing ||
                  !stats ||
                  stats.uniqueArticles === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {scanningLinks
                ? "Scanning Links..."
                : "Scan Incoming Links"}
            </button>
          </div>
        </div>

        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        {message && (
          <div style={messageStyle}>
            {message}
          </div>
        )}

        {syncing && (
          <section style={syncPanelStyle}>
            <div style={syncHeaderStyle}>
              <strong>
                Article Sync Progress
              </strong>

              <span>
                {syncTotalPages > 0
                  ? `${syncPercent}%`
                  : "Starting..."}
              </span>
            </div>

            <div style={progressTrackStyle}>
              <div
                style={{
                  ...progressFillStyle,
                  width: `${syncPercent}%`,
                }}
              />
            </div>

            <div style={syncStatsStyle}>
              <span>
                WordPress page:
                {" "}
                {syncPage || 0}
                {syncTotalPages
                  ? ` / ${syncTotalPages}`
                  : ""}
              </span>

              <span>
                WordPress synced:
                {" "}
                {syncWordPressCount}
              </span>

              <span>
                Supabase synced:
                {" "}
                {syncSupabaseCount}
              </span>
            </div>
          </section>
        )}

        {scanningLinks && (
          <section style={scanPanelStyle}>
            <div style={syncHeaderStyle}>
              <strong>
                Incoming Link Scan
              </strong>

              <span>
                {scanTotalPages > 0
                  ? `${scanPercent}%`
                  : "Preparing..."}
              </span>
            </div>

            <div style={progressTrackStyle}>
              <div
                style={{
                  ...scanProgressFillStyle,
                  width: `${scanPercent}%`,
                }}
              />
            </div>

            <div style={syncStatsStyle}>
              <span>
                WordPress page:
                {" "}
                {scanPage || 0}
                {scanTotalPages
                  ? ` / ${scanTotalPages}`
                  : ""}
              </span>

              <span>
                Articles scanned:
                {" "}
                {scanWordPressCount}
              </span>

              <span>
                Link edges found:
                {" "}
                {scanEdges}
              </span>
            </div>
          </section>
        )}

        {stats && (
          <>
            <section style={cardsGridStyle}>
              <StatCard
                label="Unique Articles"
                value={stats.uniqueArticles}
                helper="Deduplicated by slug"
              />

              <StatCard
                label="WordPress Records"
                value={stats.wordpressRecords}
                helper="Legacy CMS source"
              />

              <StatCard
                label="Supabase Records"
                value={stats.supabaseRecords}
                helper="Current CMS source"
              />

              <StatCard
                label="No Outgoing Links"
                value={stats.withoutOutgoingLinks}
                helper="Highest-priority articles"
              />

              <StatCard
                label="With Outgoing Links"
                value={stats.withOutgoingLinks}
                helper="At least one internal target"
              />

              <StatCard
                label="Orphan Articles"
                value={stats.orphanCount}
                helper={
                  stats.incomingScanComplete
                    ? "Zero incoming internal links"
                    : "Run incoming-link scan"
                }
              />

              <StatCard
                label="Weak Articles"
                value={stats.weakCount}
                helper={
                  stats.incomingScanComplete
                    ? "Needs stronger interlinking"
                    : "Run incoming-link scan"
                }
              />

              <StatCard
                label="Healthy Articles"
                value={stats.healthyCount}
                helper={
                  stats.incomingScanComplete
                    ? "Incoming and outgoing coverage"
                    : "Run incoming-link scan"
                }
              />

              <StatCard
                label="Remaining"
                value={stats.remaining}
                helper="Not marked processed yet"
              />
            </section>

            <section style={infoGridStyle}>
              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>
                  SOURCE RECORDS
                </div>

                <div style={infoValueStyle}>
                  {stats.sourceRecords}
                </div>

                <div style={infoTextStyle}>
                  Includes both WordPress and Supabase records.
                  Duplicate slugs are counted only once in the
                  Unique Articles card.
                </div>
              </div>

              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>
                  MIGRATION OVERLAP
                </div>

                <div style={infoValueStyle}>
                  {stats.duplicateSourceRecords}
                </div>

                <div style={infoTextStyle}>
                  Articles found in more than one CMS source.
                  Supabase is preferred in the working queue.
                </div>
              </div>

              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>
                  INCOMING LINK SCAN
                </div>

                <div
                  style={
                    stats.incomingScanComplete
                      ? completeBadgeStyle
                      : pendingBadgeStyle
                  }
                >
                  {stats.incomingScanComplete
                    ? "COMPLETE"
                    : "NOT SCANNED"}
                </div>

                <div style={infoTextStyle}>
                  {stats.incomingScanComplete
                    ? `${stats.analyzed} articles have incoming-link data.`
                    : "Run Scan Incoming Links to calculate true orphan pages."}
                </div>
              </div>
            </section>
          </>
        )}

        <section style={queueSectionStyle}>
          <div style={queueHeaderStyle}>
            <div>
              <h2 style={queueTitleStyle}>
                Interlink Work Queue
              </h2>

              <p style={queueDescriptionStyle}>
                Orphan articles are shown first. Migrated WordPress articles
                now open directly in the Supabase editor. The first 100 queue
                items are displayed.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              style={refreshButtonStyle}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          {queue.length === 0 ? (
            <div style={emptyStyle}>
              No articles are in the index yet. Click
              <strong> Sync All Articles</strong>.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>
                      Article
                    </th>

                    <th style={thStyle}>
                      Source
                    </th>

                    <th style={thStyle}>
                      Words
                    </th>

                    <th style={thStyle}>
                      Outgoing
                    </th>

                    <th style={thStyle}>
                      Incoming
                    </th>

                    <th style={thStyle}>
                      Status
                    </th>

                    <th style={thStyle}>
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        <div style={articleTitleStyle}>
                          {item.title}
                        </div>

                        <div style={slugStyle}>
                          /{item.slug}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <SourceBadge
                          source={item.source}
                        />
                      </td>

                      <td style={tdStyle}>
                        {item.wordCount}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            ...countBadgeStyle,
                            ...(item.outgoingInternalLinks === 0
                              ? dangerCountStyle
                              : goodCountStyle),
                          }}
                        >
                          {item.outgoingInternalLinks}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {item.coverageStatus === "pending" ? (
                          <span style={pendingTextStyle}>
                            Pending scan
                          </span>
                        ) : (
                          <span
                            style={{
                              ...countBadgeStyle,
                              ...(item.incomingInternalLinks === 0
                                ? dangerCountStyle
                                : goodCountStyle),
                            }}
                          >
                            {item.incomingInternalLinks}
                          </span>
                        )}
                      </td>

                      <td style={tdStyle}>
                        {item.processed ? (
                          <span style={processedBadgeStyle}>
                            Processed
                          </span>
                        ) : item.coverageStatus === "orphan" ? (
                          <span style={orphanBadgeStyle}>
                            ORPHAN
                          </span>
                        ) : item.coverageStatus === "weak" ? (
                          <span style={weakBadgeStyle}>
                            WEAK
                          </span>
                        ) : item.coverageStatus === "healthy" ? (
                          <span style={healthyBadgeStyle}>
                            HEALTHY
                          </span>
                        ) : item.outgoingInternalLinks === 0 ? (
                          <span style={needsWorkBadgeStyle}>
                            Needs links
                          </span>
                        ) : (
                          <span style={reviewBadgeStyle}>
                            Review
                          </span>
                        )}
                      </td>

                      <td style={tdStyle}>
                        {item.coverageStatus === "orphan" ? (
                          <Link
                            href={`/admin/seo/interlink/${encodeURIComponent(
                              item.slug
                            )}`}
                            style={orphanFixLinkStyle}
                          >
                            Fix Orphan →
                          </Link>
                        ) : item.articleId ? (
                          <Link
                            href={`/admin/posts/${item.articleId}/edit`}
                            style={fixLinkStyle}
                          >
                            Fix Article →
                          </Link>
                        ) : (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={viewLinkStyle}
                          >
                            View Article ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>
        {label}
      </div>

      <div style={statValueStyle}>
        {value.toLocaleString()}
      </div>

      <div style={statHelperStyle}>
        {helper}
      </div>
    </div>
  );
}

function SourceBadge({
  source,
}: {
  source: "supabase" | "wordpress";
}) {
  const supabase =
    source === "supabase";

  return (
    <span
      style={{
        ...sourceBadgeStyle,
        background: supabase
          ? "rgba(16,185,129,.12)"
          : "rgba(59,130,246,.12)",
        borderColor: supabase
          ? "rgba(16,185,129,.35)"
          : "rgba(59,130,246,.35)",
        color: supabase
          ? "#6ee7b7"
          : "#93c5fd",
      }}
    >
      {supabase
        ? "Supabase"
        : "WordPress"}
    </span>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  color: "#f8fafc",
  padding: "32px 18px 100px",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  color: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "1400px",
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "24px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#22c55e",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: ".08em",
};

const titleStyle: React.CSSProperties = {
  margin: "7px 0 5px",
  fontSize: "34px",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.6,
};

const topActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: "9px",
  border: "1px solid #334155",
  color: "#e2e8f0",
  textDecoration: "none",
  fontWeight: 800,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "9px",
  padding: "12px 16px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 900,
};

const scanButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "9px",
  padding: "12px 16px",
  background: "#059669",
  color: "#ffffff",
  fontWeight: 900,
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "10px",
  marginBottom: "16px",
  background: "rgba(127,29,29,.3)",
  border: "1px solid rgba(248,113,113,.3)",
  color: "#fca5a5",
};

const messageStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "10px",
  marginBottom: "16px",
  background: "rgba(30,64,175,.2)",
  border: "1px solid rgba(96,165,250,.3)",
  color: "#bfdbfe",
  lineHeight: 1.5,
};

const syncPanelStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "12px",
  border: "1px solid #1e3a8a",
  background: "#0f172a",
  marginBottom: "20px",
};

const scanPanelStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "12px",
  border: "1px solid #065f46",
  background: "#0f172a",
  marginBottom: "20px",
};

const syncHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "10px",
};

const progressTrackStyle: React.CSSProperties = {
  height: "10px",
  borderRadius: "999px",
  background: "#1e293b",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "#22c55e",
  transition: "width .25s ease",
};

const scanProgressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "#10b981",
  transition: "width .25s ease",
};

const syncStatsStyle: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  gap: "18px",
  flexWrap: "wrap",
  color: "#94a3b8",
  fontSize: "12px",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const statCardStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  padding: "18px",
};

const statLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const statValueStyle: React.CSSProperties = {
  marginTop: "7px",
  fontSize: "27px",
  fontWeight: 900,
};

const statHelperStyle: React.CSSProperties = {
  marginTop: "5px",
  color: "#64748b",
  fontSize: "11px",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "12px",
  marginBottom: "22px",
};

const infoCardStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "12px",
  background: "#0b1220",
  border: "1px solid #1e293b",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 900,
};

const infoValueStyle: React.CSSProperties = {
  marginTop: "7px",
  color: "#f8fafc",
  fontSize: "24px",
  fontWeight: 900,
};

const infoTextStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.55,
};

const pendingBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: "8px",
  padding: "5px 8px",
  borderRadius: "999px",
  background: "rgba(245,158,11,.12)",
  border: "1px solid rgba(245,158,11,.3)",
  color: "#fcd34d",
  fontSize: "10px",
  fontWeight: 900,
};

const completeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: "8px",
  padding: "5px 8px",
  borderRadius: "999px",
  background: "rgba(16,185,129,.12)",
  border: "1px solid rgba(16,185,129,.35)",
  color: "#6ee7b7",
  fontSize: "10px",
  fontWeight: 900,
};

const queueSectionStyle: React.CSSProperties = {
  borderRadius: "14px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  overflow: "hidden",
};

const queueHeaderStyle: React.CSSProperties = {
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
  borderBottom: "1px solid #1e293b",
};

const queueTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "19px",
};

const queueDescriptionStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const refreshButtonStyle: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "9px 12px",
  background: "#020617",
  color: "#cbd5e1",
  fontWeight: 800,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#94a3b8",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1050px",
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  borderBottom: "1px solid #1e293b",
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #172033",
  verticalAlign: "top",
  color: "#cbd5e1",
  fontSize: "12px",
};

const articleTitleStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontWeight: 800,
  lineHeight: 1.4,
  maxWidth: "420px",
};

const slugStyle: React.CSSProperties = {
  marginTop: "5px",
  color: "#64748b",
  fontSize: "10px",
  maxWidth: "420px",
  overflowWrap: "anywhere",
};

const sourceBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 7px",
  borderRadius: "999px",
  border: "1px solid",
  fontSize: "10px",
  fontWeight: 900,
};

const countBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  minWidth: "28px",
  justifyContent: "center",
  padding: "4px 7px",
  borderRadius: "7px",
  fontWeight: 900,
};

const dangerCountStyle: React.CSSProperties = {
  background: "rgba(127,29,29,.28)",
  color: "#fca5a5",
};

const goodCountStyle: React.CSSProperties = {
  background: "rgba(20,83,45,.28)",
  color: "#86efac",
};

const pendingTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
};

const processedBadgeStyle: React.CSSProperties = {
  color: "#86efac",
  fontWeight: 800,
};

const needsWorkBadgeStyle: React.CSSProperties = {
  color: "#fca5a5",
  fontWeight: 800,
};

const reviewBadgeStyle: React.CSSProperties = {
  color: "#fcd34d",
  fontWeight: 800,
};

const orphanBadgeStyle: React.CSSProperties = {
  color: "#fca5a5",
  fontWeight: 900,
};

const weakBadgeStyle: React.CSSProperties = {
  color: "#fcd34d",
  fontWeight: 900,
};

const healthyBadgeStyle: React.CSSProperties = {
  color: "#86efac",
  fontWeight: 900,
};

const orphanFixLinkStyle: React.CSSProperties = {
  color: "#fca5a5",
  textDecoration: "none",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const fixLinkStyle: React.CSSProperties = {
  color: "#7dd3fc",
  textDecoration: "none",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const viewLinkStyle: React.CSSProperties = {
  color: "#94a3b8",
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};
