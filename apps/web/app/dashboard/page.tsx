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
  const [apiStatus, setApiStatus] = useState("Checking website session");
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

    async function hydrate() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.access_token) {
        setSessionState(null);
        setApiStatus("No active website session");
        setLoading(false);
        return;
      }

      try {
        const [profile, keywordData] = await Promise.all([
          fetchApiProfile(session.access_token),
          fetchKeywordRuns(session.access_token)
        ]);

        if (!active) {
          return;
        }

        setSessionState(profile);
        setKeywordRuns(keywordData.runs);
        setKeywordWarning(keywordData.warning ?? "");
        setApiStatus("Session validated through the Worker");
      } catch (error) {
        if (!active) {
          return;
        }

        setSessionState(null);
        setKeywordRuns([]);
        setApiStatus(error instanceof Error ? error.message : "Unable to validate the current session");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(() => {
      void hydrate();
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
    setKeywordRuns([]);
  }

  return (
    <main className="app-shell">
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
            <Link className="nav-link" href="/connect">
              Connect extension
            </Link>
            <button className="secondary-button" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <section className="shell dashboard-surface">
        <div className="section-heading">
          <h1 className="page-title">A dashboard that matches the actual product flow.</h1>
          <p className="page-copy">
            The website owns authentication and account state. The extension connects afterward and runs research tasks
            against the Worker API with its own session.
          </p>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <h2>Account</h2>
            <div className="data-list">
              <div className="data-item">
                <span>Status</span>
                <strong>{loading ? "Checking..." : sessionState ? "Signed in" : "Signed out"}</strong>
              </div>
              <div className="data-item">
                <span>Email</span>
                <strong>{sessionState?.email ?? "No active session"}</strong>
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

          <article className="dashboard-panel">
            <h2>Extension connection</h2>
            <p className="panel-copy">
              Open the extension popup and use <strong>Connect via website</strong>. It will open the website flow and
              come back with a Worker-issued extension session.
            </p>
            <div className="stack-row">
              <Link className="primary-button" href="/connect">
                Open connect page
              </Link>
              <Link className="secondary-button" href="/auth">
                Manage account
              </Link>
            </div>
          </article>
        </div>

        <section className="history-section">
          <div className="section-heading compact">
            <h2 className="section-title">Keyword Finder history</h2>
            <p className="section-copy">Recent analyses captured from the Chrome extension while browsing TPT.</p>
          </div>

          {keywordWarning ? <p className="status error">{keywordWarning}</p> : null}

          {keywordRuns.length === 0 ? (
            <div className="empty-state">
              No Keyword Finder runs yet. Connect the extension, open a TPT search results page, and analyze it from the popup.
            </div>
          ) : (
            <div className="history-grid">
              {keywordRuns.map((run) => (
                <article className="history-card" key={run.id}>
                  <div className="run-topline">
                    <strong>{run.summary.query}</strong>
                    <span>{new Date(run.created_at).toLocaleString()}</span>
                  </div>
                  <p className="panel-copy">
                    {run.summary.totalResults} observed results. Dominant terms: {run.summary.dominantTerms.slice(0, 4).join(", ")}.
                  </p>
                  <div className="keyword-pill-grid">
                    {run.opportunities.slice(0, 4).map((item) => (
                      <span className="keyword-pill" key={`${run.id}-${item.phrase}`}>
                        {item.phrase}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
