"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

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
        setStatus("Email confirmed. Redirecting to your dashboard...");
        setTimeout(() => router.replace("/dashboard"), 1200);
        return;
      }

      setStatus("The callback completed, but no active session was created. Return to sign in if needed.");
    }

    void completeCallback();

    return () => {
      active = false;
    };
  }, [router, supabase]);

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
