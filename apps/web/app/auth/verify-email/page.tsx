"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSignupRedirectUrl } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthField, AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState("Check your inbox and click the confirmation link.");
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    if (!email) {
      setStatus("No email was provided for the confirmation flow.");
      return;
    }

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getSignupRedirectUrl()
        }
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Confirmation email sent again. Check your inbox.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to resend confirmation email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      footer={
        <>
          <AuthTextLink href="/auth/sign-in">Back to sign in</AuthTextLink>
        </>
      }
      title="Verify email"
      subtitle={email ? `We sent a confirmation email to ${email}.` : "Enter the email address you used so we can resend confirmation."}
    >
      <div className="space-y-5">
        <AuthField
          id="verify-email"
          input={
            <input
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
              id="verify-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email address"
              type="email"
              value={email}
            />
          }
          label="Email"
        />

        {status ? <p className="text-[15px] text-neutral-500">{status}</p> : null}

        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
          onClick={handleResend}
          type="button"
        >
          {loading ? "Sending..." : "Resend confirmation email"}
        </button>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f7f5]" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
