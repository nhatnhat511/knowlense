"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CreditCard, LayoutGrid, LifeBuoy, Moon, PlugZap, RefreshCw, Shield, Sparkles, Sun, UserRound } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand";
import { useSessionStore, useToast } from "@/components/providers/app-providers";
import { useAuthGuard } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useExtensionStatus } from "@/hooks/use-extension-status";
import { signOutFromApi } from "@/lib/api/auth";
import { createCheckout } from "@/lib/api/billing";
import { startDashboardTrial } from "@/lib/api/dashboard";
import { authorizeExtensionConnection } from "@/lib/api/extension-connect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ThemeMode = "light" | "dark";
type DensityMode = "compact" | "comfortable";
type Section = "overview" | "account" | "subscription" | "connect" | "support" | "privacy";

const SECTION_META: Record<Section, { title: string; description: string }> = {
  overview: { title: "Overview", description: "An overview of your Knowlense workspace, including account, billing, extension, and recent activity." },
  account: { title: "Account", description: "Manage your website identity, session state, and account shortcuts without leaving the dashboard." },
  subscription: { title: "Subscription", description: "Review free, trial, and premium states, start a trial, and upgrade to Premium from this workspace." },
  connect: { title: "Connect extension", description: "Approve extension sessions from the dashboard instead of leaving the workspace." },
  support: { title: "Support", description: "Troubleshooting guidance and support escalation live directly in the dashboard." },
  privacy: { title: "Privacy", description: "The key privacy and data-handling commitments are embedded directly into the app workspace." }
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Skeleton({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-200/80", className)} />;
}

function SidebarItem({
  dark,
  active,
  label,
  icon,
  onClick,
  iconOnly
}: {
  dark: boolean;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  iconOnly?: boolean;
}) {
  return (
    <button
      className={cn("flex w-full rounded-xl px-3 py-2.5 text-left text-sm transition", iconOnly ? "justify-center 2xl:justify-start" : "items-center gap-3", dark ? active ? "bg-white/8 text-white" : "text-white/55 hover:bg-white/6 hover:text-white" : active ? "bg-gray-50 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900")}
      onClick={onClick}
      title={iconOnly ? label : undefined}
      type="button"
    >
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg border", dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white")}>{icon}</span>
      {iconOnly ? <span className={cn("hidden font-medium 2xl:inline", active && "font-semibold")}>{label}</span> : <span className={cn("font-medium", active && "font-semibold")}>{label}</span>}
    </button>
  );
}

function TopButton({ dark, active, label, onClick, children }: { dark: boolean; active?: boolean; label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border transition", dark ? active ? "border-white/15 bg-white/10 text-white" : "border-white/10 bg-[#121212] text-white/70 hover:bg-white/6 hover:text-white" : active ? "border-gray-200 bg-gray-50 text-gray-900" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900")}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function DensityButton({
  dark,
  active,
  label,
  onClick
}: {
  dark: boolean;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "h-8 rounded-full px-3 text-xs font-semibold transition",
        dark
          ? active
            ? "bg-white text-gray-900"
            : "text-white/60 hover:text-white"
          : active
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-900"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Card({ dark, compact, title, description, children }: { dark: boolean; compact?: boolean; title: string; description?: string; children: React.ReactNode }) {
  return (
    <article className={cn("rounded-2xl border shadow-[0_20px_55px_rgba(15,23,42,0.08)]", compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
      <h3 className={cn("text-base font-bold tracking-[-0.04em] sm:text-lg", dark ? "text-white" : "text-gray-900")}>{title}</h3>
      {description ? <p className={cn("mt-1 text-sm leading-6", dark ? "text-white/55" : "text-gray-500")}>{description}</p> : null}
      <div className={cn(compact ? "mt-3" : "mt-4")}>{children}</div>
    </article>
  );
}

function Metric({ dark, compact, loading, title, value, delta, icon, action }: { dark: boolean; compact?: boolean; loading?: boolean; title: string; value: string; delta: string; icon: React.ReactNode; action?: React.ReactNode }) {
  return (
    <article className={cn("rounded-2xl border shadow-[0_20px_55px_rgba(15,23,42,0.08)]", compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
      <div className={cn(compact ? "h-8 w-8" : "h-9 w-9", "inline-flex items-center justify-center rounded-xl", dark ? "bg-white/8 text-[#c6b7ff]" : "bg-[#f5f1ff] text-[#7c68ff]")}>{icon}</div>
      {loading ? <Skeleton className={cn(compact ? "mt-3 h-8 w-18" : "mt-4 h-9 w-20")} /> : <div className={cn(compact ? "mt-3 text-[1.65rem] sm:text-[1.85rem]" : "mt-4 text-[1.9rem] sm:text-[2.1rem]", "font-bold tracking-[-0.06em]", dark ? "text-white" : "text-gray-900")}>{value}</div>}
      <div className="mt-1.5 flex items-center justify-between gap-4">
        <span className={cn("text-sm", dark ? "text-white/55" : "text-gray-500")}>{title}</span>
        {loading ? <Skeleton className="h-5 w-14" /> : <span className="text-sm font-medium text-green-600">{delta}</span>}
      </div>
      {action ? <div className={cn(compact ? "mt-2.5" : "mt-3")}>{action}</div> : null}
    </article>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user } = useSessionStore();
  const { accessToken, isLoading: authLoading } = useAuthGuard("/dashboard");
  const { metrics, overview, loading, error, refresh } = useDashboardData(accessToken, Boolean(accessToken));
  const extensionStatus = useExtensionStatus(accessToken, Boolean(accessToken));
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [density, setDensity] = useState<DensityMode>("comfortable");
  const [checkoutLoading, setCheckoutLoading] = useState<"" | "monthly" | "yearly">("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);

  const section = (searchParams.get("section") as Section) || "overview";
  const requestId = searchParams.get("request");
  const dark = theme === "dark";
  const compact = density === "compact";
  const firstName = user?.name ?? "there";
  const initials = firstName.slice(0, 2).toUpperCase() || "KN";
  const quotaAtLimit = Boolean(metrics?.keywordRuns.disabled || overview?.quota.atLimit);
  const sectionMeta = SECTION_META[section] ?? SECTION_META.overview;
  const billing = metrics?.billing;
  const planLabel = billing?.status === "active" ? "Premium" : billing?.status === "trial" ? "Premium Trial" : billing?.status === "expired" ? "Trial expired" : "Free";
  const sidebarCollapsed = true;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("knowlense-dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    const savedDensity = window.localStorage.getItem("knowlense-dashboard-density");
    if (savedDensity === "compact" || savedDensity === "comfortable") {
      setDensity(savedDensity);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("knowlense-dashboard-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("knowlense-dashboard-density", density);
  }, [density]);

  function setSection(next: Section) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("section");
    else params.set("section", next);
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  async function handleSignOut() {
    await signOutFromApi().catch(() => null);
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.push("/auth/sign-in");
  }

  async function handleUpgrade(interval: "monthly" | "yearly") {
    if (!accessToken) return;
    setCheckoutLoading(interval);
    try {
      const result = await createCheckout(accessToken, interval);
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Unable to start Paddle checkout.");
    } finally {
      setCheckoutLoading("");
    }
  }

  async function handleTrial() {
    if (!accessToken) return;
    setTrialLoading(true);
    try {
      const result = await startDashboardTrial(accessToken);
      showToast(`Trial started. ${result.trialDaysRemaining} days remaining.`);
      refresh();
      setSection("subscription");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Unable to start your trial.");
    } finally {
      setTrialLoading(false);
    }
  }

  async function handleConnect() {
    if (!accessToken || !requestId) {
      showToast("Open the extension popup first so it can create a website approval request.");
      return;
    }
    setConnectBusy(true);
    try {
      await authorizeExtensionConnection(accessToken, requestId);
      showToast("Extension connected. Return to the popup.");
      refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Unable to connect the extension.");
    } finally {
      setConnectBusy(false);
    }
  }

  function overviewView() {
    return (
      <>
        <div className={cn("mt-5 grid gap-3.5 md:grid-cols-2", compact ? "xl:grid-cols-4" : "xl:grid-cols-4 2xl:gap-4")}>
          <Metric compact={compact} dark={dark} loading={loading} title="Website sessions" value={metrics ? String(metrics.websiteSessions.value) : "..."} delta={metrics?.websiteSessions.delta ?? "--"} icon={<Sparkles size={18} />} />
          <Metric
            compact={compact}
            dark={dark}
            loading={loading}
            title="Subscription"
            value={billing?.readiness ?? "..."}
            delta={billing?.delta ?? "--"}
            icon={<CreditCard size={18} />}
            action={billing?.status !== "active" ? <button className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} onClick={() => setSection("subscription")} type="button">{billing?.trialEligible ? "Start trial" : "Upgrade"}</button> : null}
          />
          <Metric
            compact={compact}
            dark={dark}
            loading={loading}
            title="Keyword runs"
            value={metrics ? `${metrics.keywordRuns.used}/${metrics.keywordRuns.limit}` : "..."}
            delta={metrics?.keywordRuns.delta ?? "--"}
            icon={<LayoutGrid size={18} />}
            action={quotaAtLimit ? <button className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold", dark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-400")} disabled type="button">Quota reached</button> : null}
          />
          <Metric
            compact={compact}
            dark={dark}
            loading={loading}
            title="Extension status"
            value={extensionStatus?.label ?? metrics?.extensionStatus.label ?? "..."}
            delta={extensionStatus?.status === "active" ? "+0.95%" : "Reconnect"}
            icon={<PlugZap size={18} />}
            action={extensionStatus?.status !== "active" ? <button className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} onClick={() => setSection("connect")} type="button">Connect</button> : null}
          />
        </div>

        {error ? <div className={cn("mt-4 rounded-2xl border px-4 py-3 text-sm", dark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>{error}</div> : null}

        <div className={cn("mt-5 grid gap-3.5", compact ? "xl:grid-cols-3" : "xl:grid-cols-3 2xl:gap-4")}>
          <Card compact={compact} dark={dark} title="Current account"><div className={cn("text-[1.8rem] font-bold tracking-[-0.06em] break-words sm:text-[2rem]", dark ? "text-white" : "text-gray-900")}>{overview?.currentAccount.value ?? "..."}</div><p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>{overview?.currentAccount.status ?? "Loading"}</p></Card>
          <Card compact={compact} dark={dark} title="Latest query"><div className={cn("text-[1.8rem] font-bold tracking-[-0.06em] break-words sm:text-[2rem]", dark ? "text-white" : "text-gray-900")}>{overview?.latestQuery.value ?? "..."}</div><p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>{overview?.latestQuery.status === "waiting" || overview?.latestQuery.status === "processing" ? "Auto-refreshing until completed" : overview?.latestQuery.updatedAt ? new Date(overview.latestQuery.updatedAt).toLocaleString() : "No recent query"}</p></Card>
          <Card compact={compact} dark={dark} title="Next action"><div className={cn("text-[1.8rem] font-bold tracking-[-0.06em] break-words sm:text-[2rem]", dark ? "text-white" : "text-gray-900")}>{extensionStatus?.status === "active" ? overview?.nextAction.value ?? "Review runs" : "Connect"}</div><p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>{quotaAtLimit ? "Upgrade to continue analyzing" : extensionStatus?.status === "active" ? "Extension connected" : "Extension needs connection"}</p></Card>
        </div>
      </>
    );
  }

  function accountView() {
    return (
      <div className={cn("mt-5 grid gap-3.5", compact ? "xl:grid-cols-[1.15fr_0.85fr]" : "xl:grid-cols-[1.1fr_0.9fr] 2xl:gap-4")}>
        <Card compact={compact} dark={dark} title="Account profile" description="Identity, session, and access state stay visible inside the dashboard.">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold", dark ? "bg-white/8 text-white" : "bg-gray-100 text-black")}>{initials}</div>
            <div>
              <div className={cn("text-lg font-semibold tracking-[-0.04em] break-words sm:text-xl", dark ? "text-white" : "text-black")}>{overview?.currentAccount.value ?? user?.email ?? "Loading..."}</div>
              <div className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>{planLabel} plan with {extensionStatus?.status === "active" ? "an active extension session." : "website-first access."}</div>
            </div>
          </div>
          <div className={cn(compact ? "mt-4 grid gap-3 sm:grid-cols-3" : "mt-6 grid gap-3 sm:grid-cols-3")}>
            {[
              { label: "Plan", value: planLabel, copy: billing?.trialActive ? `${billing.trialDaysRemaining} days left in trial.` : "Upgrade when you want recurring research usage." },
              { label: "Website session", value: accessToken ? "Active" : "Inactive", copy: "The website remains the primary sign-in surface." },
              { label: "Extension access", value: extensionStatus?.status === "active" ? "Connected" : "Approval based", copy: "Each browser session is approved from this workspace." }
            ].map((item) => <div className={cn("rounded-[20px] border p-3.5", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")} key={item.label}><div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/35" : "text-neutral-400")}>{item.label}</div><div className={cn("mt-2 text-base font-semibold sm:text-lg", dark ? "text-white" : "text-black")}>{item.value}</div><div className={cn("mt-1 text-sm leading-6", dark ? "text-white/55" : "text-neutral-500")}>{item.copy}</div></div>)}
          </div>
        </Card>
        <Card compact={compact} dark={dark} title="Workspace controls" description="Keep the important account actions close without repeating full navigation cards.">
          <div className="flex flex-wrap gap-3">
            <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition", dark ? "bg-white/8 text-white hover:bg-white/12" : "bg-gray-100 text-gray-900 hover:bg-gray-200")} onClick={() => setSection("subscription")} type="button">Open subscription</button>
            <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition", dark ? "bg-white/8 text-white hover:bg-white/12" : "bg-gray-100 text-gray-900 hover:bg-gray-200")} onClick={() => setSection("connect")} type="button">Connect extension</button>
            <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition", dark ? "bg-white/8 text-white hover:bg-white/12" : "bg-gray-100 text-gray-900 hover:bg-gray-200")} onClick={() => setSection("support")} type="button">Open support</button>
            <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition", dark ? "bg-red-500/15 text-red-200 hover:bg-red-500/20" : "bg-red-50 text-red-700 hover:bg-red-100")} onClick={handleSignOut} type="button">Log out</button>
          </div>
        </Card>
      </div>
    );
  }

  function subscriptionView() {
    return (
      <div className={cn("mt-5 grid gap-3.5", compact ? "xl:grid-cols-[1.15fr_0.85fr]" : "xl:grid-cols-[1.1fr_0.9fr] 2xl:gap-4")}>
        <Card compact={compact} dark={dark} title="Current subscription state" description="Free, trial, and Premium are surfaced directly by the workspace.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-white")}><div className={cn("text-sm font-medium", dark ? "text-white/55" : "text-neutral-500")}>Current plan</div><div className={cn("mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] sm:text-[2rem]", dark ? "text-white" : "text-black")}>{planLabel}</div><p className={cn("mt-2 text-sm leading-6", dark ? "text-white/55" : "text-neutral-600")}>{billing?.status === "trial" ? `Your trial is active with ${billing.trialDaysRemaining} days remaining.` : billing?.status === "active" ? "Premium is active for this account." : "Your account is on the free plan. Start a 7-day trial with no card required or upgrade directly to Premium."}</p></div>
            <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}><div className={cn("text-sm font-medium", dark ? "text-white/55" : "text-neutral-500")}>Keyword usage</div><div className={cn("mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] sm:text-[2rem]", dark ? "text-white" : "text-black")}>{metrics ? `${metrics.keywordRuns.used}/${metrics.keywordRuns.limit}` : "..."}</div><p className={cn("mt-2 text-sm leading-6", dark ? "text-white/55" : "text-neutral-600")}>{quotaAtLimit ? "You have reached the current usage limit. Upgrade to continue." : `${metrics?.keywordRuns.remaining ?? 0} runs are still available on this account.`}</p></div>
          </div>
          <div className={cn(compact ? "mt-3 flex flex-wrap gap-2.5" : "mt-4 flex flex-wrap gap-3")}>
            {billing?.status !== "active" && billing?.trialEligible ? <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} disabled={trialLoading} onClick={() => void handleTrial()} type="button">{trialLoading ? "Starting trial..." : "Start 7-day trial"}</button> : null}
            {billing?.status !== "active" ? <button className="inline-flex h-11 items-center rounded-full bg-[#7c68ff] px-4 text-sm font-semibold text-white transition hover:bg-[#6b57f5]" disabled={checkoutLoading !== ""} onClick={() => void handleUpgrade("monthly")} type="button">{checkoutLoading === "monthly" ? "Preparing..." : "Upgrade to Premium"}</button> : null}
            {billing?.status !== "active" ? <button className={cn("inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} disabled={checkoutLoading !== ""} onClick={() => void handleUpgrade("yearly")} type="button">{checkoutLoading === "yearly" ? "Preparing..." : "Choose yearly"}</button> : null}
          </div>
        </Card>
        <Card compact={compact} dark={dark} title="Plan logic" description="The dashboard keeps subscription states legible and actionable.">
          <div className="space-y-3 text-sm leading-6">
            {[
              "Free: website access, extension connection, and initial workspace validation.",
              "Trial: 7 days, no card required, started once from inside the dashboard.",
              "Premium: checkout is created by knowlense-api through Paddle.",
              "At limit: keyword analysis should direct the user to Premium rather than fail silently."
            ].map((item) => <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")} key={item}>{item}</div>)}
          </div>
        </Card>
      </div>
    );
  }

  function connectView() {
    return (
      <div className={cn("mt-5 grid gap-3.5", compact ? "xl:grid-cols-[1.15fr_0.85fr]" : "xl:grid-cols-[1.1fr_0.9fr] 2xl:gap-4")}>
        <Card compact={compact} dark={dark} title="Connect extension" description="The extension does not ask for website credentials directly. Approval happens here.">
          <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-white")}>
            <div className={cn("text-sm font-medium", dark ? "text-white/55" : "text-neutral-500")}>Current status</div>
            <div className={cn("mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] sm:text-[2rem]", dark ? "text-white" : "text-black")}>{extensionStatus?.status === "active" ? "Connected" : requestId ? "Pending approval" : "Waiting for request"}</div>
            <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/55" : "text-neutral-600")}>{requestId ? "An extension request was detected. Approve it below and return to the popup." : "Open the extension popup and choose Connect via website. Once the popup sends a request, approve it here."}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} disabled={!requestId || connectBusy} onClick={() => void handleConnect()} type="button">{connectBusy ? "Connecting..." : "Approve extension"}</button>
              <button className={cn("inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} onClick={refresh} type="button">Refresh status</button>
            </div>
          </div>
        </Card>
        <Card compact={compact} dark={dark} title="Connection notes" description="The browser session is approved from the website and then handed back to the popup as a separate Worker-managed token.">
          <div className="space-y-3 text-sm leading-6">
            {[
              "The popup creates a connection request through knowlense-api.",
              "The website approves the request and never exposes the account password to the extension.",
              "After approval, the popup receives a separate extension token handled by the Worker.",
              extensionStatus?.status === "active" ? "This account currently has an active extension session." : "No active extension session is currently visible for this account."
            ].map((item) => <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")} key={item}>{item}</div>)}
          </div>
        </Card>
      </div>
    );
  }

  function textPanel(title: string, items: string[]) {
    return <div className="mt-5"><Card compact={compact} dark={dark} title={title} description="Embedded directly in the workspace to avoid forcing a page change."><div className="space-y-3 text-sm leading-6">{items.map((item) => <div className={cn("rounded-[18px] border p-3.5", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")} key={item}>{item}</div>)}</div></Card></div>;
  }

  return (
    <main className={cn("min-h-screen transition-colors", dark ? "bg-[#0e1014] text-white" : "bg-gray-50 text-gray-900")}>
      <div className={cn("grid min-h-screen lg:grid-cols-[92px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)]", dark ? "bg-[#0e1014]" : "bg-gray-50")}>
        <aside className={cn("px-4 py-5 2xl:px-5 2xl:py-6", dark ? "border-r border-white/10 bg-[#0f1116]" : "border-r border-gray-100 bg-white")}>
          <div className="flex justify-center 2xl:hidden">
            <BrandLockup compact href="/dashboard" iconOnly subtitle="" />
          </div>
          <div className="hidden 2xl:flex">
            <BrandLockup compact href="/dashboard" subtitle="" />
          </div>
          <div className={cn("mt-6 border-t pt-5 2xl:mt-7 2xl:pt-6", dark ? "border-white/8" : "border-gray-100")}><p className={cn("hidden px-1 text-[11px] font-semibold uppercase tracking-[0.16em] 2xl:block", dark ? "text-white/30" : "text-gray-400")}>Workspace</p><nav className="mt-3 space-y-1"><SidebarItem active={section === "overview"} dark={dark} icon={<LayoutGrid size={16} />} iconOnly={sidebarCollapsed} label="Dashboard" onClick={() => setSection("overview")} /><SidebarItem active={section === "account"} dark={dark} icon={<UserRound size={16} />} iconOnly={sidebarCollapsed} label="Account" onClick={() => setSection("account")} /><SidebarItem active={section === "subscription"} dark={dark} icon={<CreditCard size={16} />} iconOnly={sidebarCollapsed} label="Subscription" onClick={() => setSection("subscription")} /><SidebarItem active={section === "connect"} dark={dark} icon={<PlugZap size={16} />} iconOnly={sidebarCollapsed} label="Connect" onClick={() => setSection("connect")} /></nav></div>
          <div className={cn("mt-6 border-t pt-5 2xl:mt-7 2xl:pt-6", dark ? "border-white/8" : "border-gray-100")}><p className={cn("hidden px-1 text-[11px] font-semibold uppercase tracking-[0.16em] 2xl:block", dark ? "text-white/30" : "text-gray-400")}>More</p><div className="mt-3 space-y-1"><SidebarItem active={section === "support"} dark={dark} icon={<LifeBuoy size={16} />} iconOnly={sidebarCollapsed} label="Support" onClick={() => setSection("support")} /><SidebarItem active={section === "privacy"} dark={dark} icon={<Shield size={16} />} iconOnly={sidebarCollapsed} label="Privacy" onClick={() => setSection("privacy")} /><button className={cn("flex w-full rounded-xl px-3 py-2.5 text-left text-sm transition", sidebarCollapsed ? "justify-center 2xl:justify-start" : "items-center gap-3", dark ? "text-white/55 hover:bg-white/6 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900")} onClick={handleSignOut} title={sidebarCollapsed ? "Log out" : undefined} type="button"><span className={cn("grid h-8 w-8 place-items-center rounded-lg border", dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white")}><RefreshCw size={16} /></span><span className={cn(sidebarCollapsed ? "hidden 2xl:inline font-medium" : "font-medium")}>Log out</span></button></div></div>
        </aside>

        <section className="min-w-0">
          <header className={cn("border-b", compact ? "px-5 py-3.5 sm:px-6" : "px-6 py-4 sm:px-8", dark ? "border-white/10 bg-[#0f1116]" : "border-gray-100 bg-white")}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div><h1 className={cn(compact ? "text-[1.9rem] sm:text-[2rem]" : "text-[2.15rem]", "font-extrabold tracking-[-0.08em]", dark ? "text-white" : "text-gray-900")}>Dashboard</h1><p className={cn("mt-1 text-sm", dark ? "text-white/55" : "text-gray-500")}>{section === "overview" ? `Welcome back, ${authLoading ? "..." : firstName}.` : `${sectionMeta.title} is inside your workspace.`}</p></div>
              <div className="flex flex-wrap items-center gap-2 self-start lg:justify-end lg:self-auto">
                <div className={cn("inline-flex items-center gap-1 rounded-full border p-1", dark ? "border-white/10 bg-[#111318]" : "border-gray-200 bg-gray-50")}>
                  <DensityButton active={density === "compact"} dark={dark} label="Compact" onClick={() => setDensity("compact")} />
                  <DensityButton active={density === "comfortable"} dark={dark} label="Comfortable" onClick={() => setDensity("comfortable")} />
                </div>
                <TopButton active={theme === "light"} dark={dark} label="Light mode" onClick={() => setTheme("light")}><Sun size={17} /></TopButton><TopButton active={theme === "dark"} dark={dark} label="Dark mode" onClick={() => setTheme("dark")}><Moon size={17} /></TopButton><TopButton dark={dark} label="Refresh dashboard" onClick={refresh}><RefreshCw size={17} /></TopButton><TopButton dark={dark} label="Notifications" onClick={() => showToast(overview?.recentRuns[0] ? `Latest run: ${overview.recentRuns[0].query}` : "No new dashboard notifications.")}><Bell size={17} /></TopButton><button className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 transition", dark ? "border-white/10 bg-[#111318] hover:bg-white/6" : "border-gray-200 bg-white hover:bg-gray-50")} onClick={() => setSection("account")} type="button"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef2ff] text-xs font-semibold text-[#6f5cff]">{initials}</span><span className={cn("text-sm font-medium", dark ? "text-white" : "text-gray-900")}>{authLoading ? "Loading" : firstName}</span></button></div>
            </div>
          </header>

          <div className={cn(compact ? "px-5 py-5 sm:px-6" : "px-6 py-6 sm:px-8", dark ? "bg-[#0e1014]" : "bg-gray-50")}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div><h2 className={cn(compact ? "text-[1.65rem]" : "text-[1.85rem]", "font-extrabold tracking-[-0.07em]", dark ? "text-white" : "text-gray-900")}>{sectionMeta.title}</h2><p className={cn("mt-2 max-w-3xl text-sm leading-7", dark ? "text-white/55" : "text-gray-500")}>{sectionMeta.description}</p></div>
              <div className={cn("pt-1 text-sm", dark ? "text-white/40" : "text-gray-500")}>{section === "overview" ? "Home / Dashboard" : `Home / Dashboard / ${sectionMeta.title}`}</div>
            </div>

            {section === "overview" ? overviewView() : null}
            {section === "account" ? accountView() : null}
            {section === "subscription" ? subscriptionView() : null}
            {section === "connect" ? connectView() : null}
            {section === "support" ? textPanel("Support center", [
              "Auth issues: if sign-in loops or callback problems happen, clear the current session and sign in again from the website.",
              "Extension issues: open the popup, choose Connect via website, then approve the request in the Connect extension section.",
              "Billing issues: if plan state looks wrong, refresh the workspace and retry the Premium upgrade flow.",
              "Quota issues: if keyword runs hit the limit, the workspace should steer the user toward Premium."
            ]) : null}
            {section === "privacy" ? textPanel("Privacy summary", [
              "Supabase handles website identity and authentication.",
              "Cloudflare Workers and D1 handle product logic, extension sessions, and workspace data.",
              "Paddle handles checkout, tax, and invoice processing for paid plans.",
              "The extension receives an approval-based session instead of direct website credentials."
            ]) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f7f5]" />}>
      <DashboardContent />
    </Suspense>
  );
}
