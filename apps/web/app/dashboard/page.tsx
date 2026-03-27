"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BrandLockup } from "@/components/brand/brand";

type ThemeMode = "light" | "dark";

type StatCardProps = {
  colorClass: string;
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  dark?: boolean;
};

function StatCard({ colorClass, label, value, delta, positive = true, dark = false }: StatCardProps) {
  return (
    <article
      className={`rounded-[22px] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition ${
        dark ? "border-white/8 bg-[#151922]" : "border-black/6 bg-white"
      }`}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${colorClass}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      </div>
      <div className={`mt-6 text-[2rem] font-semibold tracking-[-0.06em] ${dark ? "text-white" : "text-black"}`}>{value}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className={`text-base ${dark ? "text-white/60" : "text-neutral-500"}`}>{label}</span>
        <span className={`text-base font-medium ${positive ? "text-emerald-500" : "text-red-500"}`}>{delta}</span>
      </div>
    </article>
  );
}

function MiniChart({ dark = false }: { dark?: boolean }) {
  return (
    <svg className="h-full w-full" fill="none" viewBox="0 0 320 180">
      <path d="M0 150H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
      <path d="M0 110H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
      <path d="M0 70H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
      <path d="M0 30H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
      <path
        d="M8 150C27 148 36 145 48 132C60 119 72 75 88 74C102 73 111 121 128 118C145 115 155 98 168 82C181 66 191 42 208 38C226 33 240 105 256 102C272 99 285 54 312 14"
        stroke="#6b6cff"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M8 180C27 178 36 175 48 162C60 149 72 105 88 104C102 103 111 151 128 148C145 145 155 128 168 112C181 96 191 72 208 68C226 63 240 135 256 132C272 129 285 84 312 44V180H8Z"
        fill="url(#dashboardArea)"
      />
      <defs>
        <linearGradient id="dashboardArea" x1="160" x2="160" y1="44" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6b6cff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#6b6cff" stopOpacity="0.03" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function OverviewPanel({
  title,
  value,
  change,
  dark = false
}: {
  title: string;
  value: string;
  change: string;
  dark?: boolean;
}) {
  return (
    <article
      className={`rounded-[22px] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] ${
        dark ? "border-white/8 bg-[#151922]" : "border-black/6 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-lg ${dark ? "text-white/60" : "text-neutral-500"}`}>{title}</div>
          <div className={`mt-3 text-[2.4rem] font-semibold tracking-[-0.08em] ${dark ? "text-white" : "text-black"}`}>{value}</div>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600">{change}</div>
      </div>

      <div className={`mt-5 h-36 overflow-hidden rounded-[18px] p-3 ${dark ? "bg-white/4" : "bg-[#f7f8ff]"}`}>
        <MiniChart dark={dark} />
      </div>
    </article>
  );
}

function iconWrap(label: string, dark: boolean, active = false) {
  if (active) {
    return `grid h-10 w-10 place-items-center rounded-2xl ${dark ? "bg-[#23293a] text-white" : "bg-white text-[#635bff] shadow-[0_8px_18px_rgba(99,91,255,0.12)]"}`;
  }

  return `grid h-10 w-10 place-items-center rounded-2xl ${dark ? "bg-white/6 text-white/80" : "bg-[#f7f7f5] text-neutral-700"}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionState, setSessionState] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [keywordRuns, setKeywordRuns] = useState<KeywordRun[]>([]);
  const [keywordWarning, setKeywordWarning] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("knowlense-dashboard-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("knowlense-dashboard-theme", theme);
  }, [theme]);

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

  const dark = theme === "dark";
  const firstName = sessionState?.email ? sessionState.email.split("@")[0] : "there";
  const initials = firstName.slice(0, 2).toUpperCase() || "KN";
  const latestRun = keywordRuns[0];

  return (
    <main className={`min-h-screen transition-colors ${dark ? "bg-[#0f1218] text-white" : "bg-[#f7f7f5] text-[#171717]"}`}>
      <div className={`grid min-h-screen lg:grid-cols-[268px_minmax(0,1fr)] ${dark ? "bg-[#0f1218]" : "bg-[#f7f7f5]"}`}>
        <aside className={`px-8 py-8 ${dark ? "border-r border-white/8 bg-[#121720]" : "border-r border-black/6 bg-white"}`}>
          <BrandLockup subtitle="TPT seller intelligence" />

          <div className={`mt-10 border-t pt-8 ${dark ? "border-white/8" : "border-black/8"}`}>
            <div className={`text-sm font-semibold uppercase tracking-[0.14em] ${dark ? "text-white/35" : "text-neutral-400"}`}>Main menu</div>
            <nav className="mt-5 space-y-2">
              <Link className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] font-medium transition ${dark ? "bg-[#1c2230] text-white" : "bg-[#ecebff] text-[#635bff]"}`} href="/dashboard">
                <span className={iconWrap("dashboard", dark, true)}>◌</span>
                Dashboard
              </Link>
              <Link className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] transition ${dark ? "text-white/75 hover:bg-white/5" : "text-neutral-700 hover:bg-[#f8f8ff]"}`} href="/account">
                <span className={iconWrap("account", dark)}>◔</span>
                Account
              </Link>
              <Link className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] transition ${dark ? "text-white/75 hover:bg-white/5" : "text-neutral-700 hover:bg-[#f8f8ff]"}`} href="/pricing">
                <span className={iconWrap("subscription", dark)}>◎</span>
                Subscription
              </Link>
              <Link className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] transition ${dark ? "text-white/75 hover:bg-white/5" : "text-neutral-700 hover:bg-[#f8f8ff]"}`} href="/connect">
                <span className={iconWrap("connect", dark)}>↗</span>
                Connect extension
              </Link>
            </nav>
          </div>

          <div className={`mt-10 border-t pt-8 ${dark ? "border-white/8" : "border-black/8"}`}>
            <div className={`text-sm font-semibold uppercase tracking-[0.14em] ${dark ? "text-white/35" : "text-neutral-400"}`}>Others</div>
            <div className="mt-5 space-y-2">
              <Link className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] transition ${dark ? "text-white/75 hover:bg-white/5" : "text-neutral-700 hover:bg-[#f8f8ff]"}`} href="/contact">
                <span className={iconWrap("support", dark)}>✉</span>
                Support
              </Link>
              <Link className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] transition ${dark ? "text-white/75 hover:bg-white/5" : "text-neutral-700 hover:bg-[#f8f8ff]"}`} href="/privacy">
                <span className={iconWrap("privacy", dark)}>⌘</span>
                Privacy
              </Link>
              <button
                className={`flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-[15px] transition ${dark ? "text-white/75 hover:bg-white/5" : "text-neutral-700 hover:bg-[#f8f8ff]"}`}
                onClick={handleSignOut}
                type="button"
              >
                <span className={iconWrap("logout", dark)}>↩</span>
                Log out
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className={`flex flex-col gap-5 px-8 py-6 sm:px-10 lg:flex-row lg:items-center lg:justify-between ${dark ? "border-b border-white/8 bg-[#121720]" : "border-b border-black/6 bg-white"}`}>
            <div>
              <div className={`text-[2.4rem] font-semibold tracking-[-0.065em] ${dark ? "text-white" : "text-black"}`}>
                Welcome {loading ? "..." : firstName}! <span className="text-[1.8rem]">👋</span>
              </div>
              <div className={`mt-1 text-[15px] ${dark ? "text-white/55" : "text-neutral-500"}`}>Your website workspace for auth, billing, and extension activity.</div>
            </div>

            <div className="flex items-center gap-4 self-start lg:self-auto">
              <div className={`flex items-center gap-2 rounded-full px-2 py-2 ${dark ? "bg-white/5 ring-1 ring-white/8" : "bg-[#f7f7f5] ring-1 ring-black/6"}`}>
                <button
                  aria-label="Switch to light mode"
                  className={`grid h-10 w-10 place-items-center rounded-full text-base transition ${theme === "light" ? (dark ? "bg-[#23293a] text-white" : "bg-white text-black shadow-[0_8px_18px_rgba(15,23,42,0.05)]") : dark ? "text-white/65 hover:bg-white/5" : "text-neutral-500 hover:bg-white"}`}
                  onClick={() => setTheme("light")}
                  type="button"
                >
                  ☼
                </button>
                <button
                  aria-label="Switch to dark mode"
                  className={`grid h-10 w-10 place-items-center rounded-full text-base transition ${theme === "dark" ? (dark ? "bg-[#23293a] text-white" : "bg-white text-black shadow-[0_8px_18px_rgba(15,23,42,0.05)]") : dark ? "text-white/65 hover:bg-white/5" : "text-neutral-500 hover:bg-white"}`}
                  onClick={() => setTheme("dark")}
                  type="button"
                >
                  ◔
                </button>
                <button
                  aria-label="Notifications"
                  className={`grid h-10 w-10 place-items-center rounded-full text-base transition ${dark ? "text-amber-300 hover:bg-white/5" : "text-amber-500 hover:bg-white"}`}
                  onClick={() => {
                    if (keywordWarning) {
                      window.alert(keywordWarning);
                      return;
                    }

                    const message = latestRun
                      ? `Latest run: ${latestRun.summary.query} at ${new Date(latestRun.created_at).toLocaleString()}`
                      : "No new dashboard notifications.";
                    window.alert(message);
                  }}
                  type="button"
                >
                  🔔
                </button>
              </div>

              <div className={`flex items-center gap-3 rounded-full pl-3 pr-4 ${dark ? "bg-[#171d28] ring-1 ring-white/8" : "bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)]"}`}>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] text-sm font-semibold text-blue-700">
                  {initials}
                </div>
                <div className={`text-base font-medium ${dark ? "text-white" : "text-black"}`}>{loading ? "Loading" : firstName}</div>
              </div>
            </div>
          </header>

          <div className={`px-8 py-8 sm:px-10 ${dark ? "bg-[#0f1218]" : "bg-[#f2f4f8]"}`}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className={`text-[2.8rem] font-semibold tracking-[-0.07em] ${dark ? "text-white" : "text-black"}`}>Dashboard</h1>
                <p className={`mt-2 text-[15px] ${dark ? "text-white/55" : "text-neutral-500"}`}>
                  A clean overview of your account, billing path, and Keyword Finder activity.
                </p>
              </div>
              <div className={`pt-2 text-[15px] ${dark ? "text-white/45" : "text-neutral-500"}`}>Home / Dashboard</div>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-4">
              <StatCard colorClass="bg-emerald-400" dark={dark} delta="+0.43% ↑" label="Website sessions" positive value={loading ? "..." : sessionState ? "1" : "0"} />
              <StatCard colorClass="bg-orange-400" dark={dark} delta="+4.35% ↑" label="Billing readiness" positive value="Paddle" />
              <StatCard colorClass="bg-violet-500" dark={dark} delta="+2.59% ↑" label="Keyword runs" positive value={loading ? "..." : String(keywordRuns.length)} />
              <StatCard colorClass="bg-sky-500" dark={dark} delta={keywordWarning ? "Alert ↓" : "+0.95% ↑"} label="Extension status" positive={!keywordWarning} value={keywordWarning ? "Check" : "Ready"} />
            </div>

            <div className="mt-10">
              <h2 className={`text-[2.05rem] font-semibold tracking-[-0.06em] ${dark ? "text-white" : "text-black"}`}>Overview</h2>
              <p className={`mt-2 max-w-3xl text-[15px] leading-7 ${dark ? "text-white/55" : "text-neutral-500"}`}>
                An overview of your Knowlense workspace, including the current account session, latest activity, and the next actions that matter.
              </p>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <OverviewPanel change="+4%" dark={dark} title="Current account" value={sessionState?.email ?? "No session"} />
              <OverviewPanel change="+4%" dark={dark} title="Latest query" value={latestRun?.summary.query ?? "Waiting"} />
              <OverviewPanel change="+4%" dark={dark} title="Next action" value={keywordRuns.length > 0 ? "Review runs" : "Connect extension"} />
            </div>

            {keywordWarning ? (
              <div className={`mt-5 rounded-[22px] border px-5 py-4 text-[15px] ${dark ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
                {keywordWarning}
              </div>
            ) : null}

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className={`rounded-[22px] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] ${dark ? "border-white/8 bg-[#151922]" : "border-black/6 bg-white"}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={`text-xl font-semibold tracking-[-0.05em] ${dark ? "text-white" : "text-black"}`}>Recent Keyword Finder runs</h3>
                    <p className={`mt-1 text-[14px] ${dark ? "text-white/55" : "text-neutral-500"}`}>Recent analyses captured from TPT search pages.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {keywordRuns.length === 0 ? (
                    <div className={`rounded-[18px] border border-dashed px-5 py-7 text-[15px] leading-7 ${dark ? "border-white/10 bg-white/4 text-white/55" : "border-black/10 bg-[#fafafa] text-neutral-500"}`}>
                      No runs yet. Connect the extension, open a TPT search page, and analyze it from the popup.
                    </div>
                  ) : (
                    keywordRuns.slice(0, 4).map((run) => (
                      <div className={`rounded-[18px] px-4 py-4 ${dark ? "bg-white/4" : "bg-[#f7f7f5]"}`} key={run.id}>
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className={`text-[16px] font-medium ${dark ? "text-white" : "text-black"}`}>{run.summary.query}</div>
                          <div className={`text-xs ${dark ? "text-white/35" : "text-neutral-400"}`}>{new Date(run.created_at).toLocaleString()}</div>
                        </div>
                        <p className={`mt-2 text-[14px] leading-6 ${dark ? "text-white/55" : "text-neutral-500"}`}>
                          {run.summary.totalResults} observed results. Dominant terms: {run.summary.dominantTerms.slice(0, 4).join(", ")}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {run.opportunities.slice(0, 4).map((item) => (
                            <span
                              className={`rounded-full px-3 py-1.5 text-xs font-medium ${dark ? "bg-[#23293a] text-white/80" : "bg-white text-neutral-700 shadow-[0_6px_14px_rgba(15,23,42,0.04)]"}`}
                              key={`${run.id}-${item.phrase}`}
                            >
                              {item.phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className={`rounded-[22px] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] ${dark ? "border-white/8 bg-[#151922]" : "border-black/6 bg-white"}`}>
                <h3 className={`text-xl font-semibold tracking-[-0.05em] ${dark ? "text-white" : "text-black"}`}>Quick actions</h3>
                <p className={`mt-1 text-[14px] ${dark ? "text-white/55" : "text-neutral-500"}`}>Use the shortest path to the next meaningful step.</p>

                <div className="mt-5 space-y-3">
                  {[
                    { href: "/connect", label: "Connect extension" },
                    { href: "/pricing", label: "Review plans" },
                    { href: "/account", label: "Open account center" },
                    { href: "/contact", label: "Contact support" }
                  ].map((item) => (
                    <Link
                      className={`flex items-center justify-between rounded-[18px] px-4 py-3 text-[15px] transition ${dark ? "bg-white/4 text-white hover:bg-white/8" : "bg-[#f7f7f5] text-black hover:bg-[#eef2ff]"}`}
                      href={item.href}
                      key={item.href}
                    >
                      <span>{item.label}</span>
                      <span>↗</span>
                    </Link>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
