"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchApiProfile, type ApiProfile, getApiBaseUrl } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionState, setSessionState] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("Checking /v1/me");

  useEffect(() => {
    if (!supabase) {
      setApiStatus("Missing Supabase configuration");
      setLoading(false);
      return;
    }

    const client = supabase;
    let active = true;

    async function loadSession() {
      setApiStatus("Checking /v1/me");

      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.access_token) {
        setSessionState(null);
        setApiStatus("No active access token");
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchApiProfile(session.access_token);
        if (!active) {
          return;
        }

        setSessionState(profile);
        setApiStatus("Session validated via API");
      } catch (error) {
        if (!active) {
          return;
        }

        setSessionState(null);
        setApiStatus(error instanceof Error ? error.message : "Unable to validate session");
      }

      setLoading(false);
    }

    void loadSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSessionState(null);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Knowlense
        </Link>
        <nav className="nav">
          <Link className="ghost-button" href="/auth">
            Auth
          </Link>
          <button className="secondary-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </nav>
      </header>

      <section className="dashboard-shell">
        <div className="dashboard-wrap">
          <div className="dashboard-header">
            <div>
              <div className="eyebrow">App shell</div>
              <h1 className="dashboard-title">Operate the first Knowlense workflow.</h1>
              <p className="muted">
                This dashboard is intentionally thin. It is here to verify auth, establish a clean SaaS frame, and give
                the extension a destination app to open.
              </p>
            </div>
            <div className="metric-card">
              <div className="metric-label">Auth status</div>
              <div className="metric-value">{loading ? "Checking..." : sessionState ? "Signed in" : "Guest mode"}</div>
            </div>
          </div>

          <div className="dashboard-grid">
            <article className="dashboard-card large">
              <h3>Account snapshot</h3>
              <div className="data-list">
                <div className="data-item">
                  <span>Email</span>
                  <strong>{sessionState?.email ?? "No active session"}</strong>
                </div>
                <div className="data-item">
                  <span>User ID</span>
                  <strong>{sessionState?.id ?? "Not available"}</strong>
                </div>
                <div className="data-item">
                  <span>API validation</span>
                  <strong>{apiStatus}</strong>
                </div>
                <div className="data-item">
                  <span>API origin</span>
                  <strong>{getApiBaseUrl()}</strong>
                </div>
              </div>
            </article>

            <article className="dashboard-card">
              <h3>Extension loop</h3>
              <p className="muted">
                The popup can send sellers here for account access, onboarding, and later subscription upgrades.
              </p>
            </article>

            <article className="dashboard-card">
              <h3>Roadmap slot</h3>
              <p className="muted">
                Next steps are keyword collections, listing analyses, and account-aware billing checks through the API.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
