"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { createCheckout, type BillingInterval } from "@/lib/api/billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const plans = [
  {
    title: "Free",
    price: "$0",
    subtitle: "Explore the extension connection flow and core dashboard.",
    bullets: ["Website account access", "Extension connection", "Basic Keyword Finder history"]
  },
  {
    title: "Monthly",
    price: "$4.99",
    subtitle: "Flexible access billed every month.",
    interval: "monthly" as BillingInterval,
    bullets: ["Full Keyword Finder usage", "Ongoing extension sessions", "Account and billing support"]
  },
  {
    title: "Yearly",
    price: "$41.9",
    subtitle: "Save 30% compared to paying monthly for a full year.",
    interval: "yearly" as BillingInterval,
    bullets: ["Everything in Monthly", "Annual savings built in", "Best fit for active sellers"]
  }
];

export default function PricingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
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
    <main className="app-shell">
      <SiteHeader
        tag="Pricing"
        navItems={[
          { href: "/about", label: "About" },
          { href: "/contact", label: "Contact" },
          { href: "/account", label: "Account" }
        ]}
      />

      <section className="shell marketing-surface">
        <div className="section-heading">
          <h1 className="page-title">Simple pricing with clear billing paths.</h1>
          <p className="page-copy">
            Paddle checkout is handled through the Worker, and the monthly and yearly plans map directly to your configured
            `PADDLE_PRICE_ID_MONTHLY` and `PADDLE_PRICE_ID_YEARLY` values.
          </p>
        </div>

        {status ? <div className="status error">{status}</div> : null}

        <div className="pricing-grid-clean">
          {plans.map((plan) => (
            <article className={`pricing-card-clean${plan.interval === "yearly" ? " highlighted-card" : ""}`} key={plan.title}>
              {plan.interval === "yearly" ? <div className="plan-badge">Best value</div> : null}
              <h2>{plan.title}</h2>
              <div className="pricing-amount">{plan.price}</div>
              <p>{plan.subtitle}</p>
              <ul className="clean-list compact-list">
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              {plan.interval ? (
                <button className="primary-button wide-button" disabled={loadingPlan === plan.interval} onClick={() => handleCheckout(plan.interval)} type="button">
                  {loadingPlan === plan.interval ? "Redirecting..." : `Choose ${plan.title}`}
                </button>
              ) : (
                <Link className="secondary-button wide-button" href="/auth/sign-up">
                  Start free
                </Link>
              )}
            </article>
          ))}
        </div>

        <div className="faq-card">
          <h2>Billing notes</h2>
          <p className="page-copy">
            Monthly and yearly checkout are created on Cloudflare Workers and sent to Paddle. The yearly price reflects a
            30% savings relative to the monthly plan over twelve months.
          </p>
        </div>

        <div className="comparison-grid">
          <article className="comparison-card">
            <h2>Free is best when</h2>
            <ul className="clean-list">
              <li>You want to test sign-up, account access, and extension connection first.</li>
              <li>You are validating the workflow before subscribing.</li>
              <li>You need a low-friction place to start.</li>
            </ul>
          </article>
          <article className="comparison-card">
            <h2>Paid is best when</h2>
            <ul className="clean-list">
              <li>You expect repeated TPT research sessions.</li>
              <li>You want a stable workflow between the website and extension.</li>
              <li>You want yearly savings instead of monthly flexibility.</li>
            </ul>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
