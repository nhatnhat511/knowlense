"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authorizeExtensionConnection } from "@/lib/api/extension-connect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function ConnectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const requestId = searchParams.get("request");
  const [status, setStatus] = useState("Checking your website session...");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setStatus("Missing extension connection request.");
      return;
    }

    if (!supabase) {
      setStatus("Supabase configuration is missing on the website.");
      return;
    }

    const client = supabase;
    let active = true;

    async function loadSession() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.access_token) {
        router.replace(`/auth?next=${encodeURIComponent(`/connect?request=${requestId}`)}`);
        return;
      }

      setReady(true);
      setStatus("Ready to connect this browser extension.");
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [requestId, router, supabase]);

  async function handleConnect() {
    if (!supabase || !requestId) {
      return;
    }

    setBusy(true);
    setStatus("Authorizing this extension request...");

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace(`/auth?next=${encodeURIComponent(`/connect?request=${requestId}`)}`);
        return;
      }

      await authorizeExtensionConnection(session.access_token, requestId);
      setStatus("Extension connected. Return to the popup to continue.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to connect the extension.");
    } finally {
      setBusy(false);
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
              <span className="brand-tag">Connect extension</span>
            </span>
          </Link>
          <nav className="nav">
            <Link className="nav-link" href="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="shell connect-surface">
        <div className="connect-card">
          <span className="eyebrow">Secure extension connection</span>
          <h1 className="page-title">Approve this browser session from the website.</h1>
          <p className="page-copy">
            The extension requested a secure session from Knowlense. Approve it here after signing in, then return to
            the popup to finish the connection.
          </p>
          <div className={`status ${ready ? "success" : ""}`}>{status}</div>
          <div className="stack-row">
            <button className="primary-button" disabled={!ready || busy} onClick={handleConnect} type="button">
              {busy ? "Connecting..." : "Connect extension"}
            </button>
            <Link className="secondary-button" href="/dashboard">
              Open dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="app-shell"><section className="shell connect-surface"><div className="empty-state">Loading extension connection...</div></section></main>}>
      <ConnectPageContent />
    </Suspense>
  );
}
