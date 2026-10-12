"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Summary = {
  mappedWordPressArticles: number;
  articlesFound: number;
  alreadyPublished: number;
  draftArticles: number;
  blockedCritical: number;
  skippedMissingImage: number;
  eligibleToPublish: number;
  publishedNow: number;
  remainingEligible: number;
};

type ActivationResponse = {
  success: boolean;
  dryRun?: boolean;
  summary?: Summary;
  hasMore?: boolean;
  error?: string;
  message?: string;
};

export default function ActivationPage() {
  const stopRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    "Run the safety check before activating migrated articles."
  );

  const [summary, setSummary] = useState<Summary | null>(null);
  const [publishedThisRun, setPublishedThisRun] = useState(0);

  async function callActivation(dryRun: boolean) {
    const response = await fetch(
      "/api/seo/activate-migrated-articles",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: 20,
          dryRun,
        }),
      }
    );

    const data = (await response.json()) as ActivationResponse;

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Activation request failed."
      );
    }

    return data;
  }

  async function runDryCheck() {
    try {
      setError("");
      setMessage("Checking safe activation eligibility...");

      const data = await callActivation(true);

      setSummary(data.summary || null);
      setPublishedThisRun(0);

      setMessage(
        data.message ||
          "Safety check complete."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to run safety check."
      );
    }
  }

  async function publishSafeArticles() {
    if (running) return;

    try {
      setRunning(true);
      setStopping(false);
      stopRef.current = false;
      setError("");
      setPublishedThisRun(0);

      let totalPublished = 0;

      while (true) {
        if (stopRef.current) {
          setMessage(
            `Stopped safely. ${totalPublished} articles were published in this run.`
          );
          break;
        }

        setMessage(
          `Publishing safe migrated drafts in batches of 20... ${totalPublished} published so far.`
        );

        const data = await callActivation(false);
        const current = data.summary;

        if (current) {
          totalPublished += current.publishedNow;
          setPublishedThisRun(totalPublished);
          setSummary(current);
        }

        if (!data.hasMore) {
          setMessage(
            `Activation complete. ${totalPublished} articles were published in this run. Articles missing featured images remain drafts.`
          );
          break;
        }

        if (!current || current.publishedNow === 0) {
          throw new Error(
            "No articles were published in the current batch, so activation stopped to avoid an endless loop."
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish migrated articles."
      );
    } finally {
      setRunning(false);
      setStopping(false);
    }
  }

  function stopSafely() {
    if (!running) return;

    stopRef.current = true;
    setStopping(true);
    setMessage(
      "Stop requested. The current 20-article batch will finish first."
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>
              COINLYTX MIGRATION ACTIVATION
            </div>

            <h1 style={titleStyle}>
              Publish Migrated Articles
            </h1>

            <p style={subtitleStyle}>
              Safely switch migrated WordPress articles to the Supabase version
              without changing their existing URLs.
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
          <strong>Safe mode:</strong> only migrated drafts with title, slug,
          content, category, original publication date, and a featured image
          are published. The 24 articles currently missing featured images
          stay as drafts and WordPress continues serving those URLs.
        </section>

        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        <div style={messageStyle}>
          {message}
        </div>

        <section style={gridStyle}>
          <Stat
            label="Mapped"
            value={summary?.mappedWordPressArticles ?? 1076}
          />

          <Stat
            label="Already Published"
            value={summary?.alreadyPublished ?? 1}
          />

          <Stat
            label="Safe Eligible"
            value={summary?.eligibleToPublish ?? 0}
          />

          <Stat
            label="Missing Image"
            value={summary?.skippedMissingImage ?? 24}
          />

          <Stat
            label="Critical Blocks"
            value={summary?.blockedCritical ?? 0}
          />

          <Stat
            label="Published This Run"
            value={publishedThisRun}
          />
        </section>

        {summary && (
          <section style={statusPanelStyle}>
            <div>
              Remaining safe drafts:{" "}
              <strong>{summary.remainingEligible}</strong>
            </div>

            <div>
              Total drafts:{" "}
              <strong>{summary.draftArticles}</strong>
            </div>
          </section>
        )}

        <section style={actionsStyle}>
          <button
            type="button"
            onClick={runDryCheck}
            disabled={running}
            style={secondaryButtonStyle}
          >
            Run Safety Check
          </button>

          <button
            type="button"
            onClick={publishSafeArticles}
            disabled={running}
            style={{
              ...publishButtonStyle,
              opacity: running ? 0.6 : 1,
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running
              ? "Publishing..."
              : "Publish All Safe Articles"}
          </button>

          <button
            type="button"
            onClick={stopSafely}
            disabled={!running || stopping}
            style={{
              ...stopButtonStyle,
              opacity: !running || stopping ? 0.55 : 1,
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
  maxWidth: "1100px",
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
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

const errorStyle: React.CSSProperties = {
  padding: "13px 15px",
  borderRadius: "10px",
  background: "rgba(127,29,29,.3)",
  border: "1px solid rgba(248,113,113,.3)",
  color: "#fca5a5",
  marginBottom: "14px",
};

const messageStyle: React.CSSProperties = {
  padding: "13px 15px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#cbd5e1",
  marginBottom: "16px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const statStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  padding: "17px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "25px",
  fontWeight: 900,
};

const statLabelStyle: React.CSSProperties = {
  marginTop: "5px",
  color: "#64748b",
  fontSize: "10px",
  textTransform: "uppercase",
  fontWeight: 900,
};

const statusPanelStyle: React.CSSProperties = {
  display: "flex",
  gap: "18px",
  flexWrap: "wrap",
  padding: "14px 16px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#94a3b8",
  marginBottom: "16px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "9px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "#f8fafc",
  fontWeight: 900,
  cursor: "pointer",
};

const publishButtonStyle: React.CSSProperties = {
  padding: "12px 17px",
  borderRadius: "9px",
  border: 0,
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: 900,
};

const stopButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "9px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "#f8fafc",
  fontWeight: 900,
};
