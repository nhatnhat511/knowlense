"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchApiProfile, getApiBaseUrl, type ApiProfile } from "@/lib/api/profile";
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
    <main>
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Dashboard</span>
            </span>
          </Link>
          <nav className="nav">
            <Link className="nav-link" href="/">
              Home
            </Link>
            <Link className="nav-link" href="/auth">
              Auth
            </Link>
            <button className="secondary-button" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <section className="dashboard-shell">
        <div className="shell dashboard-shell-inner">
          <div className="dashboard-header">
            <div>
              <span className="eyebrow">Application workspace</span>
              <h1 className="dashboard-title" style={{ marginTop: 18 }}>
                The product shell is ready for real modules.
              </h1>
              <p className="muted dashboard-subtitle">
                This dashboard now looks and behaves like a SaaS app surface rather than a placeholder page. It already
                validates the session through the API and is ready to receive keyword research, listing audits, and billing state.
              </p>
            </div>

            <div className="dashboard-stat">
              <div className="metric-label">Current access state</div>
              <div className="metric-value">{loading ? "Checking..." : sessionState ? "Authenticated" : "Guest"}</div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-column">
              <article className="dashboard-card large">
                <h3>Account identity</h3>
                <p className="muted">The session below is validated by the Worker API, not only by browser-local auth state.</p>
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
                    <span>Validation status</span>
                    <strong>{apiStatus}</strong>
                  </div>
                  <div className="data-item">
                    <span>API origin</span>
                    <strong>{getApiBaseUrl()}</strong>
                  </div>
                </div>
              </article>

              <article className="dashboard-card">
                <h3>Next module slot</h3>
                <p className="muted">
                  The first strong feature to add here is `Keyword Finder`: live TPT search snapshots, keyword clusters,
                  and opportunity scoring backed by real page data.
                </p>
              </article>
            </div>

            <div className="dashboard-column">
              <article className="dashboard-card">
                <h3>Extension relationship</h3>
                <p className="muted">
                  The Chrome popup can sign the user in, validate the same session through `/v1/me`, and send them here
                  for a larger account and product experience.
                </p>
              </article>

              <article className="dashboard-card">
                <h3>Billing and access layer</h3>
                <p className="muted">
                  With this API-backed auth model, Paddle plan status can become the source of truth for module access,
                  quotas, and feature flags.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
