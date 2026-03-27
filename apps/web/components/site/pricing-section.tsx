"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCheckout, type BillingInterval } from "@/lib/api/billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Cycle = "monthly" | "yearly";

type PricingPlan = {
  name: string;
  description: string;
  badge?: string;
  featured?: boolean;
  cta: string;
  href?: string;
  contact?: boolean;
  features: string[];
  price: {
    monthly: string;
    yearly: string;
  };
  interval?: BillingInterval;
  note: {
    monthly: string;
    yearly: string;
  };
};

const pricingPlans: PricingPlan[] = [
  {
    name: "Free",
    description: "A low-friction starting point for validating the Knowlense workflow.",
    cta: "Start free",
    href: "/auth/sign-up",
    features: [
      "Website account access",
      "Extension connection setup",
      "Basic dashboard access",
      "Limited Keyword Finder history"
    ],
    price: {
      monthly: "$0",
      yearly: "$0"
    },
    note: {
      monthly: "No card required",
      yearly: "No card required"
    }
  },
  {
    name: "Pro",
    description: "The main plan for recurring TPT research and a stable website-to-extension workflow.",
    badge: "Recommended",
    featured: true,
    cta: "Choose Pro",
    features: [
      "Full Keyword Finder usage",
      "Priority extension workflow",
      "Website account and billing support",
      "Built for active seller research"
    ],
    price: {
      monthly: "$4.99",
      yearly: "$41.9"
    },
    interval: "monthly",
    note: {
      monthly: "Billed monthly",
      yearly: "Billed yearly, save 20%"
    }
  },
  {
    name: "Enterprise",
    description: "For larger teams that want custom onboarding, support, and rollout planning.",
    cta: "Contact sales",
    href: "/contact",
    contact: true,
    features: [
      "Team onboarding support",
      "Workflow consultation",
      "Priority account handling",
      "Custom rollout discussions"
    ],
    price: {
      monthly: "Custom",
      yearly: "Custom"
    },
    note: {
      monthly: "Talk to us about your setup",
      yearly: "Talk to us about annual rollout"
    }
  }
];

export function PricingSection() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [billingCycle, setBillingCycle] = useState<Cycle>("monthly");
  const [accessToken, setAccessToken] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<BillingInterval | "">("");
  const [status, setStatus] = useState("");

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

      setAccessToken(session?.access_token ?? "");
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? "");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleCheckout(interval: BillingInterval) {
    if (!accessToken) {
      router.push("/auth/sign-in?next=/pricing");
      return;
    }

    setLoadingPlan(interval);
    setStatus("");

    try {
      const checkout = await createCheckout(accessToken, interval);
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start Paddle checkout.");
    } finally {
      setLoadingPlan("");
    }
  }

  return (
    <section className="space-y-10">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Pricing</div>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-black sm:text-5xl">Straightforward pricing for a focused workflow.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-7 text-neutral-600">
          Choose the plan that matches your stage. Keep the website account flow simple, then upgrade when you need recurring research and extension usage.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="rounded-full border border-black/8 bg-neutral-100 p-1.5">
          <div className="flex items-center gap-1">
            <button
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
                billingCycle === "monthly" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black"
              }`}
              onClick={() => setBillingCycle("monthly")}
              type="button"
            >
              Monthly
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition ${
                billingCycle === "yearly" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black"
              }`}
              onClick={() => setBillingCycle("yearly")}
              type="button"
            >
              Yearly
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  billingCycle === "yearly" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                }`}
              >
                -20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {status ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{status}</div> : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:overflow-visible md:px-0">
        <div className="flex snap-x snap-mandatory gap-5 md:grid md:grid-cols-3 md:gap-6">
          {pricingPlans.map((plan, index) => {
            const effectiveInterval: BillingInterval | undefined =
              plan.interval && billingCycle === "yearly" ? "yearly" : plan.interval;
            const isFeatured = index === 1 || plan.featured;
            const price = plan.price[billingCycle];
            const note = plan.note[billingCycle];

            return (
              <article
                className={`min-w-[285px] snap-center rounded-[30px] border p-8 md:min-w-0 ${
                  isFeatured
                    ? "border-black bg-[#111111] text-white shadow-[0_28px_70px_rgba(0,0,0,0.18)] md:scale-[1.05]"
                    : "border-black/10 bg-[#171717] text-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
                }`}
                key={plan.name}
              >
                <div className="flex min-h-[32px] items-center justify-between gap-3">
                  <span className={`text-sm font-semibold uppercase tracking-[0.16em] ${isFeatured ? "text-white/65" : "text-white/60"}`}>{plan.name}</span>
                  {isFeatured ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">{plan.badge ?? "Recommended"}</span>
                  ) : null}
                </div>

                <p className={`mt-4 text-base leading-7 ${isFeatured ? "text-white/72" : "text-white/68"}`}>{plan.description}</p>

                <div className="mt-8">
                  <div className="flex items-end gap-2">
                    <div className="text-5xl font-semibold tracking-[-0.07em] text-white">{price}</div>
                    <div className="pb-1 text-lg text-white/70">{plan.name === "Free" || plan.name === "Enterprise" ? "" : billingCycle === "monthly" ? "per month" : "per year"}</div>
                  </div>
                  <div className="mt-2 text-sm text-white/55">{note}</div>
                </div>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li className="flex items-start gap-3 text-[15px] leading-7 text-white/82" key={feature}>
                      <span className="mt-2 text-emerald-400">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {effectiveInterval ? (
                    <button
                      className={`inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition-all duration-200 ${
                        isFeatured
                          ? "bg-white text-black shadow-[0_14px_30px_rgba(255,255,255,0.12)] hover:-translate-y-0.5 hover:bg-neutral-100"
                          : "bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/16"
                      }`}
                      disabled={loadingPlan === effectiveInterval}
                      onClick={() => handleCheckout(effectiveInterval)}
                      type="button"
                    >
                      {loadingPlan === effectiveInterval ? "Redirecting..." : plan.cta}
                    </button>
                  ) : plan.href ? (
                    <Link
                      className={`inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition-all duration-200 ${
                        plan.contact
                          ? "bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/16"
                          : "bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/16"
                      }`}
                      href={plan.href}
                    >
                      {plan.cta}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
