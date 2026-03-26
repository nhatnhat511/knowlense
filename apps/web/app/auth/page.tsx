"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        router.push("/dashboard");
        return;
      }

      setStatus("Account created. You can sign in now.");
      setStatusKind("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to complete the auth request.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Account access</span>
            </span>
          </Link>
          <nav className="nav">
            <Link className="nav-link" href="/">
              Home
            </Link>
            <Link className="primary-button" href="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="auth-shell">
        <div className="shell auth-layout">
          <div className="auth-stack">
            <article className="auth-sidebar-card">
              <span className="eyebrow">Unified session model</span>
              <h1 className="auth-title" style={{ marginTop: 18 }}>
                One account across the website, extension, and API.
              </h1>
              <p className="muted" style={{ marginTop: 16 }}>
                Sign-in happens through Supabase. Session trust happens through the Worker API. That gives you a cleaner
                foundation for billing, usage limits, and feature gating later.
              </p>
            </article>

            <article className="auth-sidebar-card">
              <h3>Current auth stack</h3>
              <ul className="clean-list">
                <li>Email and password with Supabase</li>
                <li>Session validation via `GET /v1/me`</li>
                <li>Ready for billing-aware account states next</li>
              </ul>
            </article>
          </div>

          <section className="auth-panel">
            <span className="eyebrow">Secure access</span>
            <h2 style={{ margin: "18px 0 10px", fontSize: "2rem", letterSpacing: "-0.04em" }}>Access your workspace</h2>
            <p className="muted">Use the same credentials here and in the Chrome extension popup.</p>

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
                <label htmlFor="email">Work email</label>
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
              <div className="stack-row">
                <button className="primary-button" disabled={loading} type="submit">
                  {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
                </button>
                <Link className="ghost-button" href="/">
                  Back to homepage
                </Link>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
