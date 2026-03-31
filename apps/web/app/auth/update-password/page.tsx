"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validatePassword } from "@/lib/auth/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthField, AuthPasswordToggleIcon, AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState("Open this page from the password reset email sent by Supabase.");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
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

      if (session?.access_token) {
        setReady(true);
        setStatus("Recovery session detected. Set your new password.");
        setStatusKind("success");
      }
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event) => {
      if (!active) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setStatus("Recovery session detected. Set your new password.");
        setStatusKind("success");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || !supabase) {
      setStatus("A valid recovery session was not found. Use the reset email again.");
      setStatusKind("error");
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
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        throw error;
      }

      setStatus("Password updated. Redirecting to sign in...");
      setStatusKind("success");
      setTimeout(() => router.push("/auth/sign-in"), 1200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update password.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      footer={
        <>
          Back to <AuthTextLink href="/auth/sign-in">sign in</AuthTextLink>
        </>
      }
      subtitle="Use the recovery session from your email to set a new password for your account."
      title="Set a new password"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          hint="Must be at least 8 characters long."
          id="update-password"
          input={
            <div className="relative">
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="update-password"
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
          label="Password"
        />

        <AuthField
          id="update-confirm-password"
          input={
            <div className="relative">
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="update-confirm-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
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
          label="Confirm Password"
        />

        {status ? (
          <p className={`text-[15px] ${statusKind === "error" ? "text-red-600" : statusKind === "success" ? "text-emerald-600" : "text-neutral-500"}`}>
            {status}
          </p>
        ) : null}

        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
          type="submit"
        >
          {loading ? "Updating password..." : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
