"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/api/auth";
import { validatePassword } from "@/lib/auth/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthField, AuthShell } from "@/components/auth/auth-shell";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Checking website session...");
  const [ready, setReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);

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
        router.replace("/auth/sign-in?next=/auth/change-password");
        return;
      }

      setAccessToken(session.access_token);
      setReady(true);
      setStatus("Set a new password for your account.");
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const passwordValidation = validatePassword(password, confirmPassword);
    if (passwordValidation) {
      setStatus(passwordValidation.message);
      return;
    }

    if (!ready || !accessToken) {
      setStatus("A valid session was not found.");
      return;
    }

    setLoading(true);

    try {
      await changePassword(password, accessToken);

      setStatus("Password updated successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Change password" subtitle="Set a new password for your account.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          id="change-password"
          input={
            <input
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
              id="change-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              type="password"
              value={password}
            />
          }
          label="New password"
        />

        <AuthField
          id="change-password-confirm"
          input={
            <input
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
              id="change-password-confirm"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              type="password"
              value={confirmPassword}
            />
          }
          label="Confirm new password"
        />

        {status ? <p className="text-[15px] text-neutral-500">{status}</p> : null}

        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
          type="submit"
        >
          {loading ? "Updating..." : "Change password"}
        </button>
      </form>
    </AuthShell>
  );
}
