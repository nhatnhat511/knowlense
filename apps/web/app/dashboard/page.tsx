"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const API_BASE_URL = "https://api.knowlense.com";

type DashboardState = {
  email: string;
  plan: string;
  expiresAt: string | null;
};

type UserSettingsState = {
  blacklist: string[];
  whitelist: string[];
  preferredLanguage: string;
};

export default function DashboardPage() {
  const { user, session, loading, configured } = useAuth();
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    email: "",
    plan: "free",
    expiresAt: null
  });
  const [settings, setSettings] = useState<UserSettingsState>({
    blacklist: [],
    whitelist: [],
    preferredLanguage: "en-US"
  });
  const [blacklistInput, setBlacklistInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const formattedExpiry = useMemo(() => {
    if (!dashboardState.expiresAt) {
      return "No renewal date available";
    }

    return new Date(dashboardState.expiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }, [dashboardState.expiresAt]);

  useEffect(() => {
    if (!session?.access_token || !user) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        const supabase = getSupabaseBrowserClient();

        const [profileResult, settingsResult, subscriptionResponse] = await Promise.all([
          supabase
            ?.from("profiles")
            .select("email, subscription_plan")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            ?.from("user_settings")
            .select("blacklist, whitelist, preferred_language")
            .eq("user_id", user.id)
            .maybeSingle(),
          fetch(`${API_BASE_URL}/api/subscription/status`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              Accept: "application/json"
            }
          })
        ]);

        const subscriptionPayload = await subscriptionResponse.json().catch(() => ({}));

        if (cancelled) {
          return;
        }

        setDashboardState({
          email: profileResult?.data?.email || user.email || "",
          plan: profileResult?.data?.subscription_plan || "free",
          expiresAt: subscriptionPayload?.subscription?.currentPeriodEnd || subscriptionPayload?.subscription?.trialEndsAt || null
        });

        setSettings({
          blacklist: Array.isArray(settingsResult?.data?.blacklist) ? settingsResult.data.blacklist : [],
          whitelist: Array.isArray(settingsResult?.data?.whitelist) ? settingsResult.data.whitelist : [],
          preferredLanguage: settingsResult?.data?.preferred_language || "en-US"
        });
      } catch (error) {
        if (!cancelled) {
          setStatusMessage("Unable to load your dashboard data right now.");
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  function addBlacklistDomain() {
    const normalized = blacklistInput.trim().toLowerCase();

    if (!normalized) {
      return;
    }

    setSettings((current) => {
      if (current.blacklist.includes(normalized)) {
        return current;
      }

      return {
        ...current,
        blacklist: [...current.blacklist, normalized]
      };
    });
    setBlacklistInput("");
  }

  function removeBlacklistDomain(domain: string) {
    setSettings((current) => ({
      ...current,
      blacklist: current.blacklist.filter((item) => item !== domain)
    }));
  }

  async function handleSaveSettings() {
    if (!session?.access_token) {
      setStatusMessage("Please sign in again to update your settings.");
      return;
    }

    setSavingSettings(true);
    setStatusMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          whitelist: settings.whitelist,
          blacklist: settings.blacklist,
          preferredLanguage: settings.preferredLanguage
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save settings.");
      }

      setStatusMessage("Settings saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleManageSubscription() {
    if (!session?.access_token) {
      setStatusMessage("Please sign in again to manage your subscription.");
      return;
    }

    setStartingCheckout(true);
    setStatusMessage("");

    try {
      const preferredPlan = dashboardState.plan === "yearly" ? "yearly" : "monthly";
      const response = await fetch(`${API_BASE_URL}/api/subscription/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          plan: preferredPlan
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to open Paddle checkout.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to open Paddle checkout.");
    } finally {
      setStartingCheckout(false);
    }
  }

  if (loading) {
    return (
      <main className="container py-16">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </main>
    );
  }

  if (!configured || !user || !session) {
    return (
      <main className="container py-16">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Dashboard unavailable</CardTitle>
            <CardDescription>Sign in with Knowlense to manage your plan and extension settings.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="container py-16">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Dashboard</p>
        <h1 className="text-4xl font-semibold tracking-tight">Manage your Knowlense workspace.</h1>
        <p className="max-w-3xl text-muted-foreground">
          Review your subscription, launch Paddle checkout, and control which domains should stay out of automatic highlighting.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Current SaaS account status pulled from Supabase and the API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-border/70 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{dashboardState.email || user.email}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current plan</p>
                <div className="mt-2">
                  <Badge>{dashboardState.plan}</Badge>
                </div>
              </div>
              <div className="rounded-3xl border border-border/70 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Renewal date</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formattedExpiry}</p>
              </div>
            </div>

            <Button onClick={handleManageSubscription} disabled={startingCheckout}>
              {startingCheckout ? "Opening checkout..." : "Manage Subscription"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Blacklist domains where automatic highlighting should stay disabled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={blacklistInput}
                onChange={(event) => setBlacklistInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addBlacklistDomain();
                  }
                }}
                placeholder="example.com"
              />
              <Button type="button" variant="outline" onClick={addBlacklistDomain}>
                Add
              </Button>
            </div>

            <div className="flex min-h-24 flex-wrap gap-2 rounded-3xl border border-dashed border-border/80 bg-slate-50 p-4">
              {settings.blacklist.length ? (
                settings.blacklist.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => removeBlacklistDomain(domain)}
                    className="rounded-full border border-border bg-white px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    {domain} ×
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No domains blocked yet.</p>
              )}
            </div>

            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save Settings"}
            </Button>

            {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
