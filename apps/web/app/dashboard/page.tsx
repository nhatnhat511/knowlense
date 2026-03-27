"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BrandLockup } from "@/components/brand/brand";

type StatCardProps = {
  color: string;
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
};

function StatCard({ color, label, value, delta, positive = true }: StatCardProps) {
  return (
    <article className="rounded-[26px] border border-black/6 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white" style={{ backgroundColor: color }}>
        •
      </div>
      <div className="mt-8 text-[2.25rem] font-semibold tracking-[-0.06em] text-black">{value}</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-lg text-neutral-500">{label}</span>
        <span className={`text-lg font-medium ${positive ? "text-emerald-500" : "text-red-500"}`}>{delta}</span>
      </div>
    </article>
  );
}

function InsightPanel({
  title,
  value,
  change,
  children
}: {
  title: string;
  value: string;
  change: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[26px] border border-black/6 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl text-neutral-500">{title}</div>
          <div className="mt-4 text-[3.2rem] font-semibold tracking-[-0.08em] text-black">{value}</div>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-2 text-lg font-medium text-emerald-500">{change}</div>
      </div>

      <div className="mt-6 h-40 overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(120,119,255,0.06)_0%,rgba(120,119,255,0.14)_100%)] p-4">
        {children}
      </div>
    </article>
  );
}

function LineMock() {
  return (
    <svg className="h-full w-full" fill="none" viewBox="0 0 320 180">
      <path d="M0 150H320" stroke="rgba(15,23,42,0.08)" />
      <path d="M0 110H320" stroke="rgba(15,23,42,0.08)" />
      <path d="M0 70H320" stroke="rgba(15,23,42,0.08)" />
      <path d="M0 30H320" stroke="rgba(15,23,42,0.08)" />
      <path
        d="M8 150C27 148 36 145 48 132C60 119 72 75 88 74C102 73 111 121 128 118C145 115 155 98 168 82C181 66 191 42 208 38C226 33 240 105 256 102C272 99 285 54 312 14"
        stroke="#6b6cff"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M8 180C27 178 36 175 48 162C60 149 72 105 88 104C102 103 111 151 128 148C145 145 155 128 168 112C181 96 191 72 208 68C226 63 240 135 256 132C272 129 285 84 312 44V180H8Z"
        fill="url(#area)"
      />
      <defs>
        <linearGradient id="area" x1="160" x2="160" y1="44" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6b6cff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#6b6cff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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

  const firstName = sessionState?.email ? sessionState.email.split("@")[0] : "there";
  const keywordCount = keywordRuns.length.toString();
  const latestRun = keywordRuns[0];

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#171717]">
      <div className="grid min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="border-r border-black/6 bg-white px-8 py-9">
          <BrandLockup subtitle="TPT seller intelligence" />

          <div className="mt-14">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-400">Main menu</div>
            <nav className="mt-6 space-y-2">
              <Link className="flex items-center gap-3 rounded-[18px] bg-[#ecebff] px-5 py-4 text-lg font-medium text-[#635bff]" href="/dashboard">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-xl shadow-[0_8px_18px_rgba(99,91,255,0.12)]">◌</span>
                Dashboard
              </Link>
              <Link className="flex items-center gap-3 rounded-[18px] px-5 py-4 text-lg text-neutral-700 transition hover:bg-white" href="/account">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f7f5] text-xl">◔</span>
                Account
              </Link>
              <Link className="flex items-center gap-3 rounded-[18px] px-5 py-4 text-lg text-neutral-700 transition hover:bg-white" href="/pricing">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f7f5] text-xl">◎</span>
                Subscription
              </Link>
              <Link className="flex items-center gap-3 rounded-[18px] px-5 py-4 text-lg text-neutral-700 transition hover:bg-white" href="/connect">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f7f5] text-xl">↗</span>
                Connect extension
              </Link>
            </nav>
          </div>

          <div className="mt-14">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-400">Others</div>
            <div className="mt-6 space-y-2">
              <Link className="flex items-center gap-3 rounded-[18px] px-5 py-4 text-lg text-neutral-700 transition hover:bg-white" href="/contact">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f7f5] text-xl">✉</span>
                Support
              </Link>
              <Link className="flex items-center gap-3 rounded-[18px] px-5 py-4 text-lg text-neutral-700 transition hover:bg-white" href="/privacy">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f7f5] text-xl">⌘</span>
                Privacy
              </Link>
              <button
                className="flex w-full items-center gap-3 rounded-[18px] px-5 py-4 text-left text-lg text-neutral-700 transition hover:bg-white"
                onClick={handleSignOut}
                type="button"
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f7f7f5] text-xl">↩</span>
                Log out
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex flex-col gap-6 border-b border-black/6 bg-white px-8 py-6 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[2.1rem] font-semibold tracking-[-0.06em] text-black">
                Welcome {loading ? "..." : firstName}! <span className="text-[1.8rem]">👋</span>
              </div>
              <div className="mt-2 text-base text-neutral-500">Your website workspace for auth, billing, and extension activity.</div>
            </div>

            <div className="flex items-center gap-4 self-start lg:self-auto">
              <div className="flex items-center gap-3 rounded-full border border-black/6 bg-[#f7f7f5] px-3 py-2">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-lg shadow-[0_8px_18px_rgba(15,23,42,0.05)]">☼</span>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-lg shadow-[0_8px_18px_rgba(15,23,42,0.05)]">◔</span>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-lg shadow-[0_8px_18px_rgba(15,23,42,0.05)]">🔔</span>
              </div>
              <div className="flex items-center gap-3 rounded-full bg-white pl-3 pr-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] text-sm font-semibold text-blue-700">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-lg font-medium text-black">{loading ? "Loading" : firstName}</div>
              </div>
            </div>
          </header>

          <div className="bg-[#f2f4f8] px-8 py-10 sm:px-10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[3rem] font-semibold tracking-[-0.07em] text-black">Dashboard</h1>
                <p className="mt-2 text-lg text-neutral-500">A clean overview of your account, billing path, and Keyword Finder activity.</p>
              </div>
              <div className="text-lg text-neutral-500">Home / Dashboard</div>
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-4">
              <StatCard color="#3ddc84" delta="+0.43% ↑" label="Website sessions" positive value={loading ? "..." : sessionState ? "1" : "0"} />
              <StatCard color="#ff9a4d" delta="+4.35% ↑" label="Billing readiness" positive value="Paddle" />
              <StatCard color="#7c4dff" delta="+2.59% ↑" label="Keyword runs" positive value={loading ? "..." : keywordCount} />
              <StatCard color="#29b6f6" delta={keywordWarning ? "Alert ↓" : "+0.95% ↑"} label="Extension status" positive={!keywordWarning} value={keywordWarning ? "Check" : "Ready"} />
            </div>

            <div className="mt-12">
              <h2 className="text-[2.3rem] font-semibold tracking-[-0.06em] text-black">Overview</h2>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-neutral-500">
                An overview of your Knowlense workspace, including the current account session, latest activity, and the next actions that matter.
              </p>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-3">
              <InsightPanel change="+4%" title="Current account" value={sessionState?.email ?? "No session"}>
                <LineMock />
              </InsightPanel>
              <InsightPanel change="+4%" title="Latest query" value={latestRun?.summary.query ?? "Waiting"}>
                <LineMock />
              </InsightPanel>
              <InsightPanel change="+4%" title="Next action" value={keywordRuns.length > 0 ? "Review runs" : "Connect extension"}>
                <LineMock />
              </InsightPanel>
            </div>

            {keywordWarning ? (
              <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">{keywordWarning}</div>
            ) : null}

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-[26px] border border-black/6 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.05em] text-black">Recent Keyword Finder runs</h3>
                    <p className="mt-2 text-base text-neutral-500">Recent analyses captured from TPT search pages.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {keywordRuns.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-black/10 bg-[#fafafa] px-5 py-8 text-base leading-7 text-neutral-500">
                      No runs yet. Connect the extension, open a TPT search page, and analyze it from the popup.
                    </div>
                  ) : (
                    keywordRuns.slice(0, 4).map((run) => (
                      <div className="rounded-[22px] bg-[#f7f7f5] px-5 py-5" key={run.id}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xl font-medium text-black">{run.summary.query}</div>
                          <div className="text-sm text-neutral-400">{new Date(run.created_at).toLocaleString()}</div>
                        </div>
                        <p className="mt-2 text-base leading-7 text-neutral-500">
                          {run.summary.totalResults} observed results. Dominant terms: {run.summary.dominantTerms.slice(0, 4).join(", ")}.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {run.opportunities.slice(0, 4).map((item) => (
                            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-[0_6px_14px_rgba(15,23,42,0.04)]" key={`${run.id}-${item.phrase}`}>
                              {item.phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="rounded-[26px] border border-black/6 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
                <h3 className="text-2xl font-semibold tracking-[-0.05em] text-black">Quick actions</h3>
                <p className="mt-2 text-base text-neutral-500">Use the shortest path to the next meaningful step.</p>

                <div className="mt-6 space-y-4">
                  <Link className="flex items-center justify-between rounded-[20px] bg-[#f7f7f5] px-5 py-4 text-lg text-black transition hover:bg-[#eef2ff]" href="/connect">
                    <span>Connect extension</span>
                    <span>↗</span>
                  </Link>
                  <Link className="flex items-center justify-between rounded-[20px] bg-[#f7f7f5] px-5 py-4 text-lg text-black transition hover:bg-[#eef2ff]" href="/pricing">
                    <span>Review plans</span>
                    <span>↗</span>
                  </Link>
                  <Link className="flex items-center justify-between rounded-[20px] bg-[#f7f7f5] px-5 py-4 text-lg text-black transition hover:bg-[#eef2ff]" href="/account">
                    <span>Open account center</span>
                    <span>↗</span>
                  </Link>
                  <Link className="flex items-center justify-between rounded-[20px] bg-[#f7f7f5] px-5 py-4 text-lg text-black transition hover:bg-[#eef2ff]" href="/contact">
                    <span>Contact support</span>
                    <span>↗</span>
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
