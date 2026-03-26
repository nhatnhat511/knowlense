"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validatePassword } from "@/lib/auth/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Checking website session...");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase configuration.");
      setStatusKind("error");
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

      if (!session?.access_token) {
        router.replace("/auth/sign-in?next=/auth/change-password");
        return;
      }

      setReady(true);
      setStatus("Set a new password for your account.");
      setStatusKind("success");
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const passwordValidation = validatePassword(password, confirmPassword);
    if (passwordValidation) {
      setStatus(passwordValidation.message);
      setStatusKind(passwordValidation.kind === "error" ? "error" : "idle");
      return;
    }

    if (!ready || !supabase) {
      setStatus("A valid session was not found.");
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

      setStatus("Password updated successfully.");
      setStatusKind("success");
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
              <span className="brand-tag">Change password</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Account security</span>
          <h1 className="page-title" style={{ fontSize: "2.4rem" }}>Change your password</h1>
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
              {loading ? "Updating..." : "Change password"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
