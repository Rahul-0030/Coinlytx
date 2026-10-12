"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type MigrationError = {
  wordpressId: string;
  slug: string;
  error: string;
};

type MigrationResponse = {
  success: boolean;
  route?: string;
  version?: string;
  dryRun?: boolean;
  page?: number;
  perPage?: number;
  totalPages?: number;
  totalPosts?: number;
  preparedCount?: number;
  imported?: number;
  skippedExisting?: number;
  errors?: MigrationError[];
  importedArticles?: Array<{
    wordpressId: string;
    articleId: string;
    slug: string;
    title: string;
  }>;
  hasMore?: boolean;
  nextPage?: number | null;
  error?: string;
};

export default function WordPressMigrationPage() {
  const stopRequestedRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    "Ready to migrate WordPress articles into Supabase drafts."
  );

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);

  const [imported, setImported] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [errors, setErrors] = useState<MigrationError[]>([]);

  const progress =
    totalPages > 0
      ? Math.min(
          100,
          Math.round(
            (currentPage / totalPages) * 100
          )
        )
      : 0;

  async function migrateAll() {
    if (running) return;

    setRunning(true);
    setStopping(false);
    stopRequestedRef.current = false;

    setError("");
    setErrors([]);
    setMessage(
      "Starting safe WordPress → Supabase migration. Existing slugs will be skipped."
    );

    setCurrentPage(0);
    setTotalPages(0);
    setTotalPosts(0);
    setImported(0);
    setSkipped(0);
    setProcessed(0);

    let page = 1;
    let discoveredTotalPages = 1;
    let importedTotal = 0;
    let skippedTotal = 0;
    let processedTotal = 0;
    const collectedErrors: MigrationError[] = [];

    try {
      while (page <= discoveredTotalPages) {
        if (stopRequestedRef.current) {
          setMessage(
            `Migration stopped safely after page ${page - 1}. Click Start / Resume Migration to continue; existing articles will be skipped automatically.`
          );
          break;
        }

        setMessage(
          page === 1
            ? "Checking page 1 and continuing with the remaining WordPress articles..."
            : `Migrating WordPress page ${page} of ${discoveredTotalPages}...`
        );

        const response = await fetch(
          "/api/seo/migrate-wordpress",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              page,
              perPage: 10,
              dryRun: false,
            }),
          }
        );

        const data =
          (await response.json()) as MigrationResponse;

        /*
         * The API can report success:false if one or more articles in a
         * batch failed, while other articles in that same batch succeeded.
         * We preserve those results and stop so the user can inspect them.
         */
        discoveredTotalPages =
          data.totalPages || discoveredTotalPages;

        setTotalPages(discoveredTotalPages);
        setTotalPosts(data.totalPosts || 0);

        const batchImported = data.imported || 0;
        const batchSkipped =
          data.skippedExisting || 0;
        const batchPrepared =
          data.preparedCount || 0;
        const batchErrors =
          Array.isArray(data.errors)
            ? data.errors
            : [];

        importedTotal += batchImported;
        skippedTotal += batchSkipped;
        processedTotal += batchPrepared;

        setImported(importedTotal);
        setSkipped(skippedTotal);
        setProcessed(processedTotal);
        setCurrentPage(page);

        if (batchErrors.length > 0) {
          collectedErrors.push(...batchErrors);
          setErrors([...collectedErrors]);

          throw new Error(
            `Page ${page} completed with ${batchErrors.length} article error(s). Migration stopped so they can be reviewed safely.`
          );
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              `Migration request failed on page ${page}.`
          );
        }

        if (data.hasMore !== true) {
          setMessage(
            `Migration complete. ${importedTotal} new articles imported, ${skippedTotal} existing articles skipped, ${processedTotal} WordPress posts checked.`
          );
          break;
        }

        page =
          data.nextPage ||
          page + 1;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "WordPress migration failed."
      );
    } finally {
      setRunning(false);
      setStopping(false);
    }
  }

  function requestStop() {
    if (!running) return;

    stopRequestedRef.current = true;
    setStopping(true);
    setMessage(
      "Stop requested. The current 10-article batch will finish, then migration will stop safely."
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>
              COINLYTX CMS MIGRATION
            </div>

            <h1 style={titleStyle}>
              WordPress → Supabase
            </h1>

            <p style={subtitleStyle}>
              Import all WordPress articles into your Supabase CMS
              as drafts while preserving URLs and content.
            </p>
          </div>

          <div style={headerActionsStyle}>
            <Link
              href="/admin/seo/interlink"
              style={secondaryLinkStyle}
            >
              ← Interlink Coverage
            </Link>

            <Link
              href="/admin/posts"
              style={secondaryLinkStyle}
            >
              Articles
            </Link>
          </div>
        </div>

        <section style={noticeStyle}>
          <strong>Safe migration mode:</strong>{" "}
          batches contain 10 articles, duplicate slugs are skipped,
          and imported articles remain drafts. WordPress stays live
          until you intentionally publish the Supabase version.
        </section>

        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        <div style={messageStyle}>
          {message}
        </div>

        <section style={progressPanelStyle}>
          <div style={progressHeaderStyle}>
            <strong>Migration Progress</strong>

            <span>
              {totalPages > 0
                ? `${progress}%`
                : "Not started"}
            </span>
          </div>

          <div style={progressTrackStyle}>
            <div
              style={{
                ...progressFillStyle,
                width: `${progress}%`,
              }}
            />
          </div>

          <div style={progressMetaStyle}>
            <span>
              Page:{" "}
              <strong>
                {currentPage}
                {totalPages
                  ? ` / ${totalPages}`
                  : ""}
              </strong>
            </span>

            <span>
              WordPress total:{" "}
              <strong>
                {totalPosts || "—"}
              </strong>
            </span>

            <span>
              Checked:{" "}
              <strong>{processed}</strong>
            </span>
          </div>
        </section>

        <section style={cardsGridStyle}>
          <StatCard
            label="Imported"
            value={imported}
            helper="New Supabase drafts"
          />

          <StatCard
            label="Skipped"
            value={skipped}
            helper="Slug already exists"
          />

          <StatCard
            label="Errors"
            value={errors.length}
            helper="Needs manual review"
          />

          <StatCard
            label="Batch Size"
            value={10}
            helper="Articles per request"
          />
        </section>

        <section style={actionsStyle}>
          <button
            type="button"
            onClick={migrateAll}
            disabled={running}
            style={{
              ...startButtonStyle,
              opacity: running ? 0.6 : 1,
              cursor: running
                ? "not-allowed"
                : "pointer",
            }}
          >
            {running
              ? "Migration Running..."
              : processed > 0
                ? "Start / Resume Migration"
                : "Start Bulk Migration"}
          </button>

          <button
            type="button"
            onClick={requestStop}
            disabled={!running || stopping}
            style={{
              ...stopButtonStyle,
              opacity:
                !running || stopping ? 0.55 : 1,
              cursor:
                !running || stopping
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {stopping
              ? "Stopping After Batch..."
              : "Stop Safely"}
          </button>
        </section>

        {errors.length > 0 && (
          <section style={errorsPanelStyle}>
            <h2 style={sectionTitleStyle}>
              Migration Errors
            </h2>

            {errors.map((item, index) => (
              <div
                key={`${item.wordpressId}-${index}`}
                style={errorRowStyle}
              >
                <div>
                  <strong>
                    /{item.slug}
                  </strong>
                </div>

                <div style={errorTextStyle}>
                  {item.error}
                </div>
              </div>
            ))}
          </section>
        )}

        <section style={nextStepsStyle}>
          <h2 style={sectionTitleStyle}>
            After Migration
          </h2>

          <p style={nextStepsTextStyle}>
            When all articles are imported, we will update the
            Interlink Work Queue so every WordPress inventory record
            opens its migrated Supabase editor. Then the 422 orphan
            articles can be processed one by one with the existing
            SEO Agent and automatic internal-link insertion.
          </p>
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

const headerStyle: React.CSSProperties = {
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
  margin: "7px 0 6px",
  fontSize: "34px",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.6,
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  padding: "10px 13px",
  borderRadius: "9px",
  border: "1px solid #334155",
  color: "#e2e8f0",
  textDecoration: "none",
  fontWeight: 800,
};

const noticeStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: "11px",
  background: "rgba(30,64,175,.18)",
  border: "1px solid rgba(96,165,250,.3)",
  color: "#bfdbfe",
  lineHeight: 1.6,
  marginBottom: "14px",
};

const messageStyle: React.CSSProperties = {
  padding: "13px 15px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#cbd5e1",
  lineHeight: 1.5,
  marginBottom: "16px",
};

const errorStyle: React.CSSProperties = {
  padding: "13px 15px",
  borderRadius: "10px",
  background: "rgba(127,29,29,.3)",
  border: "1px solid rgba(248,113,113,.3)",
  color: "#fca5a5",
  marginBottom: "16px",
  lineHeight: 1.5,
};

const progressPanelStyle: React.CSSProperties = {
  padding: "20px",
  borderRadius: "13px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  marginBottom: "16px",
};

const progressHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "12px",
};

const progressTrackStyle: React.CSSProperties = {
  height: "12px",
  borderRadius: "999px",
  overflow: "hidden",
  background: "#1e293b",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "#22c55e",
  transition: "width .25s ease",
};

const progressMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  flexWrap: "wrap",
  marginTop: "12px",
  color: "#94a3b8",
  fontSize: "12px",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
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

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const startButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "10px",
  padding: "13px 18px",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 900,
};

const stopButtonStyle: React.CSSProperties = {
  border: "1px solid #475569",
  borderRadius: "10px",
  padding: "13px 18px",
  background: "#1e293b",
  color: "#f8fafc",
  fontSize: "14px",
  fontWeight: 900,
};

const errorsPanelStyle: React.CSSProperties = {
  padding: "20px",
  borderRadius: "13px",
  background: "#0f172a",
  border: "1px solid rgba(248,113,113,.3)",
  marginBottom: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: "18px",
};

const errorRowStyle: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #1e293b",
};

const errorTextStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "#fca5a5",
  fontSize: "12px",
  lineHeight: 1.5,
};

const nextStepsStyle: React.CSSProperties = {
  padding: "20px",
  borderRadius: "13px",
  background: "#0b1220",
  border: "1px solid #1e293b",
};

const nextStepsTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.7,
};
