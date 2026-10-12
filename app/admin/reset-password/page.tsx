"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (password.length < 8) {
        throw new Error(
          "Password must contain at least 8 characters."
        );
      }

      if (password !== confirmPassword) {
        throw new Error(
          "Passwords do not match."
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        "Password updated successfully."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/admin/login");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>
          COINLYTX ADMIN
        </div>

        <h1 style={titleStyle}>
          Set New Password
        </h1>

        <p style={descriptionStyle}>
          Enter a new password for your
          Coinlytx admin account.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            New Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            placeholder="New password"
            autoComplete="new-password"
            style={inputStyle}
          />

          <label style={labelStyle}>
            Confirm Password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
            placeholder="Confirm new password"
            autoComplete="new-password"
            style={inputStyle}
          />

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
              ? "Updating..."
              : "Update Password"}
          </button>
        </form>
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
  background: "#020617",
  color: "#f8fafc",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  padding: "32px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "16px",
};

const brandStyle: React.CSSProperties = {
  color: "#22c55e",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: ".1em",
  marginBottom: "10px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "30px",
  margin: "0 0 8px",
};

const descriptionStyle: React.CSSProperties = {
  color: "#94a3b8",
  lineHeight: 1.6,
  marginBottom: "25px",
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
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: "9px",
  padding: "14px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 900,
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