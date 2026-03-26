"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, getApiBaseUrl, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionState, setSessionState] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("Checking /v1/me");
  const [keywordRuns, setKeywordRuns] = useState<KeywordRun[]>([]);
  const [keywordWarning, setKeywordWarning] = useState("");

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
        const keywordData = await fetchKeywordRuns(session.access_token);
        if (!active) {
          return;
        }

        setSessionState(profile);
        setKeywordRuns(keywordData.runs);
        setKeywordWarning(keywordData.warning ?? "");
        setApiStatus("Session validated via API");
      } catch (error) {
        if (!active) {
          return;
        }

        setSessionState(null);
        setKeywordRuns([]);
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
                <h3>Keyword Finder history</h3>
                <p className="muted">
                  Run analysis from the extension while viewing a TPT search results page. The latest runs will appear
                  here after the Worker stores them.
                </p>
                {keywordWarning ? <p className="status error">{keywordWarning}</p> : null}
                {keywordRuns.length === 0 ? (
                  <div className="empty-state">
                    No Keyword Finder runs yet. Open a TPT search page in Chrome and use the Knowlense popup.
                  </div>
                ) : (
                  <div className="run-list">
                    {keywordRuns.slice(0, 3).map((run) => (
                      <article className="run-item" key={run.id}>
                        <div className="run-topline">
                          <strong>{run.summary.query}</strong>
                          <span>{new Date(run.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="muted">
                          {run.summary.totalResults} observed results, dominant terms: {run.summary.dominantTerms.slice(0, 3).join(", ")}
                        </p>
                        <div className="keyword-pill-grid">
                          {run.opportunities.slice(0, 3).map((opportunity) => (
                            <span className="keyword-pill" key={`${run.id}-${opportunity.phrase}`}>
                              {opportunity.phrase}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>

              <article className="dashboard-card">
                <h3>Latest opportunity frame</h3>
                <p className="muted">
                  {keywordRuns[0]
                    ? `Top run "${keywordRuns[0].summary.query}" surfaced ${keywordRuns[0].opportunities.length} opportunity candidates.`
                    : "After the first analysis, this panel can summarize the strongest adjacent keywords and saturation warnings."}
                </p>
                {keywordRuns[0] ? (
                  <ul className="clean-list">
                    {keywordRuns[0].opportunities.slice(0, 3).map((opportunity) => (
                      <li key={opportunity.phrase}>{`${opportunity.phrase}: ${opportunity.reason}`}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
