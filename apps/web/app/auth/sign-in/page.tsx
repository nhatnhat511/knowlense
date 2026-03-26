"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
        setStatus(error.message);
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
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Sign in</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Website sign in</span>
          <h1 className="page-title" style={{ fontSize: "2.6rem" }}>Access your account</h1>
          <p className="page-copy">Sign in here first. The extension can be connected afterward through the website.</p>
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
            <Link className="nav-link" href="/auth/forgot-password">
              Forgot password
            </Link>
          </div>
        </section>
      </section>
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
