"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewArticlePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");

  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const wordCount = useMemo(() => {
    const cleanText = content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) {
      return 0;
    }

    return cleanText.split(" ").filter(Boolean).length;
  }, [content]);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(makeSlug(value));
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/cms/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          content,
          seoTitle,
          metaDescription,
          focusKeyword,
          canonicalUrl,
          status: "draft",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.details ||
            result?.error ||
            result?.message ||
            "Unable to save article."
        );
      }

      setMessage("Draft saved successfully.");

      setTimeout(() => {
        router.push("/admin/posts");
        router.refresh();
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save article."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    borderRadius: "10px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#f8fafc",
    fontSize: "15px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    color: "#cbd5e1",
    fontSize: "14px",
    fontWeight: 700,
  };

  const cardStyle: React.CSSProperties = {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "24px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#f8fafc",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "1250px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "32px",
          }}
        >
          <div>
            <div
              style={{
                color: "#22c55e",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "0.06em",
                marginBottom: "8px",
              }}
            >
              COINLYTX CMS
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "34px",
              }}
            >
              Create Article
            </h1>

            <p
              style={{
                color: "#94a3b8",
                marginTop: "10px",
                marginBottom: 0,
              }}
            >
              Create a Coinlytx article and prepare it for SEO analysis.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/posts")}
            style={{
              padding: "11px 16px",
              borderRadius: "9px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#cbd5e1",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ← Back to Articles
          </button>
        </div>

        <form onSubmit={saveDraft}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 2fr) minmax(300px, 1fr)",
              gap: "24px",
              alignItems: "start",
            }}
          >
            {/* LEFT SIDE */}

            <section>
              <div
                style={{
                  ...cardStyle,
                  marginBottom: "24px",
                }}
              >
                <label style={labelStyle}>
                  Article Title *
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    handleTitleChange(event.target.value)
                  }
                  placeholder="Enter article title"
                  required
                  style={{
                    ...inputStyle,
                    fontSize: "20px",
                    fontWeight: 700,
                  }}
                />

                <div style={{ height: "20px" }} />

                <label style={labelStyle}>
                  URL Slug *
                </label>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #334155",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: "#020617",
                  }}
                >
                  <span
                    style={{
                      paddingLeft: "14px",
                      color: "#64748b",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    coinlytx.com/
                  </span>

                  <input
                    type="text"
                    value={slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      setSlug(makeSlug(event.target.value));
                    }}
                    required
                    style={{
                      ...inputStyle,
                      border: "none",
                      borderRadius: 0,
                    }}
                  />
                </div>

                <div style={{ height: "20px" }} />

                <label style={labelStyle}>
                  Excerpt
                </label>

                <textarea
                  value={excerpt}
                  onChange={(event) =>
                    setExcerpt(event.target.value)
                  }
                  placeholder="Write a short summary of the article..."
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    lineHeight: 1.6,
                  }}
                />
              </div>

              {/* ARTICLE EDITOR */}

              <div
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "16px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "15px 20px",
                    borderBottom: "1px solid #1e293b",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong>Article Content *</strong>

                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    {wordCount} words
                  </span>
                </div>

                <div
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid #1e293b",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    background: "#0b1220",
                  }}
                >
                  {[
                    "H2",
                    "H3",
                    "Bold",
                    "Italic",
                    "Link",
                    "Image",
                    "Quote",
                  ].map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled
                      title="Rich text controls will be enabled in the next editor stage."
                      style={{
                        padding: "7px 10px",
                        borderRadius: "7px",
                        border: "1px solid #334155",
                        background: "#111827",
                        color: "#64748b",
                        cursor: "not-allowed",
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <textarea
                  value={content}
                  onChange={(event) =>
                    setContent(event.target.value)
                  }
                  required
                  placeholder="Write or paste your article here..."
                  style={{
                    width: "100%",
                    minHeight: "600px",
                    boxSizing: "border-box",
                    padding: "22px",
                    border: 0,
                    outline: 0,
                    resize: "vertical",
                    background: "#020617",
                    color: "#e2e8f0",
                    fontSize: "16px",
                    lineHeight: 1.8,
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </section>

            {/* RIGHT SIDE */}

            <aside>
              {/* SEO */}

              <div
                style={{
                  ...cardStyle,
                  marginBottom: "24px",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: "22px",
                    fontSize: "18px",
                  }}
                >
                  SEO Settings
                </h2>

                <label style={labelStyle}>
                  Focus Keyword
                </label>

                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(event) =>
                    setFocusKeyword(event.target.value)
                  }
                  placeholder="e.g. bitcoin price"
                  style={inputStyle}
                />

                <div style={{ height: "18px" }} />

                <label style={labelStyle}>
                  SEO Title
                </label>

                <input
                  type="text"
                  value={seoTitle}
                  onChange={(event) =>
                    setSeoTitle(event.target.value)
                  }
                  placeholder="Search engine title"
                  style={inputStyle}
                />

                <div
                  style={{
                    marginTop: "6px",
                    textAlign: "right",
                    fontSize: "12px",
                    color:
                      seoTitle.length > 60
                        ? "#f87171"
                        : "#64748b",
                  }}
                >
                  {seoTitle.length}/60
                </div>

                <div style={{ height: "12px" }} />

                <label style={labelStyle}>
                  Meta Description
                </label>

                <textarea
                  value={metaDescription}
                  onChange={(event) =>
                    setMetaDescription(event.target.value)
                  }
                  placeholder="Description for search results..."
                  rows={5}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />

                <div
                  style={{
                    marginTop: "6px",
                    textAlign: "right",
                    fontSize: "12px",
                    color:
                      metaDescription.length > 160
                        ? "#f87171"
                        : "#64748b",
                  }}
                >
                  {metaDescription.length}/160
                </div>

                <div style={{ height: "12px" }} />

                <label style={labelStyle}>
                  Canonical URL
                </label>

                <input
                  type="url"
                  value={canonicalUrl}
                  onChange={(event) =>
                    setCanonicalUrl(event.target.value)
                  }
                  placeholder={
                    slug
                      ? `https://coinlytx.com/${slug}`
                      : "https://coinlytx.com/article-slug"
                  }
                  style={inputStyle}
                />

                <p
                  style={{
                    marginBottom: 0,
                    color: "#64748b",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Leave empty to automatically use the Coinlytx article URL.
                </p>
              </div>

              {/* SEO AGENT */}

              <div
                style={{
                  ...cardStyle,
                  marginBottom: "24px",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: "8px",
                    fontSize: "18px",
                  }}
                >
                  Coinlytx SEO Agent
                </h2>

                <p
                  style={{
                    marginTop: 0,
                    color: "#64748b",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  Article analysis will connect to your existing SEO engine.
                </p>

                <div
                  style={{
                    marginTop: "20px",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  {[
                    ["SEO Score", "—"],
                    ["Content Quality", "—"],
                    ["Index Readiness", "—"],
                    ["Internal Links", "—"],
                    ["Technical SEO", "—"],
                  ].map(([name, score]) => (
                    <div
                      key={name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingBottom: "9px",
                        borderBottom: "1px solid #1e293b",
                        color: "#cbd5e1",
                        fontSize: "14px",
                      }}
                    >
                      <span>{name}</span>

                      <strong>{score}</strong>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled
                  style={{
                    width: "100%",
                    marginTop: "20px",
                    padding: "12px",
                    borderRadius: "9px",
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#64748b",
                    cursor: "not-allowed",
                    fontWeight: 700,
                  }}
                >
                  Analyze Article — Next Stage
                </button>
              </div>

              {/* INTERNAL LINK PREVIEW */}

              <div
                style={{
                  ...cardStyle,
                  marginBottom: "24px",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    fontSize: "18px",
                  }}
                >
                  Internal Link Suggestions
                </h2>

                <p
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    marginBottom: 0,
                  }}
                >
                  After the SEO agent is connected, relevant existing
                  Coinlytx articles and recommended anchor text will appear
                  here.
                </p>
              </div>

              {/* MESSAGES */}

              {error && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "14px",
                    borderRadius: "10px",
                    border:
                      "1px solid rgba(248,113,113,0.25)",
                    background: "rgba(127,29,29,0.25)",
                    color: "#fca5a5",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "14px",
                    borderRadius: "10px",
                    border:
                      "1px solid rgba(74,222,128,0.25)",
                    background: "rgba(20,83,45,0.3)",
                    color: "#86efac",
                    fontSize: "14px",
                  }}
                >
                  {message}
                </div>
              )}

              {/* SAVE */}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "15px",
                  border: 0,
                  borderRadius: "10px",
                  background: saving
                    ? "#334155"
                    : "#22c55e",
                  color: saving
                    ? "#94a3b8"
                    : "#052e16",
                  fontWeight: 900,
                  fontSize: "15px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {saving
                  ? "Saving Draft..."
                  : "Save Draft"}
              </button>

              <p
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "12px",
                  marginTop: "10px",
                }}
              >
                Drafts are not publicly visible.
              </p>
            </aside>
          </div>
        </form>
      </div>

      {/* Responsive layout */}
      <style jsx>{`
        @media (max-width: 900px) {
          form > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}