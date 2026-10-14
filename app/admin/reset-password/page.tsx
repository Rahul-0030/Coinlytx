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

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [recoveryReady, setRecoveryReady] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      try {
        setChecking(true);
        setError("");

        const supabase =
          getSupabase();

        const currentUrl =
          new URL(window.location.href);

        const code =
          currentUrl.searchParams.get(
            "code"
          );

        const hashParams =
          new URLSearchParams(
            window.location.hash.replace(
              /^#/,
              ""
            )
          );

        const accessToken =
          hashParams.get(
            "access_token"
          );

        const refreshToken =
          hashParams.get(
            "refresh_token"
          );

        if (
          accessToken &&
          refreshToken
        ) {
          const {
            error: sessionError,
          } =
            await supabase.auth.setSession(
              {
                access_token:
                  accessToken,
                refresh_token:
                  refreshToken,
              }
            );

          if (sessionError) {
            throw sessionError;
          }
        } else if (code) {
          const {
            error: exchangeError,
          } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { session },
          error: sessionCheckError,
        } =
          await supabase.auth.getSession();

        if (sessionCheckError) {
          throw sessionCheckError;
        }

        if (!session) {
          throw new Error(
            "This password recovery link is invalid or has expired. Please request a new reset link."
          );
        }

        window.history.replaceState(
          {},
          document.title,
          "/admin/reset-password"
        );

        if (mounted) {
          setRecoveryReady(true);
        }
      } catch (err) {
        if (mounted) {
          setRecoveryReady(false);

          setError(
            err instanceof Error
              ? err.message
              : "Unable to verify the password recovery link."
          );
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      if (!recoveryReady) {
        throw new Error(
          "Password recovery session is not available. Request a new reset link."
        );
      }

      if (password.length < 8) {
        throw new Error(
          "Password must contain at least 8 characters."
        );
      }

      if (
        password !== confirmPassword
      ) {
        throw new Error(
          "Passwords do not match."
        );
      }

      const supabase =
        getSupabase();

      const {
        data,
        error: updateError,
      } =
        await supabase.auth.updateUser(
          {
            password,
          }
        );

      if (updateError) {
        throw updateError;
      }

      if (!data.user) {
        throw new Error(
          "Unable to update password."
        );
      }

      setSuccess(
        "Password updated successfully. Redirecting to login..."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace(
          "/admin/login?reset=success"
        );

        router.refresh();
      }, 1200);
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

  function goToLogin() {
    router.replace("/admin/login");
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

        {checking && (
          <div style={infoStyle}>
            Verifying password recovery
            link...
          </div>
        )}

        {!checking &&
          recoveryReady && (
            <form
              onSubmit={handleSubmit}
            >
              <label
                style={labelStyle}
              >
                New Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="New password"
                autoComplete="new-password"
                style={inputStyle}
                required
              />

              <label
                style={labelStyle}
              >
                Confirm Password
              </label>

              <input
                type="password"
                value={
                  confirmPassword
                }
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Confirm new password"
                autoComplete="new-password"
                style={inputStyle}
                required
              />

              {error && (
                <div
                  style={errorStyle}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={successStyle}
                >
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...buttonStyle,
                  opacity: loading
                    ? 0.65
                    : 1,
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
          )}

        {!checking &&
          !recoveryReady && (
            <>
              {error && (
                <div
                  style={errorStyle}
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={goToLogin}
                style={buttonStyle}
              >
                Request New Reset Link
              </button>
            </>
          )}
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
  cursor: "pointer",
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

const infoStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "8px",
  background: "rgba(30,64,175,.25)",
  border:
    "1px solid rgba(96,165,250,.3)",
  color: "#bfdbfe",
};