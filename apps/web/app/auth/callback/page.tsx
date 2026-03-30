"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeOAuthProvider } from "@/lib/api/auth";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const nextPath = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/dashboard";
  const rawProvider = searchParams.get("provider");
  const oauthProvider: "google" | "github" | null =
    rawProvider === "google" || rawProvider === "github" ? rawProvider : null;
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo: "/auth/sign-in" | "/auth/sign-up" =
    rawReturnTo === "/auth/sign-in" || rawReturnTo === "/auth/sign-up" ? rawReturnTo : "/auth/sign-in";
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

    function readHashSession() {
      if (typeof window === "undefined" || !window.location.hash) {
        return null;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!accessToken || !refreshToken) {
        return null;
      }

      return {
        accessToken,
        refreshToken
      };
    }

    async function finalizeWithSession() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return false;
      }

      if (session?.access_token) {
        if (oauthProvider) {
          try {
            await completeOAuthProvider(session.access_token, oauthProvider);
          } catch (error) {
            await client.auth.signOut();
            if (!active) {
              return false;
            }

            const message = error instanceof Error ? error.message : "This sign-in method is not available for this email.";
            router.replace(`${returnTo}?auth_error=${encodeURIComponent(message)}`);
            return true;
          }
        }

        let profileValidated = false;

        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            await fetchApiProfile(session.access_token);
            profileValidated = true;
            break;
          } catch {
            if (attempt < 4) {
              await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            }
          }
        }

        if (!profileValidated) {
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
      const hashSession = readHashSession();

      if (hashSession) {
        const sessionResult = await client.auth.setSession({
          access_token: hashSession.accessToken,
          refresh_token: hashSession.refreshToken
        });

        if (!active) {
          return;
        }

        if (sessionResult.error) {
          setStatus(sessionResult.error.message);
          return;
        }
      } else if (authCode) {
        const exchangeResult = await client.auth.exchangeCodeForSession(authCode);

        if (!active) {
          return;
        }

        if (exchangeResult.error) {
          setStatus(exchangeResult.error.message);
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
          setStatus("The callback completed, but the website session could not be confirmed yet. Return to sign in if needed.");
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
  }, [nextPath, oauthProvider, returnTo, router, searchParams, supabase]);

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
