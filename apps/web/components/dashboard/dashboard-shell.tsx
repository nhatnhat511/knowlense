"use client";

import Link from "next/link";
import { ExternalLink, Globe, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const domains = ["wikipedia.org", "developer.chrome.com", "supabase.com"];

export function DashboardShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Card className="bg-white">
        <CardContent className="p-8 text-sm text-muted-foreground">Loading dashboard...</CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Login required</CardTitle>
          <CardDescription>Authenticate with Supabase to unlock the user dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/auth">Go to login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fullName = user.user_metadata?.full_name || user.email || "Knowlense user";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="bg-white">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Welcome back, {fullName}</CardTitle>
              <CardDescription>Manage extension access, preferred sources, and your current SaaS plan.</CardDescription>
            </div>
            <Badge>Free plan</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Plan" value="Free" helper="Upgradeable to premium" />
            <MetricCard label="Monthly summaries" value="128" helper="of 500 used" />
            <MetricCard label="Extension status" value="Active" helper="Synced with account" />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Whitelisted domains</h3>
            <div className="flex flex-wrap gap-3">
              {domains.map((domain) => (
                <div key={domain} className="rounded-full border border-border bg-muted/60 px-4 py-2 text-sm">
                  {domain}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Source configuration</CardTitle>
            <CardDescription>Suggested default sources for the extension experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <SettingRow icon={Globe} title="Wikipedia" description="Enabled as the default summary source." />
            <SettingRow icon={ShieldCheck} title="Trusted domains" description="Restrict the floating box to approved domains." />
            <SettingRow icon={Sparkles} title="Premium sources" description="Reserve advanced providers for paid users." />
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Next integration step</CardTitle>
            <CardDescription>Connect billing and user_settings from Supabase to make the dashboard live.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/pricing">
                Review pricing setup
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-border bg-muted/30 p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{helper}</div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 rounded-3xl border border-border bg-muted/30 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
