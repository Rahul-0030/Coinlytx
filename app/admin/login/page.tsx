"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      if (!email.trim()) {
        throw new Error("Enter your email.");
      }

      if (!password) {
        throw new Error("Enter your password.");
      }

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      router.replace("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={loginBoxStyle}>
        <div style={brandStyle}>
          COINLYTX ADMIN
        </div>

        <h1 style={titleStyle}>
          Sign in
        </h1>

        <p style={descriptionStyle}>
          Sign in to manage articles and SEO tools.
        </p>

        <form onSubmit={handleLogin}>
          <label style={labelStyle}>
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="admin@coinlytx.com"
            autoComplete="email"
            style={inputStyle}
          />

          <label style={labelStyle}>
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter password"
            autoComplete="current-password"
            style={inputStyle}
          />

          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.65 : 1,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#020617",
  padding: "24px",
  color: "#f8fafc",
};

const loginBoxStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "16px",
  padding: "32px",
  boxShadow:
    "0 24px 70px rgba(0,0,0,.35)",
};

const brandStyle: React.CSSProperties = {
  color: "#22c55e",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: ".1em",
  marginBottom: "10px",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "32px",
};

const descriptionStyle: React.CSSProperties = {
  color: "#94a3b8",
  lineHeight: 1.6,
  margin: "0 0 28px",
  fontSize: "14px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#e2e8f0",
  fontSize: "13px",
  fontWeight: 800,
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#020617",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: "9px",
  padding: "13px 14px",
  fontSize: "14px",
  outline: "none",
  marginBottom: "18px",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: "9px",
  padding: "14px",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 900,
};

const errorStyle: React.CSSProperties = {
  background: "rgba(127,29,29,.3)",
  border:
    "1px solid rgba(248,113,113,.3)",
  color: "#fca5a5",
  borderRadius: "8px",
  padding: "11px",
  fontSize: "12px",
  lineHeight: 1.5,
  marginBottom: "16px",
};