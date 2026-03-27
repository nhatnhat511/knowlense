"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppPanel, AppPanelTitle, AppShell } from "@/components/account/app-shell";

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
    router.push("/auth/sign-in");
  }

  return (
    <AppShell
      actions={
        <>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-50"
            href="/connect"
          >
            Connect extension
          </Link>
          <button
            className="inline-flex h-11 items-center rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
            onClick={handleSignOut}
            type="button"
          >
            Log out
          </button>
        </>
      }
      subtitle="The website is your control center for identity, billing, and the extension connection flow."
      title={loading ? "Loading dashboard..." : `Welcome${sessionState?.email ? `, ${sessionState.email.split("@")[0]}` : ""}`}
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <AppPanel>
          <AppPanelTitle
            badge="Overview"
            copy="A quick read on session status, product readiness, and what to do next."
            title="Workspace summary"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Website auth</div>
              <div className="mt-2 text-lg font-semibold text-black">{loading ? "Checking..." : sessionState ? "Ready" : "Signed out"}</div>
              <div className="mt-1 text-sm text-neutral-500">Your account session lives on the website.</div>
            </div>
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Keyword runs</div>
              <div className="mt-2 text-lg font-semibold text-black">{keywordRuns.length}</div>
              <div className="mt-1 text-sm text-neutral-500">Saved analyses from live TPT search pages.</div>
            </div>
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Next step</div>
              <div className="mt-2 text-lg font-semibold text-black">{sessionState ? "Run the extension" : "Sign in"}</div>
              <div className="mt-1 text-sm text-neutral-500">Approve the browser session, then analyze a TPT search page.</div>
            </div>
          </div>
        </AppPanel>

        <AppPanel>
          <AppPanelTitle badge="Actions" copy="The fastest route from sign-in to a useful product action." title="Quick actions" />
          <div className="space-y-3">
            <Link
              className="flex items-center justify-between rounded-[20px] border border-black/8 bg-white px-4 py-4 transition hover:border-black/12 hover:bg-neutral-50"
              href="/connect"
            >
              <div>
                <div className="text-base font-medium text-black">Connect extension</div>
                <div className="mt-1 text-sm text-neutral-500">Approve the browser session from the website.</div>
              </div>
              <span className="text-lg leading-none">↗</span>
            </Link>
            <Link
              className="flex items-center justify-between rounded-[20px] border border-black/8 bg-white px-4 py-4 transition hover:border-black/12 hover:bg-neutral-50"
              href="/pricing"
            >
              <div>
                <div className="text-base font-medium text-black">Review plans</div>
                <div className="mt-1 text-sm text-neutral-500">Move from free to monthly or yearly billing when needed.</div>
              </div>
              <span className="text-lg leading-none">↗</span>
            </Link>
            <Link
              className="flex items-center justify-between rounded-[20px] border border-black/8 bg-white px-4 py-4 transition hover:border-black/12 hover:bg-neutral-50"
              href="/account"
            >
              <div>
                <div className="text-base font-medium text-black">Open account center</div>
                <div className="mt-1 text-sm text-neutral-500">Manage identity, security, and billing links.</div>
              </div>
              <span className="text-lg leading-none">↗</span>
            </Link>
          </div>
        </AppPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <AppPanel>
          <AppPanelTitle
            badge="History"
            copy="Recent Keyword Finder runs captured by the extension while you were browsing Teachers Pay Teachers."
            title="Recent activity"
          />

          {keywordWarning ? <div className="mb-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{keywordWarning}</div> : null}

          {keywordRuns.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-black/10 bg-[#fafafa] px-5 py-8 text-sm leading-6 text-neutral-500">
              No Keyword Finder runs yet. Connect the extension, open a TPT search results page, and analyze it from the popup.
            </div>
          ) : (
            <div className="space-y-4">
              {keywordRuns.slice(0, 6).map((run) => (
                <article className="rounded-[22px] border border-black/8 bg-white p-5" key={run.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold tracking-[-0.04em] text-black">{run.summary.query}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-500">
                        {run.summary.totalResults} observed results. Dominant terms: {run.summary.dominantTerms.slice(0, 4).join(", ")}.
                      </p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {run.opportunities.slice(0, 4).map((item) => (
                      <span className="rounded-full border border-black/10 bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-neutral-700" key={`${run.id}-${item.phrase}`}>
                        {item.phrase}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </AppPanel>

        <AppPanel>
          <AppPanelTitle
            badge="Workflow"
            copy="The product works best when the website controls authentication and the extension only receives an approved session."
            title="How it fits together"
          />
          <div className="space-y-3 text-sm leading-6 text-neutral-600">
            <div className="rounded-[20px] border border-black/8 bg-[#fafafa] p-4">1. Sign in on the website and keep the session active.</div>
            <div className="rounded-[20px] border border-black/8 bg-[#fafafa] p-4">2. Connect the extension from the secure approval page.</div>
            <div className="rounded-[20px] border border-black/8 bg-[#fafafa] p-4">3. Run Keyword Finder on live TPT search pages and review saved results here.</div>
          </div>
          <div className="mt-5">
            <Link
              className="inline-flex h-11 items-center rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
              href="/pricing"
            >
              View subscription options
            </Link>
          </div>
        </AppPanel>
      </div>
    </AppShell>
  );
}
