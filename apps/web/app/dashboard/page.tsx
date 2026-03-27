"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CreditCard, LayoutGrid, LifeBuoy, Moon, PlugZap, RefreshCw, Shield, Sparkles, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand/brand";
import { useSessionStore, useToast } from "@/components/providers/app-providers";
import { useAuthGuard } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useExtensionStatus } from "@/hooks/use-extension-status";
import { signOutFromApi } from "@/lib/api/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ThemeMode = "light" | "dark";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-200/80", className)} />;
}

function SidebarLink({
  href,
  label,
  active,
  icon,
  dark,
  disabled
}: {
  href: string;
  label: string;
  active?: boolean;
  icon: React.ReactNode;
  dark: boolean;
  disabled?: boolean;
}) {
  return (
    <Link
      aria-disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
        disabled && "pointer-events-none opacity-50",
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
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg border", dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white")}>{icon}</span>
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
  dark,
  loading,
  cta
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  dark: boolean;
  loading?: boolean;
  cta?: React.ReactNode;
}) {
  return (
    <article className={cn("rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
      <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", dark ? "bg-white/8 text-[#c6b7ff]" : "bg-[#f5f1ff] text-[#7c68ff]")}>{icon}</div>
      {loading ? <SkeletonBlock className="mt-5 h-10 w-20" /> : <div className={cn("mt-5 text-[2.2rem] font-bold tracking-[-0.07em]", dark ? "text-white" : "text-gray-900")}>{value}</div>}
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className={cn("text-sm", dark ? "text-white/55" : "text-gray-500")}>{title}</span>
        {loading ? <SkeletonBlock className="h-5 w-14" /> : <span className="text-sm font-medium text-green-600">{delta}</span>}
      </div>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </article>
  );
}

function OverviewCard({
  title,
  value,
  subtitle,
  dark,
  loading
}: {
  title: string;
  value: string;
  subtitle: string;
  dark: boolean;
  loading?: boolean;
}) {
  return (
    <article className={cn("rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
      <p className={cn("text-sm", dark ? "text-white/55" : "text-gray-500")}>{title}</p>
      {loading ? <SkeletonBlock className="mt-4 h-10 w-40" /> : <h3 className={cn("mt-3 text-3xl font-bold tracking-[-0.07em]", dark ? "text-white" : "text-gray-900")}>{value}</h3>}
      {loading ? <SkeletonBlock className="mt-3 h-5 w-24" /> : <p className={cn("mt-3 text-sm", dark ? "text-white/55" : "text-gray-500")}>{subtitle}</p>}
      <div className={cn("mt-6 h-36 overflow-hidden rounded-xl", dark ? "bg-white/5" : "bg-[#faf7ff]")}>
        <svg className="h-full w-full" fill="none" viewBox="0 0 320 180">
          <path d="M0 150H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M0 110H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M0 70H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M0 30H320" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
          <path d="M8 150C27 148 36 145 48 132C60 119 72 75 88 74C102 73 111 121 128 118C145 115 155 98 168 82C181 66 191 42 208 38C226 33 240 105 256 102C272 99 285 54 312 14" stroke="#7c68ff" strokeLinecap="round" strokeWidth="4" />
          <path d="M8 180C27 178 36 175 48 162C60 149 72 105 88 104C102 103 111 151 128 148C145 145 155 128 168 112C181 96 191 72 208 68C226 63 240 135 256 132C272 129 285 84 312 44V180H8Z" fill="url(#overviewPurpleArea)" />
          <defs>
            <linearGradient id="overviewPurpleArea" x1="160" x2="160" y1="44" y2="180" gradientUnits="userSpaceOnUse">
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
  const { showToast } = useToast();
  const { user } = useSessionStore();
  const { accessToken, isLoading: authLoading } = useAuthGuard("/dashboard");
  const { metrics, overview, loading, error, refresh } = useDashboardData(accessToken, Boolean(accessToken));
  const extensionStatus = useExtensionStatus(accessToken, Boolean(accessToken));
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

  const dark = theme === "dark";
  const firstName = user?.name ?? "there";
  const initials = firstName.slice(0, 2).toUpperCase() || "KN";
  const quotaAtLimit = Boolean(metrics?.keywordRuns.disabled || overview?.quota.atLimit);
  const latestQueryWaiting = overview?.latestQuery.status === "waiting" || overview?.latestQuery.status === "processing";

  async function handleSignOut() {
    await signOutFromApi().catch(() => null);
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.push("/auth/sign-in");
  }

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
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition", dark ? "text-white/55 hover:bg-white/6 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900")}
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
                <p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>Welcome back, {authLoading ? "..." : firstName}. Your workspace stays clean, focused, and readable.</p>
              </div>

              <div className="flex items-center gap-3 self-start lg:self-auto">
                <TopbarButton active={theme === "light"} dark={dark} label="Light mode" onClick={() => setTheme("light")}>
                  <Sun size={18} />
                </TopbarButton>
                <TopbarButton active={theme === "dark"} dark={dark} label="Dark mode" onClick={() => setTheme("dark")}>
                  <Moon size={18} />
                </TopbarButton>
                <TopbarButton dark={dark} label="Refresh dashboard" onClick={refresh}>
                  <RefreshCw size={18} />
                </TopbarButton>
                <TopbarButton
                  dark={dark}
                  label="Notifications"
                  onClick={() => {
                    const message = overview?.recentRuns[0]
                      ? `Latest run: ${overview.recentRuns[0].query} at ${new Date(overview.recentRuns[0].createdAt).toLocaleString()}`
                      : "No new dashboard notifications.";
                    showToast(message);
                  }}
                >
                  <Bell size={18} />
                </TopbarButton>

                <Link
                  className={cn("inline-flex items-center gap-3 rounded-xl border px-3 py-2 transition", dark ? "border-white/10 bg-[#111318] hover:bg-white/6" : "border-gray-200 bg-white hover:bg-gray-50")}
                  href="/account"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef2ff] text-sm font-semibold text-[#6f5cff]">
                    {initials}
                  </span>
                  <span className={cn("text-sm font-medium", dark ? "text-white" : "text-gray-900")}>{authLoading ? "Loading" : firstName}</span>
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
              <MetricCard
                cta={
                  metrics?.billing.status !== "active" ? (
                    <Link className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} href="/pricing">
                      {metrics?.billing.ctaLabel ?? "Upgrade"}
                    </Link>
                  ) : null
                }
                dark={dark}
                delta={metrics?.websiteSessions.delta ?? "--"}
                icon={<Sparkles size={18} />}
                loading={loading}
                title="Website sessions"
                value={metrics ? String(metrics.websiteSessions.value) : "..."}
              />
              <MetricCard
                cta={
                  metrics?.billing.status !== "active" ? (
                    <Link className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} href="/pricing">
                      {metrics?.billing.ctaLabel ?? "Upgrade"}
                    </Link>
                  ) : null
                }
                dark={dark}
                delta={metrics?.billing.delta ?? "--"}
                icon={<CreditCard size={18} />}
                loading={loading}
                title="Paddle billing readiness"
                value={metrics?.billing.readiness ?? "..."}
              />
              <MetricCard
                cta={
                  quotaAtLimit ? (
                    <button
                      className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition", dark ? "cursor-not-allowed bg-white/10 text-white/60" : "cursor-not-allowed bg-gray-100 text-gray-400")}
                      disabled
                      onClick={() => showToast("Keyword runs quota reached. Upgrade your plan to continue.")}
                      type="button"
                    >
                      Quota reached
                    </button>
                  ) : null
                }
                dark={dark}
                delta={metrics?.keywordRuns.delta ?? "--"}
                icon={<LayoutGrid size={18} />}
                loading={loading}
                title="Keyword runs"
                value={metrics ? `${metrics.keywordRuns.used}/${metrics.keywordRuns.limit}` : "..."}
              />
              <MetricCard
                dark={dark}
                delta={extensionStatus?.status === "active" ? "+0.95%" : "Reconnect"}
                icon={<PlugZap size={18} />}
                loading={loading}
                title="Extension status"
                value={extensionStatus?.label ?? metrics?.extensionStatus.label ?? "..."}
              />
            </div>

            {error ? (
              <div className={cn("mt-5 rounded-2xl border px-5 py-4 text-sm", dark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>
                {error}
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 xl:grid-cols-3">
              <OverviewCard
                dark={dark}
                loading={loading}
                subtitle={overview?.currentAccount.status ?? "Loading"}
                title="Current account"
                value={overview?.currentAccount.value ?? "..."}
              />
              <OverviewCard
                dark={dark}
                loading={loading}
                subtitle={latestQueryWaiting ? "Auto-refreshing until completed" : overview?.latestQuery.updatedAt ? new Date(overview.latestQuery.updatedAt).toLocaleString() : "No recent query"}
                title="Latest query"
                value={overview?.latestQuery.value ?? "..."}
              />
              <OverviewCard
                dark={dark}
                loading={loading}
                subtitle={quotaAtLimit ? "Upgrade to continue analyzing" : extensionStatus?.status === "active" ? "Extension connected" : "Extension needs connection"}
                title="Next action"
                value={extensionStatus?.status === "active" ? overview?.nextAction.value ?? "Review runs" : "Connect"}
              />
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
                  {!overview && loading ? (
                    <>
                      <SkeletonBlock className="h-28 w-full" />
                      <SkeletonBlock className="h-28 w-full" />
                    </>
                  ) : overview?.recentRuns.length ? (
                    overview.recentRuns.map((run) => (
                      <div className={cn("rounded-xl px-4 py-4", dark ? "bg-white/4" : "bg-gray-50")} key={run.id}>
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className={cn("text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>{run.query}</div>
                          <div className={cn("text-xs", dark ? "text-white/35" : "text-gray-400")}>{new Date(run.createdAt).toLocaleString()}</div>
                        </div>
                        <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/55" : "text-gray-500")}>
                          {run.summary.totalResults} observed results. Dominant terms: {run.summary.dominantTerms.slice(0, 4).join(", ")}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {run.opportunities.slice(0, 4).map((item) => (
                            <span className={cn("rounded-full px-3 py-1.5 text-xs font-medium", dark ? "bg-white/8 text-white/80" : "bg-white text-gray-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)]")} key={`${run.id}-${item.phrase}`}>
                              {item.phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={cn("rounded-xl border border-dashed px-5 py-7 text-sm leading-7", dark ? "border-white/10 bg-white/4 text-white/55" : "border-gray-200 bg-gray-50 text-gray-500")}>
                      No runs yet. Connect the extension, open a TPT search page, and analyze it from the popup.
                    </div>
                  )}
                </div>
              </article>

              <article className={cn("rounded-2xl border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
                <h3 className={cn("text-lg font-bold tracking-[-0.05em]", dark ? "text-white" : "text-gray-900")}>Quick actions</h3>
                <p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>Use the shortest path to the next meaningful step.</p>

                <div className="mt-5 space-y-3">
                  {[
                    { href: extensionStatus?.status === "active" ? "/dashboard" : "/connect", label: extensionStatus?.status === "active" ? "Extension active" : "Connect extension", disabled: extensionStatus?.status === "active" },
                    { href: "/pricing", label: metrics?.billing.status === "active" ? "Billing active" : "Upgrade plan" },
                    { href: "/account", label: "Open account center" },
                    { href: "/contact", label: "Contact support" }
                  ].map((item) => (
                    <Link
                      aria-disabled={item.disabled}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm transition",
                        item.disabled && "pointer-events-none opacity-60",
                        dark ? "bg-white/4 text-white hover:bg-white/8" : "bg-gray-50 text-gray-900 hover:bg-white hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                      )}
                      href={item.href}
                      key={item.label}
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
