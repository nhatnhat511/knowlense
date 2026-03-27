"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
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
        router.replace("/auth/sign-in?next=/dashboard");
        return;
      }

      try {
        const [profile, keywordData] = await Promise.all([fetchApiProfile(session.access_token), fetchKeywordRuns(session.access_token)]);

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
        setKeywordWarning(error instanceof Error ? error.message : "Unable to validate the current session.");
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
  }, [router, supabase]);

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
          { href: "/pricing", label: "Pricing" },
          { href: "/account", label: "Account" },
          { href: "/contact", label: "Support" }
        ]}
        primaryCta={{ href: "/connect", label: "Connect extension" }}
      />

      <section className="shell dashboard-surface">
        <div className="section-heading">
          <span className="section-label">Dashboard</span>
          <h1 className="page-title">Your web app is the control center for the extension workflow.</h1>
          <p className="page-copy">
            Sign in on the website, connect the extension through the secure bridge, and review recent Keyword Finder
            activity here.
          </p>
        </div>

        <div className="stats-strip">
          <article className="stat-chip-card">
            <span className="stat-label">Website auth</span>
            <strong>{loading ? "Checking..." : sessionState ? "Ready" : "Signed out"}</strong>
            <span className="stat-help">The website is the primary authentication surface.</span>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Keyword runs</span>
            <strong>{keywordRuns.length}</strong>
            <span className="stat-help">Recent analyses captured from TPT search results appear here.</span>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Recommended next step</span>
            <strong>{sessionState ? "Connect extension" : "Sign in"}</strong>
            <span className="stat-help">The product becomes useful after the website and extension are linked.</span>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Workspace overview</h2>
                <p className="panel-copy">A concise read on account readiness and product activity.</p>
              </div>
              <span className="panel-badge">Overview</span>
            </div>
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
            <div className="panel-header">
              <div>
                <h2>Quick actions</h2>
                <p className="panel-copy">The shortest path from a new session to a useful result.</p>
              </div>
              <span className="panel-badge">Actions</span>
            </div>
            <div className="stack-row">
              <Link className="primary-button" href="/connect">
                Connect extension
              </Link>
              <Link className="secondary-button" href="/pricing">
                Review plans
              </Link>
              <button className="secondary-button" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </div>
            <div className="panel-list">
              <div className="panel-list-item">
                <strong>Step 1</strong>
                <p>Keep your website session active so the connect flow can approve the extension request.</p>
              </div>
              <div className="panel-list-item">
                <strong>Step 2</strong>
                <p>Open a TPT search page and run Keyword Finder from the popup after the extension is connected.</p>
              </div>
            </div>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>How the product is meant to be used</h2>
                <p className="panel-copy">A clear sequence keeps the experience understandable for new users.</p>
              </div>
              <span className="panel-badge">Workflow</span>
            </div>
            <ul className="clean-list">
              <li>Sign in and manage account state on the website.</li>
              <li>Approve the extension request from the connect page.</li>
              <li>Use the extension on live TPT search pages and review saved runs here.</li>
            </ul>
          </article>

          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Subscription path</h2>
                <p className="panel-copy">Billing should feel like a continuation of the app, not a detached external step.</p>
              </div>
              <span className="panel-badge">Billing</span>
            </div>
            <div className="panel-list">
              <div className="panel-list-item">
                <strong>Free first</strong>
                <p>Users can validate the workflow before committing to a paid plan.</p>
              </div>
              <div className="panel-list-item">
                <strong>Worker-generated checkout</strong>
                <p>Paddle checkout links are created on the Worker based on the selected plan.</p>
              </div>
            </div>
            <div className="stack-row">
              <Link className="primary-button" href="/pricing">
                Open pricing
              </Link>
            </div>
          </article>
        </div>

        <section className="history-section">
          <div className="section-heading compact">
            <span className="section-label">Recent Activity</span>
            <h2 className="section-title">Keyword Finder history</h2>
            <p className="section-copy">Recent analyses captured from the Chrome extension while browsing Teachers Pay Teachers.</p>
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
