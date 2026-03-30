"use client";

import { Suspense, useEffect, useRef, useState, startTransition, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CreditCard, Globe2, KeyRound, LayoutGrid, LifeBuoy, Moon, PlugZap, RefreshCw, Shield, Sparkles, Sun, Trash2, Upload, UserRound } from "lucide-react";
import { FaBrave, FaChrome, FaEdge, FaFirefoxBrowser, FaSafari } from "react-icons/fa6";
import { SiGithub, SiGoogle } from "react-icons/si";
import { BrandLockup } from "@/components/brand/brand";
import { useSessionStore, useToast } from "@/components/providers/app-providers";
import { useAuthGuard } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useExtensionStatus } from "@/hooks/use-extension-status";
import { signOutFromApi } from "@/lib/api/auth";
import { createCheckout } from "@/lib/api/billing";
import { fetchRankTrackingDashboard, startDashboardTrial, type RankTrackingDashboard } from "@/lib/api/dashboard";
import { authorizeExtensionConnection, fetchExtensionDevices, revokeExtensionDevice, revokeOtherExtensionDevices } from "@/lib/api/extension-connect";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ThemeMode = "light" | "dark";
type Section = "overview" | "rankings" | "account" | "subscription" | "support" | "privacy";

const SECTION_META: Record<Section, { title: string; description: string }> = {
  overview: { title: "Dashboard", description: "A tighter overview of your account, subscription state, extension access, and latest workspace signals." },
  rankings: { title: "Keyword Rankings", description: "Track keyword movement over time for the exact product + keyword pairs started from the extension." },
  account: { title: "Account", description: "Manage your website identity, connected browsers, and account shortcuts without leaving the dashboard." },
  subscription: { title: "Subscription", description: "Review free, trial, and premium states, start a trial, and upgrade to Premium from this workspace." },
  support: { title: "Support", description: "Troubleshooting guidance and support escalation live directly in the dashboard." },
  privacy: { title: "Privacy", description: "The key privacy and data-handling commitments are embedded directly into the app workspace." }
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDeviceTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getBrowserBadge(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("chrome")) {
    return { icon: <FaChrome size={18} />, tone: "bg-[#e8f0ff] text-[#2563eb]" };
  }

  if (normalized.includes("brave")) {
    return { icon: <FaBrave size={18} />, tone: "bg-[#fff0ea] text-[#ea580c]" };
  }

  if (normalized.includes("edge")) {
    return { icon: <FaEdge size={18} />, tone: "bg-[#e8fbf4] text-[#0f766e]" };
  }

  if (normalized.includes("firefox")) {
    return { icon: <FaFirefoxBrowser size={18} />, tone: "bg-[#fff1e7] text-[#c2410c]" };
  }

  if (normalized.includes("safari")) {
    return { icon: <FaSafari size={18} />, tone: "bg-[#eef2ff] text-[#4f46e5]" };
  }

  if (normalized.includes("browser")) {
    return { icon: <Globe2 size={18} />, tone: "bg-[#eff6ff] text-[#1d4ed8]" };
  }

  return { icon: <Globe2 size={18} />, tone: "bg-gray-100 text-gray-600" };
}

function getSignInMethodMeta(method: "email" | "google" | "github" | "unknown") {
  switch (method) {
    case "google":
      return {
        label: "Google",
        icon: <SiGoogle size={16} />,
        tone: "bg-[#fff7e8] text-[#b45309]"
      };
    case "github":
      return {
        label: "GitHub",
        icon: <SiGithub size={16} />,
        tone: "bg-[#f3f4f6] text-[#111827]"
      };
    case "email":
      return {
        label: "Email",
        icon: <UserRound size={16} />,
        tone: "bg-[#eef2ff] text-[#4338ca]"
      };
    default:
      return {
        label: "Unknown",
        icon: <Globe2 size={16} />,
        tone: "bg-gray-100 text-gray-600"
      };
  }
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
      className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition", iconOnly ? "justify-center 2xl:justify-start" : "", dark ? active ? "bg-white/8 text-white" : "text-white/55 hover:bg-white/6 hover:text-white" : active ? "bg-gray-50 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900")}
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

function ThemeButton({
  dark,
  active,
  label,
  onClick,
  children
}: {
  dark: boolean;
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border transition", dark ? active ? "border-white/20 bg-white/12 text-white" : "border-white/10 bg-[#111318] text-white/70 hover:bg-white/8 hover:text-white" : active ? "border-gray-300 bg-white text-gray-900" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900")}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Card({ dark, compact, title, description, children }: { dark: boolean; compact?: boolean; title: string; description?: string; children: React.ReactNode }) {
  return (
    <article className={cn("rounded-2xl border shadow-[0_20px_55px_rgba(15,23,42,0.08)]", compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5", dark ? "border-white/10 bg-[#111318]" : "border-gray-100 bg-white")}>
      <h3 className={cn("text-[0.98rem] font-bold tracking-[-0.04em] sm:text-base", dark ? "text-white" : "text-gray-900")}>{title}</h3>
      {description ? <p className={cn("mt-1 text-[13px] leading-6", dark ? "text-white/55" : "text-gray-500")}>{description}</p> : null}
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

function RankFilterButton({
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
        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
        dark
          ? active
            ? "bg-white text-gray-900"
            : "bg-white/6 text-white/65 hover:bg-white/10 hover:text-white"
          : active
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function RankTrendChart({
  dark,
  points,
  emptyTitle,
  emptyCopy
}: {
  dark: boolean;
  points: RankTrackingDashboard["chart"]["points"];
  emptyTitle?: string;
  emptyCopy?: string;
}) {
  const width = 720;
  const height = 220;
  const padding = 24;
  const maxRank = Math.max(...(points.length ? points.map((point) => point.rankValue) : [74]), 74);
  const minRank = Math.min(...(points.length ? points.map((point) => point.rankValue) : [1]), 1);
  const ySpan = Math.max(maxRank - minRank, 1);
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const chartPoints = points.map((point, index) => {
    const x = padding + index * xStep;
    const y = padding + ((point.rankValue - minRank) / ySpan) * (height - padding * 2);
    return { ...point, x, y };
  });

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
      <svg className="h-[220px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rank trend chart">
        <line x1={padding} x2={width - padding} y1={padding} y2={padding} stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} />
        {points.length ? (
          <>
            <polyline fill="none" points={polyline} stroke="#6f5cff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {chartPoints.map((point) => (
              <g key={point.checkedAt}>
                <circle cx={point.x} cy={point.y} r="4.5" fill={point.status === "ranked" ? "#6f5cff" : "#f59e0b"} />
                <text x={point.x} y={height - 6} textAnchor="middle" fontSize="10" fill={dark ? "rgba(255,255,255,0.55)" : "rgba(71,85,105,1)"}>
                  {point.dayLabel}
                </text>
              </g>
            ))}
          </>
        ) : (
          <>
            <polyline
              fill="none"
              points={`${padding},${height - padding - 30} ${padding + 120},${height - padding - 42} ${padding + 240},${height - padding - 55} ${padding + 360},${height - padding - 48} ${padding + 480},${height - padding - 68} ${padding + 600},${height - padding - 60}`}
              stroke={dark ? "rgba(255,255,255,0.18)" : "rgba(111,92,255,0.28)"}
              strokeWidth="3"
              strokeDasharray="6 8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={width / 2} y={height / 2 - 8} textAnchor="middle" fontSize="14" fontWeight="700" fill={dark ? "rgba(255,255,255,0.82)" : "rgba(15,23,42,0.85)"}>
              {emptyTitle || "Keyword rankings chart will appear here"}
            </text>
            <text x={width / 2} y={height / 2 + 16} textAnchor="middle" fontSize="11" fill={dark ? "rgba(255,255,255,0.55)" : "rgba(71,85,105,1)"}>
              {emptyCopy || "Tracking needs more data before a live trend line can be drawn."}
            </text>
          </>
        )}
        <text x={padding} y={12} fontSize="10" fill={dark ? "rgba(255,255,255,0.55)" : "rgba(71,85,105,1)"}>#1 best</text>
        <text x={width - padding} y={12} textAnchor="end" fontSize="10" fill={dark ? "rgba(255,255,255,0.55)" : "rgba(71,85,105,1)"}>&gt;54 outside top 3 pages</text>
      </svg>
      {points.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {points.slice(-3).map((point) => (
            <div className={cn("rounded-2xl border px-3 py-2", dark ? "border-white/10 bg-[#0f1115]" : "border-gray-200 bg-white")} key={point.checkedAt}>
              <div className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", dark ? "text-white/35" : "text-gray-400")}>{point.dayLabel}</div>
              <div className={cn("mt-1 text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>{point.rankLabel}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user, setUser } = useSessionStore();
  const { accessToken, isLoading: authLoading } = useAuthGuard("/dashboard");
  const { metrics, overview, loading, error, refresh } = useDashboardData(accessToken, Boolean(accessToken));
  const extensionStatus = useExtensionStatus(accessToken, Boolean(accessToken));
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [checkoutLoading, setCheckoutLoading] = useState<"" | "monthly" | "yearly">("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [rankRange, setRankRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [rankTracking, setRankTracking] = useState<RankTrackingDashboard | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankError, setRankError] = useState("");
  const [extensionDevices, setExtensionDevices] = useState<Array<{
    id: string;
    label: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    status: "active" | "revoked" | "expired";
  }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceActionId, setDeviceActionId] = useState("");
  const [bulkRevokeBusy, setBulkRevokeBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(false);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const requestId = searchParams.get("request");
  const requestedSection = searchParams.get("section");
  const section: Section = requestedSection === "rankings" || requestedSection === "account" || requestedSection === "subscription" || requestedSection === "support" || requestedSection === "privacy" ? requestedSection : requestId ? "account" : "overview";
  const dark = theme === "dark";
  const compact = true;
  const firstName = user?.name ?? "there";
  const initials = firstName.slice(0, 2).toUpperCase() || "KN";
  const quotaAtLimit = Boolean(metrics?.keywordRuns.disabled || overview?.quota.atLimit);
  const sectionMeta = SECTION_META[section] ?? SECTION_META.overview;
  const billing = metrics?.billing;
  const planLabel = billing?.status === "active" ? "Premium" : billing?.status === "trial" ? "Premium Trial" : billing?.status === "expired" ? "Trial expired" : "Free";
  const sidebarCollapsed = true;
  const signInMethod = user?.signInMethod ?? "unknown";
  const signInMethodMeta = getSignInMethodMeta(signInMethod);
  const supabase = getSupabaseBrowserClient();

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
    if (!accessToken) {
      setRankTracking(null);
      setRankLoading(false);
      return;
    }

    let active = true;

    async function loadRankTracking() {
      setRankLoading(true);
      setRankError("");

      try {
        const result = await fetchRankTrackingDashboard(accessToken, {
          range: rankRange,
          targetId: selectedTargetId
        });

        if (!active) {
          return;
        }

        setRankTracking(result);
        if (!selectedTargetId && result.filters.selectedTargetId) {
          setSelectedTargetId(result.filters.selectedTargetId);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setRankError(error instanceof Error ? error.message : "Unable to load rank tracking.");
      } finally {
        if (active) {
          setRankLoading(false);
        }
      }
    }

    void loadRankTracking();

    return () => {
      active = false;
    };
  }, [accessToken, rankRange, selectedTargetId]);

  useEffect(() => {
    if (!accessToken) {
      setExtensionDevices([]);
      setDevicesLoading(false);
      return;
    }

    let active = true;

    async function loadExtensionDevices() {
      setDevicesLoading(true);

      try {
        const devices = await fetchExtensionDevices(accessToken);
        if (!active) {
          return;
        }
        setExtensionDevices(devices);
      } catch (error) {
        if (!active) {
          return;
        }
        showToast(error instanceof Error ? error.message : "Unable to load extension devices.");
      } finally {
        if (active) {
          setDevicesLoading(false);
        }
      }
    }

    void loadExtensionDevices();

    return () => {
      active = false;
    };
  }, [accessToken, showToast]);

  function setSection(next: Section) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("section");
    else params.set("section", next);
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  function clearConnectRequestFromUrl() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("request");
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  async function handleSignOut() {
    await signOutFromApi(accessToken || undefined).catch(() => null);
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
      setExtensionDevices(await fetchExtensionDevices(accessToken));
      clearConnectRequestFromUrl();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Unable to connect the extension.");
    } finally {
      setConnectBusy(false);
    }
  }

  async function refreshProfile() {
    if (!accessToken) {
      return;
    }

    const profile = await fetchApiProfile(accessToken);
    setUser({
      id: profile.id,
      email: profile.email,
      name: profile.name ?? profile.email?.split("@")[0] ?? "there",
      avatarUrl: profile.avatarUrl,
      signInMethod: profile.signInMethod
    });
  }

  async function updateAvatar(nextAvatarUrl: string | null) {
    if (!accessToken || !supabase) {
      showToast("Your website session is required to update this profile.");
      return;
    }

    setAvatarBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: nextAvatarUrl
        }
      });

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();
      showToast(nextAvatarUrl ? "Profile photo updated." : "Profile photo removed.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update the profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file for the profile photo.");
      return;
    }

    if (file.size > 768 * 1024) {
      showToast("Choose an image under 750 KB for the profile photo.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to read this image file."));
      reader.readAsDataURL(file);
    }).catch((error) => {
      showToast(error instanceof Error ? error.message : "Unable to prepare the profile photo.");
      return "";
    });

    if (!dataUrl) {
      return;
    }

    await updateAvatar(dataUrl);
  }

  async function handlePasswordUpdate() {
    if (!supabase) {
      showToast("Your website session is required to update the password.");
      return;
    }

    if (nextPassword.length < 8) {
      showToast("Use at least 8 characters for the new password.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      showToast("The password confirmation does not match.");
      return;
    }

    setPasswordBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: nextPassword
      });

      if (updateError) {
        throw updateError;
      }

      setNextPassword("");
      setConfirmPassword("");
      setPasswordEditorOpen(false);
      showToast("Password updated.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update the password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleRevokeExtensionDevice(sessionId: string) {
    if (!accessToken) {
      return;
    }

    setDeviceActionId(sessionId);
    try {
      await revokeExtensionDevice(accessToken, sessionId);
      setExtensionDevices(await fetchExtensionDevices(accessToken));
      showToast("Extension device revoked.");
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to revoke the selected extension device.");
    } finally {
      setDeviceActionId("");
    }
  }

  async function handleRevokeOtherExtensionDevices() {
    if (!accessToken) {
      return;
    }

    const keepSessionId = extensionDevices.find((device) => device.status === "active")?.id;
    if (!keepSessionId) {
      showToast("No active extension browser is available to keep.");
      return;
    }

    setBulkRevokeBusy(true);
    try {
      const result = await revokeOtherExtensionDevices(accessToken, keepSessionId);
      setExtensionDevices(await fetchExtensionDevices(accessToken));
      showToast(result.revokedCount > 0 ? `Revoked ${result.revokedCount} other browser session${result.revokedCount === 1 ? "" : "s"}.` : "No other active browser sessions needed to be revoked.");
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to revoke the other extension browsers.");
    } finally {
      setBulkRevokeBusy(false);
    }
  }

  function connectedBrowsersCard() {
    return (
      <Card compact={compact} dark={dark} title="Connected browsers">
        <div className="space-y-3 text-sm leading-6">
          {!devicesLoading && extensionDevices.some((device) => device.status === "active") ? <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={cn("text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>Keep the most recent browser</div>
                <div className="mt-1 text-xs">Revoke every other active browser session and leave the latest active device connected.</div>
              </div>
              <button className={cn("inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} disabled={bulkRevokeBusy} onClick={() => void handleRevokeOtherExtensionDevices()} type="button">{bulkRevokeBusy ? "Revoking..." : "Revoke all other browsers"}</button>
            </div>
          </div> : null}
          {devicesLoading ? <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")}>Loading connected browsers...</div> : null}
          {!devicesLoading && extensionDevices.length === 0 ? <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")}>No browser sessions have been approved yet. Open the popup and approve a request here to create the first device.</div> : null}
          {!devicesLoading ? extensionDevices.map((device) => {
            const badge = getBrowserBadge(device.label);

            return <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")} key={device.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", badge.tone)}>
                    {badge.icon}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>{device.label}</div>
                    <div className="mt-1 text-xs">
                      Last seen: {formatDeviceTime(device.lastSeenAt)}
                    </div>
                    <div className="mt-1 text-xs">
                      Created: {formatDeviceTime(device.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", device.status === "active" ? dark ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-100 text-emerald-700" : device.status === "revoked" ? dark ? "bg-white/10 text-white/70" : "bg-gray-200 text-gray-700" : dark ? "bg-amber-400/15 text-amber-200" : "bg-amber-100 text-amber-700")}>{device.status}</span>
                  {device.status === "active" ? <button className={cn("inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} disabled={deviceActionId === device.id} onClick={() => void handleRevokeExtensionDevice(device.id)} type="button">{deviceActionId === device.id ? "Revoking..." : "Revoke"}</button> : null}
                </div>
              </div>
            </div>;
          }) : null}
          <div className={cn("rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")}>
            Disconnecting from the popup now revokes the current browser token on the server, not just the local extension copy.
          </div>
        </div>
      </Card>
    );
  }

  function overviewView() {
    return (
      <>
        <div className={cn("mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4")}>
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
            action={extensionStatus?.status !== "active" ? <button className={cn("inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} onClick={() => setSection("account")} type="button">Connect</button> : null}
          />
        </div>

        {error ? <div className={cn("mt-4 rounded-2xl border px-4 py-3 text-sm", dark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>{error}</div> : null}

        <div className={cn("mt-4 grid gap-3 xl:grid-cols-3")}>
          <Card compact={compact} dark={dark} title="Current account"><div className={cn("text-[1.8rem] font-bold tracking-[-0.06em] break-words sm:text-[2rem]", dark ? "text-white" : "text-gray-900")}>{overview?.currentAccount.value ?? "..."}</div><p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>{overview?.currentAccount.status ?? "Loading"}</p></Card>
          <Card compact={compact} dark={dark} title="Latest query"><div className={cn("text-[1.8rem] font-bold tracking-[-0.06em] break-words sm:text-[2rem]", dark ? "text-white" : "text-gray-900")}>{overview?.latestQuery.value ?? "..."}</div><p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>{overview?.latestQuery.status === "waiting" || overview?.latestQuery.status === "processing" ? "Auto-refreshing until completed" : overview?.latestQuery.updatedAt ? new Date(overview.latestQuery.updatedAt).toLocaleString() : "No recent query"}</p></Card>
          <Card compact={compact} dark={dark} title="Next action"><div className={cn("text-[1.8rem] font-bold tracking-[-0.06em] break-words sm:text-[2rem]", dark ? "text-white" : "text-gray-900")}>{extensionStatus?.status === "active" ? overview?.nextAction.value ?? "Review runs" : "Connect"}</div><p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>{quotaAtLimit ? "Upgrade to continue analyzing" : extensionStatus?.status === "active" ? "Extension connected" : "Extension needs connection"}</p></Card>
        </div>
      </>
    );
  }

  function rankingsView() {
    return (
      <div className="mt-4 grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
        <Card compact={compact} dark={dark} title="Rank Tracking Summary" description="Daily tracking is tied to the exact product + keyword pair selected from the extension.">
          {rankLoading && !rankTracking ? <Skeleton className="h-[220px] w-full" /> : null}
          {!rankLoading && rankTracking ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Active targets", value: String(rankTracking.summary.activeTargets) },
                  { label: "Collecting baseline", value: String(rankTracking.summary.baselinePending) },
                  { label: "Improving", value: String(rankTracking.summary.improving) },
                  { label: "Declining", value: String(rankTracking.summary.declining) }
                ].map((item) => (
                  <div className={cn("rounded-[18px] border p-3", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")} key={item.label}>
                    <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/35" : "text-neutral-400")}>{item.label}</div>
                    <div className={cn("mt-2 text-[1.35rem] font-semibold tracking-[-0.05em]", dark ? "text-white" : "text-black")}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div className={cn("mt-3 rounded-[18px] border p-3.5", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
                <div className={cn("text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>Insight</div>
                <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/60" : "text-gray-600")}>{rankTracking.chart.insight}</p>
              </div>
            </>
          ) : null}
          {!rankLoading && !rankTracking && !rankError ? <div className={cn("rounded-[18px] border border-dashed px-4 py-5 text-sm", dark ? "border-white/10 bg-white/5 text-white/55" : "border-gray-200 bg-[#fafafa] text-gray-500")}>Start tracking keywords from the extension to build rank history here.</div> : null}
          {rankError ? <div className={cn("mt-4 rounded-2xl border px-4 py-3 text-sm", dark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>{rankError}</div> : null}
        </Card>

        <Card compact={compact} dark={dark} title="Keyword Rankings" description="The chart appears immediately and fills with real movement after the first 7 daily checks are collected.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "7d", label: "7 days" },
                { id: "30d", label: "30 days" },
                { id: "90d", label: "90 days" },
                { id: "all", label: "All time" }
              ].map((item) => (
                <RankFilterButton
                  active={rankRange === item.id}
                  dark={dark}
                  key={item.id}
                  label={item.label}
                  onClick={() => startTransition(() => setRankRange(item.id as "7d" | "30d" | "90d" | "all"))}
                />
              ))}
            </div>
            <select
              className={cn("min-w-[220px] rounded-xl border px-3 py-2 text-sm outline-none transition", dark ? "border-white/10 bg-[#111318] text-white" : "border-gray-200 bg-white text-gray-900")}
              onChange={(event) => startTransition(() => setSelectedTargetId(event.target.value || null))}
              value={selectedTargetId ?? ""}
            >
              <option value="">Select a tracked keyword</option>
              {(rankTracking?.filters.targets ?? []).map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className={cn("rounded-[18px] border p-3", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
              <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/35" : "text-neutral-400")}>Current keyword rank</div>
              <div className={cn("mt-2 text-sm font-semibold sm:text-base", dark ? "text-white" : "text-black")}>{rankTracking?.chart.currentRankLabel ?? "No rank data yet"}</div>
            </div>
            <div className={cn("rounded-[18px] border p-3", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
              <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/35" : "text-neutral-400")}>Best keyword rank</div>
              <div className={cn("mt-2 text-sm font-semibold sm:text-base", dark ? "text-white" : "text-black")}>{rankTracking?.chart.bestRankLabel ?? "No rank data yet"}</div>
            </div>
            <div className={cn("rounded-[18px] border p-3", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
              <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/35" : "text-neutral-400")}>Tracked keyword</div>
              <div className={cn("mt-2 text-sm font-semibold sm:text-base", dark ? "text-white" : "text-black")}>{rankTracking?.chart.keyword || "No target selected"}</div>
            </div>
          </div>

          <div className="mt-3">
            {rankLoading && !rankTracking ? <Skeleton className="h-[280px] w-full" /> : null}
            {!rankLoading && rankTracking?.chart.targetId && rankTracking.chart.baselineReady ? <RankTrendChart dark={dark} points={rankTracking.chart.points} /> : null}
            {!rankLoading && rankTracking?.chart.targetId && !rankTracking.chart.baselineReady ? (
              <RankTrendChart
                dark={dark}
                emptyCopy={`${rankTracking.chart.baselineProgress} of 7 daily checks are complete. The chart will unlock after the first baseline week is collected.`}
                emptyTitle="Collecting baseline data"
                points={[]}
              />
            ) : null}
            {!rankLoading && !rankTracking?.chart.targetId ? (
              <RankTrendChart
                dark={dark}
                emptyCopy="Start tracking a keyword from the extension, or select a tracked keyword here to view its upcoming trend line."
                emptyTitle="Keyword rankings chart will appear here"
                points={[]}
              />
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  function accountView() {
    const accountValue = overview?.currentAccount.value ?? user?.email ?? "Loading...";

    return (
      <div className={cn("mt-5 grid gap-3.5", compact ? "xl:grid-cols-[1.05fr_0.95fr]" : "xl:grid-cols-[1.05fr_0.95fr] 2xl:gap-4")}>
        <div className="space-y-3.5">
          <Card compact={compact} dark={dark} title="Account profile" description="Identity, session, and extension access stay visible together in one place.">
            <div className="flex items-center gap-4">
              <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-semibold", dark ? "bg-white/8 text-white" : "bg-gray-100 text-black")}>
                {user?.avatarUrl ? <img alt="Profile avatar" className="h-full w-full object-cover" src={user.avatarUrl} /> : initials}
              </div>
              <div>
                <div className={cn("text-lg font-semibold tracking-[-0.04em] break-words sm:text-xl", dark ? "text-white" : "text-black")}>{accountValue}</div>
                <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-sm", dark ? "text-white/55" : "text-gray-500")}>
                  <span>{planLabel} plan</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", signInMethodMeta.tone)}>
                    {signInMethodMeta.icon}
                    {signInMethodMeta.label}
                  </span>
                </div>
              </div>
            </div>
            <div className={cn("mt-4 rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={cn("text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>Profile photo</div>
                  <div className={cn("mt-1 text-sm leading-6", dark ? "text-white/55" : "text-neutral-500")}>Update the avatar used across your website account.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input accept="image/*" className="hidden" onChange={(event) => void handleAvatarSelection(event)} ref={avatarInputRef} type="file" />
                  <button className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()} type="button">
                    <Upload size={16} />
                    {avatarBusy ? "Updating..." : "Change avatar"}
                  </button>
                  {user?.avatarUrl ? <button className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} disabled={avatarBusy} onClick={() => void updateAvatar(null)} type="button">
                    <Trash2 size={16} />
                    Remove
                  </button> : null}
                </div>
              </div>
            </div>
            <div className={cn("mt-3 rounded-[20px] border p-4", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={cn("flex items-center gap-2 text-sm font-semibold", dark ? "text-white" : "text-gray-900")}>
                    <KeyRound size={16} />
                    Password
                  </div>
                </div>
                {signInMethod === "email" ? <button
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold transition",
                    dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black"
                  )}
                  onClick={() => setPasswordEditorOpen((current) => !current)}
                  type="button"
                >
                  {passwordEditorOpen ? "Close" : "Update"}
                </button> : null}
              </div>
                {signInMethod === "email" ? <>
                <div className={cn("mt-3 flex items-center justify-between gap-4 rounded-2xl border px-4 py-3", dark ? "border-white/10 bg-[#111318]" : "border-black/8 bg-white")}>
                  <div className={cn("text-lg tracking-[0.16em]", dark ? "text-white" : "text-gray-900")}>••••••••••</div>
                </div>
                {passwordEditorOpen ? <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input className={cn("h-11 rounded-2xl border px-4 text-sm outline-none transition", dark ? "border-white/10 bg-[#111318] text-white placeholder:text-white/30 focus:border-white/20" : "border-black/10 bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-300")} onChange={(event) => setNextPassword(event.target.value)} placeholder="New password" type="password" value={nextPassword} />
                  <input className={cn("h-11 rounded-2xl border px-4 text-sm outline-none transition", dark ? "border-white/10 bg-[#111318] text-white placeholder:text-white/30 focus:border-white/20" : "border-black/10 bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-300")} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" type="password" value={confirmPassword} />
                  <button className={cn("inline-flex h-11 min-w-[148px] items-center justify-center whitespace-nowrap rounded-2xl px-5 text-sm font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} disabled={passwordBusy} onClick={() => void handlePasswordUpdate()} type="button">{passwordBusy ? "Saving..." : "Save"}</button>
                </div> : null}
              </> : <div className={cn("mt-2 text-sm leading-6", dark ? "text-white/55" : "text-neutral-500")}>{`Password changes are managed through ${signInMethodMeta.label}.`}</div>}
            </div>
          </Card>
          <div className="flex">
            <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition", dark ? "bg-red-500/15 text-red-200 hover:bg-red-500/20" : "bg-red-50 text-red-700 hover:bg-red-100")} onClick={handleSignOut} type="button">Log out</button>
          </div>
        </div>
        {connectedBrowsersCard()}
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

  function textPanel(items: string[]) {
    return <div className="mt-5"><Card compact={compact} dark={dark} title="Summary"><div className="space-y-3 text-sm leading-6">{items.map((item) => <div className={cn("rounded-[18px] border p-3.5", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-neutral-600")} key={item}>{item}</div>)}</div></Card></div>;
  }

  return (
    <main className={cn("min-h-screen transition-colors", dark ? "bg-[#0e1014] text-white" : "app-shell text-gray-900")}>
      <div className={cn("grid min-h-screen lg:grid-cols-[92px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)]", dark ? "bg-[#0e1014]" : "bg-transparent")}>
        <aside className={cn("px-4 pt-0 2xl:px-5", dark ? "border-r border-white/10 bg-[#0f1116]" : "border-r border-[#e7e1d5] bg-[#fbf7ef]/88")}>
          <div className={cn("flex min-h-[88px] items-center border-b", dark ? "border-white/10" : "border-[#e7e1d5]")}>
            <div className="flex w-full justify-center 2xl:hidden">
              <BrandLockup compact dark={dark} href="/" iconOnly subtitle="" />
            </div>
            <div className="hidden 2xl:flex">
              <BrandLockup compact dark={dark} href="/" subtitle="Seller insight layer for TPT" />
            </div>
          </div>
          <div className="pt-2 2xl:pt-3"><p className={cn("hidden px-3 text-[11px] font-semibold uppercase tracking-[0.16em] 2xl:block", dark ? "text-white/30" : "text-[#8b7f70]")}>Workspace</p><nav className="mt-3 space-y-1"><SidebarItem active={section === "overview"} dark={dark} icon={<LayoutGrid size={16} />} iconOnly={sidebarCollapsed} label="Dashboard" onClick={() => setSection("overview")} /><SidebarItem active={section === "rankings"} dark={dark} icon={<Sparkles size={16} />} iconOnly={sidebarCollapsed} label="Keyword Rankings" onClick={() => setSection("rankings")} /><SidebarItem active={section === "account"} dark={dark} icon={<UserRound size={16} />} iconOnly={sidebarCollapsed} label="Account" onClick={() => setSection("account")} /><SidebarItem active={section === "subscription"} dark={dark} icon={<CreditCard size={16} />} iconOnly={sidebarCollapsed} label="Subscription" onClick={() => setSection("subscription")} /></nav></div>
          <div className={cn("mt-5 border-t pt-4 2xl:mt-6 2xl:pt-5", dark ? "border-white/8" : "border-[#e7e1d5]")}><p className={cn("hidden px-3 text-[11px] font-semibold uppercase tracking-[0.16em] 2xl:block", dark ? "text-white/30" : "text-[#8b7f70]")}>More</p><div className="mt-3 space-y-1"><SidebarItem active={section === "support"} dark={dark} icon={<LifeBuoy size={16} />} iconOnly={sidebarCollapsed} label="Support" onClick={() => setSection("support")} /><SidebarItem active={section === "privacy"} dark={dark} icon={<Shield size={16} />} iconOnly={sidebarCollapsed} label="Privacy" onClick={() => setSection("privacy")} /></div></div>
        </aside>

        <section className="min-w-0">
          <header className={cn("flex min-h-[88px] items-center border-b px-5 py-3 sm:px-6", dark ? "border-white/10 bg-[#0f1116]" : "border-[#e7e1d5] bg-[#fbf7ef]/72")}>
            <div className="flex w-full items-center justify-between gap-4">
              <div><h1 className={cn("text-[1.65rem] font-extrabold tracking-[-0.08em]", dark ? "text-white" : "text-gray-900")}>{sectionMeta.title}</h1><p className={cn("mt-0.5 text-[13px]", dark ? "text-white/55" : "text-gray-500")}>{section === "overview" ? `Welcome back, ${authLoading ? "..." : firstName}.` : sectionMeta.description}</p></div>
              <div className="flex items-center gap-2">
                <ThemeButton active={theme === "light"} dark={dark} label="Light mode" onClick={() => setTheme("light")}><Sun size={17} /></ThemeButton>
                <ThemeButton active={theme === "dark"} dark={dark} label="Dark mode" onClick={() => setTheme("dark")}><Moon size={17} /></ThemeButton>
                <TopButton dark={dark} label="Notifications" onClick={() => showToast(overview?.recentRuns[0] ? `Latest run: ${overview.recentRuns[0].query}` : "No new dashboard notifications.")}><Bell size={17} /></TopButton>
                <button className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 transition", dark ? "border-white/10 bg-[#111318] hover:bg-white/6" : "border-gray-200 bg-white hover:bg-gray-50")} onClick={() => setSection("account")} type="button"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef2ff] text-xs font-semibold text-[#6f5cff]">{initials}</span><span className={cn("text-sm font-medium", dark ? "text-white" : "text-gray-900")}>{authLoading ? "Loading" : firstName}</span></button>
              </div>
            </div>
          </header>

          <div className={cn("px-5 py-4 sm:px-6", dark ? "bg-[#0e1014]" : "bg-transparent")}>
            <div className={cn("mb-3 text-[13px]", dark ? "text-white/40" : "text-gray-500")}>{section === "overview" ? "Home / Dashboard" : `Home / Dashboard / ${sectionMeta.title}`}</div>

            {section === "overview" ? overviewView() : null}
            {section === "rankings" ? rankingsView() : null}
            {section === "account" ? accountView() : null}
            {section === "subscription" ? subscriptionView() : null}
            {section === "support" ? textPanel([
              "Auth issues: if sign-in loops or callback problems happen, clear the current session and sign in again from the website.",
              "Extension issues: open the popup, choose Connect account, then approve the request from the account popup on the website.",
              "Billing issues: if plan state looks wrong, refresh the workspace and retry the Premium upgrade flow.",
              "Quota issues: if keyword runs hit the limit, the workspace should steer the user toward Premium."
            ]) : null}
            {section === "privacy" ? textPanel([
              "Supabase handles website identity and authentication.",
              "Cloudflare Workers and D1 handle product logic, extension sessions, and workspace data.",
              "Paddle handles checkout, tax, and invoice processing for paid plans.",
              "The extension receives an approval-based session instead of direct website credentials."
            ]) : null}
          </div>

          {requestId ? (
            <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-[rgba(15,23,42,0.16)] px-4 pt-24">
              <div className={cn("pointer-events-auto w-full max-w-[430px] rounded-[28px] border p-5 shadow-[0_32px_90px_rgba(15,23,42,0.18)] sm:p-6", dark ? "border-white/10 bg-[#111318]" : "border-[#e7e1d5] bg-[#fffdf9]")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={cn("text-[0.78rem] font-semibold uppercase tracking-[0.18em]", dark ? "text-white/35" : "text-[#8b7f70]")}>Account connection</div>
                    <h2 className={cn("mt-2 text-[1.55rem] font-bold tracking-[-0.06em]", dark ? "text-white" : "text-gray-900")}>Approve this browser</h2>
                    <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/60" : "text-gray-600")}>Confirm this browser connection to finish linking the extension to your Knowlense account.</p>
                  </div>
                  <button className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full border text-xl leading-none transition", dark ? "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white" : "border-black/10 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900")} onClick={clearConnectRequestFromUrl} type="button">
                    ×
                  </button>
                </div>
                <div className={cn("mt-5 rounded-[22px] border px-4 py-3 text-sm", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-gray-600")}>
                  {connectBusy ? "Finishing your browser connection..." : "A request from the extension is waiting for your approval."}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-black")} disabled={!requestId || connectBusy} onClick={() => void handleConnect()} type="button">{connectBusy ? "Connecting..." : "Approve extension"}</button>
                  <button className={cn("inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")} onClick={clearConnectRequestFromUrl} type="button">
                    Not now
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
