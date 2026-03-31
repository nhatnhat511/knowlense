"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCheckout, type BillingInterval } from "@/lib/api/billing";
import { fetchDashboardMetrics, type DashboardMetrics } from "@/lib/api/dashboard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PricingSectionProps = {
  embedded?: boolean;
  dark?: boolean;
  hideCompare?: boolean;
};

type PlanCard = {
  key: "free" | "monthly" | "yearly";
  name: string;
  price: string;
  cadence: string;
  description: string;
  note: string;
  features: string[];
  popular?: boolean;
};

const planCards: PlanCard[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "A clear starting point for testing the Knowlense workflow before paying.",
    note: "Best for getting familiar with the extension.",
    features: [
      "Keyword SEO audit for 1 keyword at a time",
      "Full Search Indexing checks",
      "SEO Health access with 10 runs in 24 hours"
    ]
  },
  {
    key: "monthly",
    name: "Premium Monthly",
    price: "$4.99",
    cadence: "/month",
    description: "Unlock the full extension workflow with tracking and recurring research.",
    note: "Billed monthly",
    popular: true,
    features: [
      "Keyword SEO for up to 3 keywords at a time",
      "Keyword rank tracking and dashboard history",
      "Unlimited SEO Health runs",
      "Full Search Indexing and Premium workspace access"
    ]
  },
  {
    key: "yearly",
    name: "Premium Yearly",
    price: "$41.90",
    cadence: "/year",
    description: "The same Premium access with a lower annual cost for steady TPT research.",
    note: "Save 30% with annual billing",
    features: [
      "Everything in Premium Monthly",
      "Lower effective monthly cost",
      "Best fit for long-term keyword tracking",
      "Annual billing for a simpler renewal cycle"
    ]
  }
];

const compareRows = [
  {
    feature: "Keyword SEO audit",
    free: "1 keyword at a time",
    monthly: "Up to 3 keywords",
    yearly: "Up to 3 keywords"
  },
  {
    feature: "SEO Health",
    free: "10 runs in 24 hours",
    monthly: "Unlimited",
    yearly: "Unlimited"
  },
  {
    feature: "Search Indexing",
    free: "Included",
    monthly: "Included",
    yearly: "Included"
  },
  {
    feature: "Track this keyword",
    free: "—",
    monthly: "Included",
    yearly: "Included"
  },
  {
    feature: "Keyword rankings dashboard",
    free: "—",
    monthly: "Included",
    yearly: "Included"
  }
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PricingSection({ embedded = false, dark = false, hideCompare = false }: PricingSectionProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [accessToken, setAccessToken] = useState("");
  const [billing, setBilling] = useState<DashboardMetrics["billing"] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<BillingInterval | "">("");
  const [status, setStatus] = useState("");

  const activePremiumPlanKey =
    billing?.status === "active"
      ? billing.planName.toLowerCase().includes("year")
        ? "yearly"
        : billing.planName.toLowerCase().includes("month")
          ? "monthly"
          : null
      : null;

  useEffect(() => {
    if (!supabase) {
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

      const nextToken = session?.access_token ?? "";
      setAccessToken(nextToken);

      if (!nextToken) {
        setBilling(null);
        return;
      }

      try {
        const metrics = await fetchDashboardMetrics(nextToken);
        if (active) {
          setBilling(metrics.billing);
        }
      } catch {
        if (active) {
          setBilling(null);
        }
      }
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      const nextToken = session?.access_token ?? "";
      setAccessToken(nextToken);
      if (!nextToken) {
        setBilling(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleCheckout(interval: BillingInterval) {
    if (!accessToken) {
      router.push(embedded ? "/auth/sign-in?next=/dashboard?section=subscription" : "/auth/sign-in?next=/pricing");
      return;
    }

    setLoadingPlan(interval);
    setStatus("");

    try {
      const checkout = await createCheckout(accessToken, interval);
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      setLoadingPlan("");
    }
  }

  function planAction(plan: PlanCard) {
    const isFreeCurrent = plan.key === "free" && billing?.status !== "active";
    const isPremiumCurrent =
      plan.key !== "free" &&
      billing?.status === "active" &&
      (activePremiumPlanKey ? plan.key === activePremiumPlanKey : false);

    if (isFreeCurrent) {
      return (
        <div
          className={cn(
            "inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold",
            dark ? "border border-white/10 bg-white/8 text-white" : "border border-black/10 bg-[#faf6ee] text-gray-900"
          )}
        >
          Current plan
        </div>
      );
    }

    if (isPremiumCurrent) {
      return (
        <div
          className={cn(
            "inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold",
            dark ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          Current plan
        </div>
      );
    }

    if (plan.key === "free") {
      return (
        <Link
          className={cn(
            "inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition",
            dark ? "border border-white/10 bg-white/5 text-white hover:bg-white/10" : "border border-black/10 bg-white text-gray-900 hover:bg-neutral-50"
          )}
          href="/auth/sign-up"
        >
          Start free
        </Link>
      );
    }

    const interval = plan.key === "yearly" ? "yearly" : "monthly";

    return (
      <button
        className={cn(
          "inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition",
          plan.popular
            ? "bg-gray-900 text-white hover:bg-black"
            : dark
              ? "border border-white/10 bg-white text-gray-900 hover:bg-gray-100"
              : "border border-black/10 bg-[#fff4df] text-gray-900 hover:bg-[#ffe9c6]"
        )}
        disabled={loadingPlan === interval}
        onClick={() => void handleCheckout(interval)}
        type="button"
      >
        {loadingPlan === interval ? "Preparing..." : plan.key === "yearly" ? "Choose yearly" : "Upgrade to Premium"}
      </button>
    );
  }

  return (
    <section className={cn("space-y-8", embedded ? "" : "py-2")}>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className={cn(embedded ? "text-[1.8rem] sm:text-[2rem]" : "text-[2rem] sm:text-[2.3rem]", "font-semibold tracking-[-0.06em]", dark ? "text-white" : "text-black")}>
          Simple pricing for a focused TPT SEO workflow.
        </h2>
        <p className={cn("mx-auto mt-3 max-w-2xl text-[15px] leading-7", dark ? "text-white/60" : "text-neutral-600")}>
          Start with the free workflow, then upgrade when you want keyword tracking, broader audits, and uninterrupted research inside the extension.
        </p>
      </div>

      {status ? (
        <div className={cn("rounded-2xl border px-4 py-3 text-sm", dark ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>
          {status}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {planCards.map((plan) => (
          <article
            className={cn(
              "rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]",
              dark
                ? plan.popular
                  ? "border-white/10 bg-[linear-gradient(180deg,#161a22_0%,#12151c_100%)]"
                  : "border-white/10 bg-[#111318]"
                : plan.popular
                  ? "border-[#f0d9ab] bg-[linear-gradient(180deg,#fff9ee_0%,#fff4df_100%)]"
                  : "border-[#ebe3d6] bg-white"
            )}
            key={plan.key}
          >
            <div className="flex min-h-[26px] items-center justify-between gap-3">
              <span className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", dark ? "text-white/40" : "text-[#8b7f70]")}>{plan.name}</span>
              {plan.popular ? (
                <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", dark ? "bg-white text-gray-900" : "bg-gray-900 text-white")}>Popular</span>
              ) : null}
            </div>
            <p className={cn("mt-3 text-sm leading-6", dark ? "text-white/65" : "text-neutral-600")}>{plan.description}</p>
            <div className="mt-6 flex items-end gap-2">
              <div className={cn("text-[2rem] font-semibold tracking-[-0.06em]", dark ? "text-white" : "text-black")}>{plan.price}</div>
              <div className={cn("pb-1 text-sm", dark ? "text-white/50" : "text-neutral-500")}>{plan.cadence}</div>
            </div>
            <div className={cn("mt-1 text-sm", dark ? "text-white/50" : "text-neutral-500")}>{plan.note}</div>
            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <div className="flex items-start gap-2.5" key={feature}>
                  <CheckCircle2 className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", dark ? "text-emerald-300" : "text-emerald-600")} />
                  <span className={cn("text-sm leading-6", dark ? "text-white/72" : "text-neutral-700")}>{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-7">{planAction(plan)}</div>
          </article>
        ))}
      </div>

      {hideCompare ? null : (
        <div className={cn("rounded-[28px] border p-5 sm:p-6", dark ? "border-white/10 bg-[#111318]" : "border-[#ebe3d6] bg-white")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className={cn("text-xs font-semibold uppercase tracking-[0.18em]", dark ? "text-white/40" : "text-[#8b7f70]")}>Compare plans</div>
              <h3 className={cn("mt-2 text-[1.25rem] font-semibold tracking-[-0.05em]", dark ? "text-white" : "text-black")}>See what changes as you upgrade.</h3>
            </div>
            <div className={cn("text-sm", dark ? "text-white/50" : "text-neutral-500")}>Free gives access. Premium unlocks tracking and scale.</div>
          </div>
          <div className="mt-5 overflow-hidden rounded-[22px] border">
            <div className={cn("grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] text-sm font-semibold", dark ? "border-white/10 bg-white/5 text-white" : "border-black/8 bg-[#faf6ee] text-gray-900")}>
              <div className="px-4 py-3">Feature</div>
              <div className="px-4 py-3">Free</div>
              <div className="px-4 py-3">Monthly</div>
              <div className="px-4 py-3">Yearly</div>
            </div>
            {compareRows.map((row, index) => (
              <div
                className={cn(
                  "grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] border-t text-sm",
                  dark ? "border-white/10 bg-[#111318] text-white/72" : "border-black/8 bg-white text-neutral-700",
                  index % 2 === 1 && (dark ? "bg-white/[0.03]" : "bg-[#fcfaf6]")
                )}
                key={row.feature}
              >
                <div className={cn("flex items-center gap-2 px-4 py-3 font-medium", dark ? "text-white" : "text-gray-900")}>
                  <CheckCircle2 className={cn("h-4 w-4 shrink-0", dark ? "text-emerald-300" : "text-emerald-600")} />
                  {row.feature}
                </div>
                <div className="px-4 py-3">{row.free}</div>
                <div className="px-4 py-3">{row.monthly}</div>
                <div className="px-4 py-3">{row.yearly}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
