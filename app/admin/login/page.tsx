"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase configuration is missing."
    );
  }

  return createBrowserClient(url, key);
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<
    "login" | "forgot"
  >("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("reset") === "success") {
      setSuccess(
        "Password updated successfully. You can now sign in."
      );

      window.history.replaceState(
        {},
        "",
        "/admin/login"
      );
    }
  }, []);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (!email.trim()) {
        throw new Error(
          "Enter your email address."
        );
      }

      if (!password) {
        throw new Error(
          "Enter your password."
        );
      }

      const supabase = getSupabase();

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

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const cleanEmail = email.trim();

      if (!cleanEmail) {
        throw new Error(
          "Enter your email address first."
        );
      }

      const supabase = getSupabase();

      const redirectTo =
        `${window.location.origin}/admin/reset-password`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

      if (resetError) {
        throw resetError;
      }

      setSuccess(
        "Password recovery email sent. Check your inbox and open the newest reset link."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send recovery email."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setError("");
    setSuccess("");
    setPassword("");

    setMode((current) =>
      current === "login"
        ? "forgot"
        : "login"
    );
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>
          COINLYTX ADMIN
        </div>

        <h1 style={titleStyle}>
          {mode === "login"
            ? "Admin Login"
            : "Forgot Password"}
        </h1>

        <p style={descriptionStyle}>
          {mode === "login"
            ? "Sign in to manage Coinlytx articles and SEO."
            : "Enter your admin email and we will send you a password reset link."}
        </p>

        <form
          onSubmit={
            mode === "login"
              ? handleLogin
              : handleForgotPassword
          }
        >
          <label style={labelStyle}>
            Email Address
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="you@example.com"
            autoComplete="email"
            required
            style={inputStyle}
          />

          {mode === "login" && (
            <>
              <label style={labelStyle}>
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Your password"
                autoComplete="current-password"
                required
                style={inputStyle}
              />
            </>
          )}

          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}

          {success && (
            <div style={successStyle}>
              {success}
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
              ? mode === "login"
                ? "Signing in..."
                : "Sending..."
              : mode === "login"
                ? "Sign In"
                : "Send Reset Link"}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          disabled={loading}
          style={linkButtonStyle}
        >
          {mode === "login"
            ? "Forgot your password?"
            : "Back to login"}
        </button>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "24px",
  background:
    "linear-gradient(135deg, #020617 0%, #0f172a 100%)",
  color: "#f8fafc",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "430px",
  padding: "34px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "18px",
  boxShadow:
    "0 20px 60px rgba(0,0,0,.35)",
};

const brandStyle: React.CSSProperties = {
  color: "#22c55e",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: ".12em",
  marginBottom: "10px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "30px",
  margin: "0 0 8px",
};

const descriptionStyle: React.CSSProperties = {
  color: "#94a3b8",
  lineHeight: 1.6,
  marginBottom: "26px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 800,
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "9px",
  padding: "13px",
  color: "#ffffff",
  marginBottom: "18px",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: "9px",
  padding: "14px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "14px",
};

const linkButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "18px",
  border: 0,
  background: "transparent",
  color: "#60a5fa",
  cursor: "pointer",
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  padding: "11px",
  marginBottom: "15px",
  borderRadius: "8px",
  background: "rgba(127,29,29,.3)",
  border:
    "1px solid rgba(248,113,113,.3)",
  color: "#fca5a5",
};

const successStyle: React.CSSProperties = {
  padding: "11px",
  marginBottom: "15px",
  borderRadius: "8px",
  background: "rgba(20,83,45,.35)",
  border:
    "1px solid rgba(34,197,94,.3)",
  color: "#86efac",
};