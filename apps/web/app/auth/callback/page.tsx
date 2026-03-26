"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState("Processing the Supabase callback...");

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase configuration on the website.");
      return;
    }

    const client = supabase;
    let active = true;

    async function completeCallback() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (session?.access_token) {
        setStatus("Email confirmed. Redirecting to the dashboard...");
        setTimeout(() => router.replace("/dashboard"), 1200);
        return;
      }

      setStatus("The callback did not produce a session. Return to sign in if needed.");
    }

    void completeCallback();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Auth callback</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Supabase callback</span>
          <h1 className="page-title" style={{ fontSize: "2.3rem" }}>Completing authentication</h1>
          <p className="page-copy">{status}</p>
          <div className="stack-row">
            <Link className="secondary-button" href="/auth/sign-in">
              Go to sign in
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
