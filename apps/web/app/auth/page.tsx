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
      setLoading(false);
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setStatusKind("error");
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
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Knowlense
        </Link>
        <nav className="nav">
          <Link className="ghost-button" href="/">
            Back home
          </Link>
          <Link className="primary-button" href="/dashboard">
            Dashboard
          </Link>
        </nav>
      </header>

      <section className="auth-shell">
        <div className="auth-layout">
          <aside className="panel auth-panel">
            <div className="eyebrow">Account foundation</div>
            <h2 className="section-title">One login for the site and the extension.</h2>
            <p className="muted">
              This first pass uses Supabase email/password auth so both the web app and Chrome extension can share the
              same account model without extra OAuth complexity.
            </p>
            <div className="metric-card">
              <div className="metric-label">Current implementation</div>
              <div className="metric-value">Email + password auth</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Next natural step</div>
              <div className="metric-value">Protected dashboard and billing state</div>
            </div>
          </aside>

          <section className="auth-card">
            <h1>Access Knowlense</h1>
            <p className="muted">Use the same credentials here and inside the extension popup.</p>

            <div className="auth-toggle">
              <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">
                Sign in
              </button>
              <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">
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
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
