"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validatePassword } from "@/lib/auth/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthField, AuthPasswordToggleIcon, AuthShell } from "@/components/auth/auth-shell";

function getPrimaryProvider(user: {
  identities?: Array<{ provider?: string | null }> | null;
  app_metadata?: { provider?: string | null } | null;
} | null) {
  const identities = user?.identities ?? [];
  const emailIdentity = identities.find((identity: { provider?: string | null }) => identity.provider === "email");

  if (emailIdentity) {
    return "email" as const;
  }

  const provider = identities[0]?.provider ?? user?.app_metadata?.provider ?? "unknown";
  return provider === "google" || provider === "github" || provider === "email" ? provider : "unknown";
}

function getProviderLabel(provider: "email" | "google" | "github" | "unknown") {
  switch (provider) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "email":
      return "email and password";
    default:
      return "your sign-in provider";
  }
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState("Checking website session...");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nonceSent, setNonceSent] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase configuration.");
      setStatusKind("error");
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
        router.replace("/auth/sign-in?next=/auth/change-password");
        return;
      }

      const {
        data: { user }
      } = await client.auth.getUser();

      if (!active) {
        return;
      }

      const provider = getPrimaryProvider(user);

      if (provider !== "email") {
        setReady(false);
        setStatus(`Password changes are managed through ${getProviderLabel(provider)}.`);
        setStatusKind("idle");
        return;
      }

      setReady(true);
      setStatus("Enter a new password, then request a verification code to finish the update.");
      setStatusKind("idle");
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || !supabase) {
      return;
    }

    const passwordValidation = validatePassword(password, confirmPassword);
    if (passwordValidation) {
      setStatus(passwordValidation.message);
      setStatusKind(passwordValidation.kind === "error" ? "error" : "idle");
      return;
    }

    setLoading(true);

    try {
      if (!nonceSent) {
        const { error } = await supabase.auth.reauthenticate();

        if (error) {
          throw error;
        }

        setNonceSent(true);
        setStatus("A verification code has been sent to your email. Enter it below to finish updating your password.");
        setStatusKind("success");
        return;
      }

      if (!verificationCode.trim()) {
        setStatus("Enter the verification code sent to your email.");
        setStatusKind("error");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
        nonce: verificationCode.trim()
      });

      if (error) {
        throw error;
      }

      setStatus("Password updated successfully.");
      setStatusKind("success");
      setPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setNonceSent(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update password.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Change password" subtitle="Update your password using Supabase secure password change.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          hint="Must be at least 8 characters long."
          id="change-password"
          input={
            <div className="relative">
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="change-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="absolute inset-y-0 right-3 my-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <AuthPasswordToggleIcon visible={showPassword} />
              </button>
            </div>
          }
          label="New password"
        />

        <AuthField
          id="change-password-confirm"
          input={
            <div className="relative">
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="change-password-confirm"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                className="absolute inset-y-0 right-3 my-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
                onClick={() => setShowConfirmPassword((current) => !current)}
                type="button"
              >
                <AuthPasswordToggleIcon visible={showConfirmPassword} />
              </button>
            </div>
          }
          label="Confirm new password"
        />

        {nonceSent ? (
          <AuthField
            hint="Enter the code that Supabase sent to your email."
            id="change-password-code"
            input={
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="change-password-code"
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="Verification code"
                value={verificationCode}
              />
            }
            label="Verification code"
          />
        ) : null}

        {status ? (
          <p className={`text-[15px] ${statusKind === "error" ? "text-red-600" : statusKind === "success" ? "text-emerald-600" : "text-neutral-500"}`}>
            {status}
          </p>
        ) : null}

        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading || !ready}
          type="submit"
        >
          {loading ? (nonceSent ? "Updating password..." : "Sending verification code...") : nonceSent ? "Update password" : "Send verification code"}
        </button>
      </form>
    </AuthShell>
  );
}
