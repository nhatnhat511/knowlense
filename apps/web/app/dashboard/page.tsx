"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionState, setSessionState] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [keywordRuns, setKeywordRuns] = useState<KeywordRun[]>([]);
  const [keywordWarning, setKeywordWarning] = useState("");

  useEffect(() => {
    if (!supabase) {
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
      } catch (error) {
        if (!active) {
          return;
        }

        setSessionState(null);
        setKeywordRuns([]);
        setKeywordWarning(error instanceof Error ? error.message : "Unable to validate the current session");
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
      <SiteHeader
        tag="Dashboard"
        navItems={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { href: "/pricing", label: "Pricing" },
          { href: "/connect", label: "Connect extension" }
        ]}
      />

      <section className="shell dashboard-surface">
        <div className="section-heading">
          <h1 className="page-title">A dashboard that matches the actual product flow.</h1>
          <p className="page-copy">
            The website owns authentication and account state. The extension connects afterward and runs research tasks
            against the Worker API with its own session.
          </p>
        </div>

        <div className="stats-strip">
          <article className="stat-chip-card">
            <span className="stat-label">Website auth</span>
            <strong>{loading ? "Checking..." : sessionState ? "Ready" : "Signed out"}</strong>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Keyword runs</span>
            <strong>{keywordRuns.length}</strong>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Best next step</span>
            <strong>{sessionState ? "Connect extension" : "Sign in"}</strong>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <h2>Workspace overview</h2>
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
                <span>Keyword Finder runs</span>
                <strong>{keywordRuns.length}</strong>
              </div>
              <div className="data-item">
                <span>Connection model</span>
                <strong>Website auth + Worker session</strong>
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
              <Link className="secondary-button" href="/account">Manage account</Link>
              <button className="secondary-button" onClick={handleSignOut} type="button">Sign out</button>
            </div>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <h2>Suggested next steps</h2>
            <ul className="clean-list">
              <li>Sign in on the website if there is no active session.</li>
              <li>Connect the extension from the popup or account page.</li>
              <li>Open a TPT search results page and run Keyword Finder.</li>
            </ul>
          </article>

          <article className="dashboard-panel">
            <h2>Subscription path</h2>
            <p className="panel-copy">
              Paid usage starts from the pricing page. Paddle checkout is generated on the Worker and returned to the website.
            </p>
            <div className="stack-row">
              <Link className="primary-button" href="/pricing">
                Review pricing
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
      <SiteFooter />
    </main>
  );
}
