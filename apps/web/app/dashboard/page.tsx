"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CreditCard, LayoutGrid, LifeBuoy, Moon, PlugZap, RefreshCw, Shield, Sparkles, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchKeywordRuns, type KeywordRun } from "@/lib/api/keyword-finder";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BrandLockup } from "@/components/brand/brand";

type ThemeMode = "light" | "dark";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function SidebarLink({
  href,
  label,
  active,
  icon,
  dark
}: {
  href: string;
  label: string;
  active?: boolean;
  icon: React.ReactNode;
  dark: boolean;
}) {
  return (
    <Link
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
        dark
          ? active
            ? "bg-white/8 text-white"
            : "text-white/55 hover:bg-white/6 hover:text-white"
          : active
            ? "bg-gray-50 text-gray-900"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
      href={href}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg border",
          dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"
        )}
      >
        {icon}
      </span>
      <span className={cn("font-medium", active && "font-semibold")}>{label}</span>
    </Link>
  );
}

function TopbarButton({
  active,
  dark,
  onClick,
  children,
  label
}: {
  active?: boolean;
  dark: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-xl border transition",
        dark
          ? active
            ? "border-white/15 bg-white/10 text-white"
            : "border-white/10 bg-[#121212] text-white/70 hover:bg-white/6 hover:text-white"
          : active
            ? "border-gray-200 bg-gray-50 text-gray-900"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MetricCard({
  title,
  value,
  delta,
  icon,
  dark
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  dark: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]",
        dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white"
      )}
    >
      <div
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-xl",
          dark ? "bg-white/8 text-[#c6b7ff]" : "bg-[#f5f1ff] text-[#7c68ff]"
        )}
      >
        {icon}
      </div>
      <div className={cn("mt-5 text-[2.2rem] font-bold tracking-[-0.07em]", dark ? "text-white" : "text-gray-900")}>{value}</div>
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className={cn("text-sm", dark ? "text-white/55" : "text-gray-500")}>{title}</span>
        <span className="text-sm font-medium text-green-600">{delta}</span>
      </div>
    </article>
  );
}

function ChartCard({
  title,
  value,
  change,
  dark
}: {
  title: string;
  value: string;
  change: string;
  dark: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]",
        dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cn("text-sm", dark ? "text-white/55" : "text-gray-500")}>{title}</p>
          <h3 className={cn("mt-3 text-3xl font-bold tracking-[-0.07em]", dark ? "text-white" : "text-gray-900")}>{value}</h3>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            dark ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-600"
          )}
        >
          {change}
        </span>
      </div>

      <div className={cn("mt-6 h-36 overflow-hidden rounded-xl", dark ? "bg-white/5" : "bg-[#faf7ff]")}>
        <svg className="h-full w-full" fill="none" viewBox="0 0 320 180">
          <path d="M0 150H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M0 110H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M0 70H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M0 30H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path
            d="M8 150C27 148 36 145 48 132C60 119 72 75 88 74C102 73 111 121 128 118C145 115 155 98 168 82C181 66 191 42 208 38C226 33 240 105 256 102C272 99 285 54 312 14"
            stroke="#7c68ff"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M8 180C27 178 36 175 48 162C60 149 72 105 88 104C102 103 111 151 128 148C145 145 155 128 168 112C181 96 191 72 208 68C226 63 240 135 256 132C272 129 285 84 312 44V180H8Z"
            fill="url(#dashboardPurpleArea)"
          />
          <defs>
            <linearGradient id="dashboardPurpleArea" x1="160" x2="160" y1="44" y2="180" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7c68ff" stopOpacity="0.18" />
              <stop offset="1" stopColor="#7c68ff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionState, setSessionState] = useState<ApiProfile | null>(null);
  const [keywordRuns, setKeywordRuns] = useState<KeywordRun[]>([]);
  const [keywordWarning, setKeywordWarning] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("knowlense-dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
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
      setLoading(true);

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
        setKeywordWarning(error instanceof Error ? error.message : "Unable to load dashboard.");
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
  }, [refreshKey, router, supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  }

  const dark = theme === "dark";
  const firstName = sessionState?.email?.split("@")[0] ?? "there";
  const initials = firstName.slice(0, 2).toUpperCase() || "KN";
  const latestRun = keywordRuns[0];

  return (
    <main className={cn("min-h-screen transition-colors", dark ? "bg-[#0e1014] text-white" : "bg-gray-50 text-gray-900")}>
      <div className={cn("grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]", dark ? "bg-[#0e1014]" : "bg-gray-50")}>
        <aside className={cn("px-7 py-8", dark ? "border-r border-white/10 bg-[#0f1116]" : "border-r border-gray-100 bg-white")}>
          <BrandLockup subtitle="TPT seller intelligence" />

          <div className={cn("mt-10 border-t pt-8", dark ? "border-white/8" : "border-gray-100")}>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", dark ? "text-white/35" : "text-gray-400")}>Main menu</p>
            <nav className="mt-4 space-y-1.5">
              <SidebarLink active dark={dark} href="/dashboard" icon={<LayoutGrid size={17} />} label="Dashboard" />
              <SidebarLink dark={dark} href="/account" icon={<UserRound size={17} />} label="Account" />
              <SidebarLink dark={dark} href="/pricing" icon={<CreditCard size={17} />} label="Subscription" />
              <SidebarLink dark={dark} href="/connect" icon={<PlugZap size={17} />} label="Connect extension" />
            </nav>
          </div>

          <div className={cn("mt-10 border-t pt-8", dark ? "border-white/8" : "border-gray-100")}>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", dark ? "text-white/35" : "text-gray-400")}>Others</p>
            <div className="mt-4 space-y-1.5">
              <SidebarLink dark={dark} href="/contact" icon={<LifeBuoy size={17} />} label="Support" />
              <SidebarLink dark={dark} href="/privacy" icon={<Shield size={17} />} label="Privacy" />
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition",
                  dark ? "text-white/55 hover:bg-white/6 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
                onClick={handleSignOut}
                type="button"
              >
                <span className={cn("grid h-9 w-9 place-items-center rounded-lg border", dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white")}>
                  <RefreshCw size={17} />
                </span>
                <span className="font-medium">Log out</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className={cn("border-b px-8 py-5 sm:px-10", dark ? "border-white/10 bg-[#0f1116]" : "border-gray-100 bg-white")}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className={cn("text-[2.6rem] font-extrabold tracking-[-0.09em]", dark ? "text-white" : "text-gray-900")}>Dashboard</h1>
                <p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>Welcome back, {loading ? "..." : firstName}. Your workspace stays clean, focused, and readable.</p>
              </div>

              <div className="flex items-center gap-3 self-start lg:self-auto">
                <TopbarButton active={theme === "light"} dark={dark} label="Light mode" onClick={() => setTheme("light")}>
                  <Sun size={18} />
                </TopbarButton>
                <TopbarButton active={theme === "dark"} dark={dark} label="Dark mode" onClick={() => setTheme("dark")}>
                  <Moon size={18} />
                </TopbarButton>
                <TopbarButton dark={dark} label="Refresh dashboard" onClick={() => setRefreshKey((value) => value + 1)}>
                  <RefreshCw size={18} />
                </TopbarButton>
                <TopbarButton
                  dark={dark}
                  label="Notifications"
                  onClick={() => {
                    if (keywordWarning) {
                      window.alert(keywordWarning);
                      return;
                    }

                    window.alert(
                      latestRun
                        ? `Latest run: ${latestRun.summary.query} at ${new Date(latestRun.created_at).toLocaleString()}`
                        : "No new dashboard notifications."
                    );
                  }}
                >
                  <Bell size={18} />
                </TopbarButton>

                <Link
                  className={cn(
                    "inline-flex items-center gap-3 rounded-xl border px-3 py-2 transition",
                    dark ? "border-white/10 bg-[#111318] hover:bg-white/6" : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                  href="/account"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef2ff] text-sm font-semibold text-[#6f5cff]">{initials}</span>
                  <span className={cn("text-sm font-medium", dark ? "text-white" : "text-gray-900")}>{loading ? "Loading" : firstName}</span>
                </Link>
              </div>
            </div>
          </header>

          <div className={cn("px-8 py-8 sm:px-10", dark ? "bg-[#0e1014]" : "bg-gray-50")}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className={cn("text-[2.2rem] font-extrabold tracking-[-0.08em]", dark ? "text-white" : "text-gray-900")}>Overview</h2>
                <p className={cn("mt-2 max-w-3xl text-sm leading-7", dark ? "text-white/55" : "text-gray-500")}>
                  An overview of your Knowlense workspace, including the current account session, latest activity, and the next actions that matter.
                </p>
              </div>
              <div className={cn("pt-1 text-sm", dark ? "text-white/40" : "text-gray-500")}>Home / Dashboard</div>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-4">
              <MetricCard dark={dark} delta="+0.43%" icon={<Sparkles size={18} />} title="Website sessions" value={loading ? "..." : sessionState ? "1" : "0"} />
              <MetricCard dark={dark} delta="+4.35%" icon={<CreditCard size={18} />} title="Billing readiness" value="Paddle" />
              <MetricCard dark={dark} delta="+2.59%" icon={<LayoutGrid size={18} />} title="Keyword runs" value={loading ? "..." : String(keywordRuns.length)} />
              <MetricCard dark={dark} delta={keywordWarning ? "Needs attention" : "+0.95%"} icon={<PlugZap size={18} />} title="Extension status" value={keywordWarning ? "Check" : "Ready"} />
            </div>

            {keywordWarning ? (
              <div className={cn("mt-5 rounded-2xl border px-5 py-4 text-sm", dark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>
                {keywordWarning}
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 xl:grid-cols-3">
              <ChartCard change="+4%" dark={dark} title="Current account" value={sessionState?.email ?? "No session"} />
              <ChartCard change="+4%" dark={dark} title="Latest query" value={latestRun?.summary.query ?? "Waiting"} />
              <ChartCard change="+4%" dark={dark} title="Next action" value={keywordRuns.length > 0 ? "Review runs" : "Connect extension"} />
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <article className={cn("rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={cn("text-lg font-bold tracking-[-0.05em]", dark ? "text-white" : "text-gray-900")}>Recent Keyword Finder runs</h3>
                    <p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>Recent analyses captured from live TPT search pages.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {keywordRuns.length === 0 ? (
                    <div className={cn("rounded-xl border border-dashed px-5 py-7 text-sm leading-7", dark ? "border-white/10 bg-white/4 text-white/55" : "border-gray-200 bg-gray-50 text-gray-500")}>
                      No runs yet. Connect the extension, open a TPT search page, and analyze it from the popup.
                    </div>
                  ) : (
                    keywordRuns.slice(0, 4).map((run) => (
                      <div className={cn("rounded-xl px-4 py-4", dark ? "bg-white/4" : "bg-gray-50")} key={run.id}>
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className={cn("text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>{run.summary.query}</div>
                          <div className={cn("text-xs", dark ? "text-white/35" : "text-gray-400")}>{new Date(run.created_at).toLocaleString()}</div>
                        </div>
                        <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/55" : "text-gray-500")}>
                          {run.summary.totalResults} observed results. Dominant terms: {run.summary.dominantTerms.slice(0, 4).join(", ")}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {run.opportunities.slice(0, 4).map((item) => (
                            <span
                              className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-medium",
                                dark ? "bg-white/8 text-white/80" : "bg-white text-gray-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                              )}
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

              <article className={cn("rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
                <h3 className={cn("text-lg font-bold tracking-[-0.05em]", dark ? "text-white" : "text-gray-900")}>Quick actions</h3>
                <p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>Use the shortest path to the next meaningful step.</p>

                <div className="mt-5 space-y-3">
                  {[
                    { href: "/connect", label: "Connect extension" },
                    { href: "/pricing", label: "Review plans" },
                    { href: "/account", label: "Open account center" },
                    { href: "/contact", label: "Contact support" }
                  ].map((item) => (
                    <Link
                      className={cn(
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm transition",
                        dark ? "bg-white/4 text-white hover:bg-white/8" : "bg-gray-50 text-gray-900 hover:bg-white hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                      )}
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
