"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { mapSignInError } from "@/lib/auth/errors";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const nextPath = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function hydrateSession() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active || !session?.access_token) {
        return;
      }

      router.replace(nextPath);
    }

    void hydrateSession();

    return () => {
      active = false;
    };
  }, [nextPath, router, supabase]);

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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const mappedMessage = mapSignInError(error.message);
        setStatus(mappedMessage);
        setStatusKind("error");
        return;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setStatus("Supabase did not return an access token.");
        setStatusKind("error");
        return;
      }

      const profile = await fetchApiProfile(accessToken);
      setStatus(`Signed in as ${profile.email ?? profile.id}. Redirecting...`);
      setStatusKind("success");
      router.push(nextPath);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to sign in.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <SiteHeader tag="Sign in" navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/auth/sign-up", label: "Create account" }]} />

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Website sign in</span>
          <h1 className="page-title auth-title">Access your account</h1>
          <p className="page-copy">Sign in on the website first, then connect the extension from a separate approval flow.</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className={`status ${statusKind !== "idle" ? statusKind : ""}`}>{status}</div>
            <button className="primary-button wide-button" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="stack-row">
            <Link className="nav-link" href="/auth/sign-up">
              Create account
            </Link>
            <Link className="nav-link" href={`/auth/verify-email${email ? `?email=${encodeURIComponent(email)}` : ""}`}>
              Verify email
            </Link>
            <Link className="nav-link" href="/auth/forgot-password">
              Forgot password
            </Link>
          </div>
          <p className="auth-support-note">
            If your email has not been confirmed yet, use the verification flow first. Password recovery and account
            updates are handled on dedicated website routes.
          </p>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="app-shell"><section className="shell auth-surface single-card"><div className="empty-state">Loading sign-in...</div></section></main>}>
      <SignInContent />
    </Suspense>
  );
}
