"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSignupRedirectUrl } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState("Check your inbox and click the confirmation link.");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    if (!email) {
      setStatus("No email was provided for the confirmation flow.");
      setStatusKind("error");
      return;
    }

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setStatusKind("error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getSignupRedirectUrl()
        }
      });

      if (error) {
        setStatus(error.message);
        setStatusKind("error");
        return;
      }

      setStatus("Confirmation email sent again. Check your inbox.");
      setStatusKind("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to resend confirmation email.");
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
              <span className="brand-tag">Verify email</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Email confirmation</span>
          <h1 className="page-title" style={{ fontSize: "2.4rem" }}>Verify your email address</h1>
          <p className="page-copy">{email ? `We sent a confirmation email to ${email}.` : "We sent a confirmation email to your inbox."}</p>
          <div className={`status ${statusKind !== "idle" ? statusKind : ""}`}>{status}</div>
          <div className="stack-row">
            <button className="primary-button" disabled={loading} onClick={handleResend} type="button">
              {loading ? "Sending..." : "Resend confirmation email"}
            </button>
            <Link className="secondary-button" href="/auth/sign-in">
              Back to sign in
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="app-shell"><section className="shell auth-surface single-card"><div className="empty-state">Loading email verification...</div></section></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
