import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  word_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function StatusBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase() || "draft";

  let background = "rgba(148,163,184,.12)";
  let color = "#cbd5e1";
  let border = "rgba(148,163,184,.25)";

  if (normalized === "published") {
    background = "rgba(34,197,94,.12)";
    color = "#86efac";
    border = "rgba(34,197,94,.25)";
  }

  if (normalized === "draft") {
    background = "rgba(245,158,11,.12)";
    color = "#fcd34d";
    border = "rgba(245,158,11,.25)";
  }

  if (normalized === "scheduled") {
    background = "rgba(59,130,246,.12)";
    color = "#93c5fd";
    border = "rgba(59,130,246,.25)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 9px",
        borderRadius: "999px",
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: "12px",
        fontWeight: 800,
        textTransform: "capitalize",
      }}
    >
      {normalized}
    </span>
  );
}

export default async function AdminPostsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("articles")
    .select(
      `
        id,
        title,
        slug,
        status,
        word_count,
        created_at,
        updated_at
      `
    )
    .order("created_at", {
      ascending: false,
    });

  const articles = (data ?? []) as Article[];

  const totalArticles = articles.length;

  const drafts = articles.filter(
    (article) =>
      article.status?.toLowerCase() === "draft"
  ).length;

  const published = articles.filter(
    (article) =>
      article.status?.toLowerCase() === "published"
  ).length;

  const scheduled = articles.filter(
    (article) =>
      article.status?.toLowerCase() === "scheduled"
  ).length;

  const cardStyle: React.CSSProperties = {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "14px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#f8fafc",
        padding: "40px 24px 80px",
      }}
    >
      <div
        style={{
          maxWidth: "1350px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "30px",
          }}
        >
          <div>
            <div
              style={{
                color: "#22c55e",
                fontSize: "13px",
                fontWeight: 900,
                letterSpacing: ".06em",
                marginBottom: "8px",
              }}
            >
              COINLYTX CMS
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "36px",
              }}
            >
              Articles
            </h1>

            <p
              style={{
                marginTop: "9px",
                marginBottom: 0,
                color: "#94a3b8",
              }}
            >
              Manage Coinlytx articles, drafts and publishing.
            </p>
          </div>

          <Link
            href="/admin/posts/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "13px 18px",
              borderRadius: "10px",
              background: "#22c55e",
              color: "#052e16",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            + New Article
          </Link>
        </div>

        {/* STATISTICS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginBottom: "26px",
          }}
        >
          <StatCard
            label="Total Articles"
            value={totalArticles}
          />

          <StatCard
            label="Drafts"
            value={drafts}
          />

          <StatCard
            label="Published"
            value={published}
          />

          <StatCard
            label="Scheduled"
            value={scheduled}
          />
        </div>

        {/* DATABASE ERROR */}

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "15px 17px",
              borderRadius: "10px",
              border:
                "1px solid rgba(248,113,113,.3)",
              background: "rgba(127,29,29,.25)",
              color: "#fca5a5",
            }}
          >
            <strong>Unable to load articles.</strong>

            <div
              style={{
                marginTop: "6px",
                fontSize: "13px",
              }}
            >
              {error.message}
            </div>
          </div>
        )}

        {/* ARTICLE TABLE */}

        <section
          style={{
            ...cardStyle,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: "17px",
                }}
              >
                Article Library
              </strong>

              <div
                style={{
                  marginTop: "4px",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                Supabase article database
              </div>
            </div>

            {user?.email && (
              <div
                style={{
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                Signed in as {user.email}
              </div>
            )}
          </div>

          {articles.length === 0 ? (
            <div
              style={{
                padding: "70px 25px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "38px",
                  marginBottom: "15px",
                }}
              >
                📝
              </div>

              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: "20px",
                }}
              >
                No articles yet
              </h2>

              <p
                style={{
                  color: "#64748b",
                  marginTop: 0,
                }}
              >
                Create your first Coinlytx article.
              </p>

              <Link
                href="/admin/posts/new"
                style={{
                  display: "inline-block",
                  marginTop: "12px",
                  padding: "11px 16px",
                  borderRadius: "9px",
                  background: "#22c55e",
                  color: "#052e16",
                  textDecoration: "none",
                  fontWeight: 900,
                }}
              >
                Create Article
              </Link>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "900px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#0b1220",
                      textAlign: "left",
                    }}
                  >
                    <TableHeading>
                      Article
                    </TableHeading>

                    <TableHeading>
                      Status
                    </TableHeading>

                    <TableHeading>
                      Words
                    </TableHeading>

                    <TableHeading>
                      Created
                    </TableHeading>

                    <TableHeading>
                      Updated
                    </TableHeading>

                    <TableHeading>
                      Actions
                    </TableHeading>
                  </tr>
                </thead>

                <tbody>
                  {articles.map((article) => (
                    <tr
                      key={article.id}
                      style={{
                        borderTop:
                          "1px solid #1e293b",
                      }}
                    >
                      <td
                        style={{
                          padding: "18px 20px",
                          maxWidth: "400px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#f8fafc",
                            marginBottom: "6px",
                          }}
                        >
                          {article.title}
                        </div>

                        <div
                          style={{
                            color: "#64748b",
                            fontSize: "12px",
                            overflow: "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          /{article.slug}
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "18px 20px",
                        }}
                      >
                        <StatusBadge
                          status={article.status}
                        />
                      </td>

                      <td
                        style={{
                          padding: "18px 20px",
                          color: "#cbd5e1",
                        }}
                      >
                        {article.word_count ?? 0}
                      </td>

                      <td
                        style={{
                          padding: "18px 20px",
                          color: "#94a3b8",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(
                          article.created_at
                        )}
                      </td>

                      <td
                        style={{
                          padding: "18px 20px",
                          color: "#94a3b8",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(
                          article.updated_at
                        )}
                      </td>

                      <td
                        style={{
                          padding: "18px 20px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                          }}
                        >
                          <Link
                            href={`/admin/posts/${article.id}/edit`}
                            style={{
                              padding:
                                "8px 11px",
                              borderRadius:
                                "7px",
                              border:
                                "1px solid #334155",
                              color:
                                "#cbd5e1",
                              textDecoration:
                                "none",
                              fontSize:
                                "13px",
                              fontWeight:
                                700,
                            }}
                          >
                            Edit
                          </Link>

                          {article.status ===
                            "published" && (
                            <a
                              href={`https://coinlytx.com/${article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding:
                                  "8px 11px",
                                borderRadius:
                                  "7px",
                                border:
                                  "1px solid #334155",
                                color:
                                  "#93c5fd",
                                textDecoration:
                                  "none",
                                fontSize:
                                  "13px",
                                fontWeight:
                                  700,
                              }}
                            >
                              View
                            </a>
                          )}
                        </div>
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
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "13px",
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "27px",
          fontWeight: 900,
          color: "#f8fafc",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      style={{
        padding: "13px 20px",
        color: "#94a3b8",
        fontSize: "12px",
        fontWeight: 800,
      }}
    >
      {children}
    </th>
  );
}