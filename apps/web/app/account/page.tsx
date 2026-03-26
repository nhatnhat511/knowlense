"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [status, setStatus] = useState("Checking account status...");

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
        const user = await fetchApiProfile(session.access_token);
        if (!active) {
          return;
        }
        setProfile(user);
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
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Account</span>
            </span>
          </Link>
          <nav className="nav">
            <Link className="nav-link" href="/pricing">
              Pricing
            </Link>
            <Link className="nav-link" href="/dashboard">
              Dashboard
            </Link>
            <button className="secondary-button" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <section className="shell dashboard-surface">
        <div className="section-heading">
          <h1 className="page-title">Account management</h1>
          <p className="page-copy">{status}</p>
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
            </div>
          </article>

          <article className="dashboard-panel">
            <h2>Extension connection</h2>
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
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
