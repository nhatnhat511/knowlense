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
        const [
          authResult,
          profileResult
        ] = await Promise.all([client.auth.getUser(), fetchApiProfile(session.access_token)]);
        if (!active) {
          return;
        }
        setProfile(profileResult);
        setEmailConfirmed(Boolean(authResult.data.user?.email_confirmed_at));
        setStatus("Your account is active on the website.");
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
          { href: "/pricing", label: "Pricing" },
          { href: "/dashboard", label: "Dashboard" },
          { href: "/contact", label: "Support" }
        ]}
      />

      <section className="shell dashboard-surface">
        <div className="section-heading">
          <h1 className="page-title">Account management</h1>
          <p className="page-copy">{status}</p>
        </div>

        <div className="stats-strip">
          <article className="stat-chip-card">
            <span className="stat-label">Website session</span>
            <strong>{profile ? "Active" : "Inactive"}</strong>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Email verification</span>
            <strong>{emailConfirmed === null ? "Checking..." : emailConfirmed ? "Verified" : "Pending"}</strong>
          </article>
          <article className="stat-chip-card">
            <span className="stat-label">Next action</span>
            <strong>Connect extension</strong>
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <h2>Profile</h2>
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
                <span>Email verification</span>
                <strong>{emailConfirmed === null ? "Checking..." : emailConfirmed ? "Verified" : "Not verified"}</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-panel">
            <h2>Security and extension access</h2>
            <p className="panel-copy">
              The extension must be connected from the website through a Worker-managed session bridge. It never asks for your
              credentials directly.
            </p>
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
          </article>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel">
            <h2>Billing</h2>
            <p className="panel-copy">
              Billing is handled through Paddle. Choose a plan from the pricing page to start checkout through the Worker API.
            </p>
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
            <h2>Support</h2>
            <p className="panel-copy">
              For access issues, billing questions, or privacy requests, use the contact page and include your account email.
            </p>
            <div className="stack-row">
              <Link className="secondary-button" href="/contact">
                Contact support
              </Link>
              <Link className="secondary-button" href="/privacy">
                Privacy details
              </Link>
            </div>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
