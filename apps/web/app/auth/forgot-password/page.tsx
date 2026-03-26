"use client";

import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { useMemo, useState } from "react";
import { getPasswordResetRedirectUrl } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setStatusKind("idle");

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setStatusKind("error");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl()
      });

      if (error) {
        setStatus(error.message);
        setStatusKind("error");
        return;
      }

      setStatus("Password reset email sent. Check your inbox.");
      setStatusKind("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send password reset email.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <SiteHeader tag="Forgot password" navItems={[{ href: "/auth/sign-in", label: "Sign in" }, { href: "/auth/sign-up", label: "Create account" }]} />

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Password recovery</span>
          <h1 className="page-title auth-title">Request a reset email</h1>
          <p className="page-copy">
            Enter the email tied to your Knowlense account. If it exists, Supabase will send a recovery link to the
            configured reset route.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className={`status ${statusKind !== "idle" ? statusKind : ""}`}>{status}</div>
            <button className="primary-button wide-button" disabled={loading} type="submit">
              {loading ? "Sending..." : "Send reset email"}
            </button>
          </form>
          <div className="stack-row">
            <Link className="nav-link" href="/auth/sign-in">
              Back to sign in
            </Link>
          </div>
          <p className="auth-support-note">
            If you do not receive the email, confirm that you used the correct address and check any spam or promotions
            folders before trying again.
          </p>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
