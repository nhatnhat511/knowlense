"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [status, setStatus] = useState("Checking account status...");
  const [emailConfirmed, setEmailConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase configuration.");
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

      if (!session?.access_token) {
        router.replace("/auth/sign-in?next=/account");
        return;
      }

      try {
        const [authResult, profileResult] = await Promise.all([client.auth.getUser(), fetchApiProfile(session.access_token)]);

        if (!active) {
          return;
        }

        setProfile(profileResult);
        setEmailConfirmed(Boolean(authResult.data.user?.email_confirmed_at));
        setStatus("Your website account is active and ready.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to load account.");
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  }

  return (
    <main className="app-shell">
      <SiteHeader
        tag="Account"
        navItems={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/pricing", label: "Pricing" },
          { href: "/contact", label: "Support" }
        ]}
        primaryCta={{ href: "/connect", label: "Connect extension" }}
      />

      <section className="shell dashboard-surface">
        <div className="section-heading">
          <span className="section-label">Account Center</span>
          <h1 className="page-title">Manage identity, security, billing entry points, and extension access.</h1>
          <p className="page-copy">{status}</p>
        </div>

        <div className="stats-strip">
          <article className="stat-chip-card">
            <span className="stat-label">Website session</span>
            <strong>{profile ? "Active" : "Inactive"}</strong>
            <span className="stat-help">Your main account session lives on the website.</span>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Email verification</span>
            <strong>{emailConfirmed === null ? "Checking..." : emailConfirmed ? "Verified" : "Pending"}</strong>
            <span className="stat-help">Verification is required for a fully trusted account workflow.</span>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Recommended next step</span>
            <strong>Connect extension</strong>
            <span className="stat-help">Approve a separate extension session after signing in here.</span>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Profile</h2>
                <p className="panel-copy">Core identity details and current website account state.</p>
              </div>
              <span className="panel-badge">Identity</span>
            </div>
            <div className="data-list">
              <div className="data-item">
                <span>Email</span>
                <strong>{profile?.email ?? "No active session"}</strong>
              </div>
              <div className="data-item">
                <span>User ID</span>
                <strong>{profile?.id ?? "Unavailable"}</strong>
              </div>
              <div className="data-item">
                <span>Verification state</span>
                <strong>{emailConfirmed === null ? "Checking..." : emailConfirmed ? "Verified" : "Not verified"}</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Security and access</h2>
                <p className="panel-copy">Website credentials stay on the web app. The extension receives its own session after approval.</p>
              </div>
              <span className="panel-badge">Security</span>
            </div>
            <div className="stack-row">
              <Link className="primary-button" href="/connect">
                Connect extension
              </Link>
              <Link className="secondary-button" href="/auth/change-password">
                Change password
              </Link>
              <button className="secondary-button" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </div>
            <div className="panel-list">
              <div className="panel-list-item">
                <strong>Website-first sign-in</strong>
                <p>Knowlense does not ask users to enter website credentials directly in the extension popup.</p>
              </div>
              <div className="panel-list-item">
                <strong>Separate extension session</strong>
                <p>The extension uses a Worker-issued session so web auth and extension access remain distinct.</p>
              </div>
            </div>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Billing</h2>
                <p className="panel-copy">Billing is initiated from the website and processed through Paddle checkout.</p>
              </div>
              <span className="panel-badge">Plans</span>
            </div>
            <div className="panel-list">
              <div className="panel-list-item">
                <strong>Free</strong>
                <p>Use the product and validate the workflow before moving into paid usage.</p>
              </div>
              <div className="panel-list-item">
                <strong>Monthly or yearly</strong>
                <p>Paid plans are routed through Worker-created Paddle transactions rather than hard-coded client links.</p>
              </div>
            </div>
            <div className="stack-row">
              <Link className="primary-button" href="/pricing">
                Manage plans
              </Link>
              <Link className="secondary-button" href="/refund-policy">
                Refund policy
              </Link>
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Support and policy</h2>
                <p className="panel-copy">The account page should give users a fast path to help, privacy details, and service terms.</p>
              </div>
              <span className="panel-badge">Support</span>
            </div>
            <div className="stack-row">
              <Link className="secondary-button" href="/contact">
                Contact support
              </Link>
              <Link className="secondary-button" href="/privacy">
                Privacy
              </Link>
              <Link className="secondary-button" href="/terms">
                Terms
              </Link>
            </div>
            <div className="panel-list">
              <div className="panel-list-item">
                <strong>Access issues</strong>
                <p>Include your account email and the flow involved so support can trace the issue quickly.</p>
              </div>
              <div className="panel-list-item">
                <strong>Billing questions</strong>
                <p>Support can review payment issues using your account email and the Paddle transaction reference.</p>
              </div>
            </div>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
