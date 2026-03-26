"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const nextPath = searchParams.get("next") || "/dashboard";

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
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      const { data, error } = result;

      if (error) {
        setStatus(error.message);
        setStatusKind("error");
        return;
      }

      if (mode === "signin") {
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
        return;
      }

      setStatus("Account created. Check your email if confirmation is enabled, then sign in.");
      setStatusKind("success");
      setMode("signin");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to complete the auth request.");
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
              <span className="brand-tag">Authentication</span>
            </span>
          </Link>
          <nav className="nav">
            <Link className="nav-link" href="/">
              Home
            </Link>
            <Link className="nav-link" href="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="shell auth-surface">
        <div className="auth-intro">
          <span className="eyebrow">Website-first authentication</span>
          <h1 className="page-title">Sign in on the web. Connect the extension after that.</h1>
          <p className="page-copy">
            The website is now the only place where account access happens. The extension does not collect credentials.
            Instead it requests a secure session from the website through the Worker.
          </p>
          <div className="info-stack">
            <div className="info-card">
              <strong>Website</strong>
              <span>Owns sign up, sign in, and account state.</span>
            </div>
            <div className="info-card">
              <strong>Worker</strong>
              <span>Validates web sessions and issues extension sessions.</span>
            </div>
            <div className="info-card">
              <strong>Extension</strong>
              <span>Connects after web auth and uses its own Worker session token.</span>
            </div>
          </div>
        </div>

        <section className="auth-card">
          <div className="auth-toggle">
            <button className={`tab-button${mode === "signin" ? " active" : ""}`} onClick={() => setMode("signin")} type="button">
              Sign in
            </button>
            <button className={`tab-button${mode === "signup" ? " active" : ""}`} onClick={() => setMode("signup")} type="button">
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className={`status ${statusKind !== "idle" ? statusKind : ""}`}>{status}</div>
            <button className="primary-button wide-button" disabled={loading} type="submit">
              {loading ? "Working..." : mode === "signin" ? "Sign in to Knowlense" : "Create account"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="app-shell"><section className="shell auth-surface"><div className="empty-state">Loading authentication...</div></section></main>}>
      <AuthPageContent />
    </Suspense>
  );
}
