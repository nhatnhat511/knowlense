"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/api/auth";
import { getPasswordResetRedirectUrl } from "@/lib/auth/redirects";
import { AuthField, AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      await requestPasswordReset(email, getPasswordResetRedirectUrl());

      setStatus("Password reset email sent. Check your inbox.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send password reset email.");
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
      title="Reset password"
      subtitle="Enter your email address and we&apos;ll send you a link to reset your password"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          id="forgot-email"
          input={
            <input
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
              id="forgot-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
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
          type="submit"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
