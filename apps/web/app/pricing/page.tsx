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
    kicker: "For evaluation",
    subtitle: "Use the web app, create an account, and validate the extension connection flow before upgrading.",
    bullets: [
      "Website account access",
      "Extension connection setup",
      "Basic dashboard access",
      "Limited Keyword Finder history"
    ]
  },
  {
    title: "Monthly",
    price: "$4.99",
    kicker: "Flexible billing",
    subtitle: "Best when you want full access without committing to an annual billing cycle.",
    interval: "monthly" as BillingInterval,
    bullets: [
      "Full Keyword Finder usage",
      "Website and extension workflow",
      "Secure account and billing support",
      "Best for shorter evaluation periods"
    ]
  },
  {
    title: "Yearly",
    price: "$41.9",
    kicker: "Best value",
    subtitle: "Save 30% compared to paying monthly over a full year.",
    interval: "yearly" as BillingInterval,
    bullets: [
      "Everything in Monthly",
      "Lower annual effective cost",
      "Best for active, recurring research",
      "Recommended for production use"
    ]
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
          <span className="section-label">Pricing</span>
          <h1 className="page-title">Straightforward pricing for a focused workflow.</h1>
          <p className="page-copy">
            Knowlense keeps billing simple. Free lets you evaluate the workflow. Paid plans unlock the recurring research
            flow between the web app, Worker API, and extension.
          </p>
        </div>

        {status ? <div className="status error">{status}</div> : null}

        <div className="pricing-grid-clean">
          {plans.map((plan) => (
            <article className={`pricing-card-clean${plan.interval === "yearly" ? " highlighted-card" : ""}`} key={plan.title}>
              {plan.interval === "yearly" ? <div className="plan-badge">Recommended</div> : null}
              <div className="pricing-kicker">{plan.kicker}</div>
              <h2>{plan.title}</h2>
              <div className="pricing-amount">{plan.price}</div>
              <div className="pricing-subline">{plan.interval ? `${plan.interval === "monthly" ? "per month" : "per year"}` : "No card required"}</div>
              <p>{plan.subtitle}</p>
              <ul className="clean-list compact-list">
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              {plan.interval ? (
                <button
                  className="primary-button wide-button"
                  disabled={loadingPlan === plan.interval}
                  onClick={() => handleCheckout(plan.interval)}
                  type="button"
                >
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

        <div className="comparison-grid">
          <article className="comparison-card">
            <h2>What free is for</h2>
            <ul className="clean-list">
              <li>Creating an account and verifying the website auth flow.</li>
              <li>Connecting the extension for the first time.</li>
              <li>Checking whether the product fits your seller workflow.</li>
            </ul>
          </article>
          <article className="comparison-card">
            <h2>What paid is for</h2>
            <ul className="clean-list">
              <li>Repeated TPT research sessions across the month or year.</li>
              <li>Keeping extension and dashboard activity in one system.</li>
              <li>Running Knowlense as a dependable part of your research process.</li>
            </ul>
          </article>
        </div>

        <div className="faq-card">
          <h2>Billing details</h2>
          <ul className="policy-list">
            <li>
              <strong>Checkout provider</strong>
              <span>Paddle handles subscription checkout, taxes, invoices, and payment details.</span>
            </li>
            <li>
              <strong>Plan IDs</strong>
              <span>Monthly and yearly checkouts are created through Cloudflare Workers using your configured Paddle price IDs.</span>
            </li>
            <li>
              <strong>Refunds</strong>
              <span>Refund handling follows the policy published on the refund page and the underlying Paddle transaction record.</span>
            </li>
          </ul>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
