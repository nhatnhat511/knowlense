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
    badge: "Khuyên dùng",
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
    <section className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Pricing</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Flexible billing for every stage of the workflow.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Switch between monthly and yearly billing. Yearly keeps the same product access while lowering the effective cost.
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 p-1">
          <div className="flex items-center gap-1">
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === "monthly" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setBillingCycle("monthly")}
              type="button"
            >
              Hàng tháng
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === "yearly" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setBillingCycle("yearly")}
              type="button"
            >
              Hàng năm
              {billingCycle === "yearly" ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">-20%</span>
              ) : null}
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
                className={`min-w-[285px] snap-center rounded-[28px] border bg-white p-7 shadow-[0_18px_44px_rgba(15,23,42,0.06)] md:min-w-0 ${
                  isFeatured
                    ? "border-blue-600 shadow-[0_24px_55px_rgba(37,99,235,0.18)] md:scale-[1.05]"
                    : "border-slate-200"
                }`}
                key={plan.name}
              >
                <div className="flex min-h-[32px] items-center justify-between gap-3">
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{plan.name}</span>
                  {isFeatured ? (
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">{plan.badge ?? "Khuyên dùng"}</span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>

                <div className="mt-8">
                  <div className="text-5xl font-semibold tracking-[-0.06em] text-slate-950">{price}</div>
                  <div className="mt-2 text-sm text-slate-500">{note}</div>
                </div>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li className="flex items-start gap-3 text-sm leading-6 text-slate-700" key={feature}>
                      <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {effectiveInterval ? (
                    <button
                      className={`inline-flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold transition-all duration-200 ${
                        isFeatured
                          ? "bg-blue-600 text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] hover:-translate-y-0.5 hover:bg-blue-700"
                          : "bg-slate-900 text-white hover:-translate-y-0.5 hover:bg-slate-800"
                      }`}
                      disabled={loadingPlan === effectiveInterval}
                      onClick={() => handleCheckout(effectiveInterval)}
                      type="button"
                    >
                      {loadingPlan === effectiveInterval ? "Redirecting..." : plan.cta}
                    </button>
                  ) : plan.href ? (
                    <Link
                      className={`inline-flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold transition-all duration-200 ${
                        plan.contact
                          ? "border border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                          : "border border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
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
