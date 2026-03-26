"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validatePassword } from "@/lib/auth/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Open this page from the password reset email sent by Supabase.");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function hydrate() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (session?.access_token) {
        setReady(true);
        setStatus("Recovery session detected. Set your new password.");
        setStatusKind("success");
      }
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event) => {
      if (!active) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setStatus("Recovery session detected. Set your new password.");
        setStatusKind("success");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready) {
      setStatus("A valid recovery session was not found. Use the reset email again.");
      setStatusKind("error");
      return;
    }

    const passwordValidation = validatePassword(password, confirmPassword);
    if (passwordValidation) {
      setStatus(passwordValidation.message);
      setStatusKind(passwordValidation.kind === "error" ? "error" : "idle");
      return;
    }

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setStatusKind("error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setStatus(error.message);
        setStatusKind("error");
        return;
      }

      setStatus("Password updated. Redirecting to sign in...");
      setStatusKind("success");
      setTimeout(() => router.push("/auth/sign-in"), 1200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update password.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Update password</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Password update</span>
          <h1 className="page-title" style={{ fontSize: "2.4rem" }}>Set a new password</h1>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            <div className={`status ${statusKind !== "idle" ? statusKind : ""}`}>{status}</div>
            <button className="primary-button wide-button" disabled={loading} type="submit">
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
