"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkOAuthEmail, signInWithPassword, startOAuth } from "@/lib/api/auth";
import { fetchApiProfile } from "@/lib/api/profile";
import { mapSignInError } from "@/lib/auth/errors";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AuthDivider,
  AuthField,
  AuthPasswordToggleIcon,
  AuthShell,
  AuthSocialButton,
  AuthTextLink,
  GithubIcon,
  GoogleIcon
} from "@/components/auth/auth-shell";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const nextPath = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | "">("");

  function buildOAuthPrompt(provider: "google" | "github") {
    return provider === "google"
      ? "Enter your email first to continue with Google."
      : "Enter your email first to continue with GitHub.";
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function hydrateSession() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active || !session?.access_token) {
        return;
      }

      try {
        await fetchApiProfile(session.access_token);

        if (!active) {
          return;
        }

        router.replace(nextPath);
      } catch {
        await client.auth.signOut();
      }
    }

    void hydrateSession();

    return () => {
      active = false;
    };
  }, [nextPath, router, supabase]);

  async function handleOAuth(provider: "google" | "github") {
    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setStatus(buildOAuthPrompt(provider));
      return;
    }

    setOauthLoading(provider);
    setStatus("");

    try {
      await checkOAuthEmail(normalizedEmail, provider);
      const { url } = await startOAuth(provider, getAuthCallbackUrl(nextPath));
      window.location.assign(url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start social sign-in.");
    } finally {
      setOauthLoading("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setStatus("");

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithPassword(email, password);

      const sessionError = await supabase.auth.setSession({
        access_token: result.session.accessToken,
        refresh_token: result.session.refreshToken
      });

      if (sessionError.error) {
        setStatus(sessionError.error.message);
        return;
      }

      await fetchApiProfile(result.session.accessToken);
      setStatus(`Signed in as ${result.user.email ?? result.user.id}. Redirecting...`);
      router.push(nextPath);
    } catch (error) {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        try {
          await fetchApiProfile(session.access_token);
          router.push(nextPath);
          return;
        } catch {
          await supabase.auth.signOut();
        }
      }

      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setStatus(mapSignInError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      footer={
        <>
          Don&apos;t have an account? <AuthTextLink href="/auth/sign-up">Sign up</AuthTextLink>
        </>
      }
      title="Welcome back"
    >
      <div className="space-y-3">
        <AuthSocialButton disabled={oauthLoading !== ""} onClick={() => handleOAuth("google")}>
          <GoogleIcon />
          {oauthLoading === "google" ? "Connecting..." : "Continue with Google"}
        </AuthSocialButton>
        <AuthSocialButton disabled={oauthLoading !== ""} onClick={() => handleOAuth("github")}>
          <GithubIcon />
          {oauthLoading === "github" ? "Connecting..." : "Continue with GitHub"}
        </AuthSocialButton>
      </div>

      <AuthDivider />

      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          id="email"
          input={
            <input
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email address"
              type="email"
              value={email}
            />
          }
          label="Email"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label className="block text-[15px] font-medium text-black" htmlFor="password">
              Password
            </label>
            <AuthTextLink href="/auth/forgot-password">Forgot password?</AuthTextLink>
          </div>
          <div className="relative">
            <input
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
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
        </div>

        {status ? <p className="text-[15px] text-neutral-500">{status}</p> : null}

        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
          type="submit"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f7f5]" />}>
      <SignInContent />
    </Suspense>
  );
}
