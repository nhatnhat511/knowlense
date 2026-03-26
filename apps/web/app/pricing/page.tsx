"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCheckout, type BillingInterval } from "@/lib/api/billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const plans = [
  {
    title: "Free",
    price: "$0",
    subtitle: "Explore the extension connection flow and core dashboard."
  },
  {
    title: "Monthly",
    price: "$4.99",
    subtitle: "Flexible access billed every month.",
    interval: "monthly" as BillingInterval
  },
  {
    title: "Yearly",
    price: "$41.9",
    subtitle: "Save 30% compared to paying monthly for a full year.",
    interval: "yearly" as BillingInterval
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
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Pricing</span>
            </span>
          </Link>
          <nav className="nav">
            <Link className="nav-link" href="/about">
              About
            </Link>
            <Link className="nav-link" href="/contact">
              Contact
            </Link>
            <Link className="primary-button" href="/account">
              Account
            </Link>
          </nav>
        </div>
      </header>

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
            <article className="pricing-card-clean" key={plan.title}>
              <h2>{plan.title}</h2>
              <div className="pricing-amount">{plan.price}</div>
              <p>{plan.subtitle}</p>
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
      </section>
    </main>
  );
}
