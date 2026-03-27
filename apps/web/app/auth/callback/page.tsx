"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeOAuthCode } from "@/lib/api/auth";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const nextPath = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/dashboard";
  const [status, setStatus] = useState("Processing the Supabase callback...");

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase configuration on the website.");
      return;
    }

    const providerError = searchParams.get("error_description") || searchParams.get("error");
    if (providerError) {
      setStatus(providerError);
      return;
    }

    const client = supabase;
    let active = true;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    async function finalizeWithSession() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return false;
      }

      if (session?.access_token) {
        try {
          await fetchApiProfile(session.access_token);
        } catch {
          await client.auth.signOut();
          return false;
        }

        setStatus("Authentication completed. Redirecting...");
        redirectTimer = setTimeout(() => router.replace(nextPath), 900);
        return true;
      }

      return false;
    }

    async function completeCallback() {
      const authCode = searchParams.get("code");

      if (authCode) {
        const result = await exchangeOAuthCode(authCode);
        const sessionResult = await client.auth.setSession({
          access_token: result.session.accessToken,
          refresh_token: result.session.refreshToken
        });

        if (!active) {
          return;
        }

        if (sessionResult.error) {
          setStatus(sessionResult.error.message);
          return;
        }
      }

      const completed = await finalizeWithSession();
      if (completed || !active) {
        return;
      }

      setStatus("Finishing sign-in...");

      const retryTimer = setTimeout(async () => {
        const ready = await finalizeWithSession();
        if (!ready && active) {
          setStatus("The callback completed, but no active session was created. Return to sign in if needed.");
        }
      }, 1200);

      return () => clearTimeout(retryTimer);
    }

    const unsubscribe = client.auth.onAuthStateChange((event) => {
      if (!active) {
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void finalizeWithSession();
      }
    });

    let cleanupRetry: (() => void) | undefined;
    void completeCallback().then((cleanup) => {
      cleanupRetry = cleanup;
    });

    return () => {
      active = false;
      unsubscribe.data.subscription.unsubscribe();
      cleanupRetry?.();
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [nextPath, router, searchParams, supabase]);

  return (
    <AuthShell
      footer={
        <>
          Return to <AuthTextLink href="/auth/sign-in">sign in</AuthTextLink>
        </>
      }
      subtitle="We are finishing the secure handoff from Supabase and preparing your website session."
      title="Completing authentication"
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-black/10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </div>
        <p className="text-[15px] leading-7 text-neutral-600">{status}</p>
      </div>
    </AuthShell>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f7f5]" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
