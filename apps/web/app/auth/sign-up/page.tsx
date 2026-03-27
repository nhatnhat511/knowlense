"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithPassword, startOAuth } from "@/lib/api/auth";
import { mapSignupResult, validatePassword } from "@/lib/auth/errors";
import { getAuthCallbackUrl, getSignupRedirectUrl } from "@/lib/auth/redirects";
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

type Step = 1 | 2;

export default function SignUpPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | "">("");

  async function handleOAuth(provider: "google" | "github") {
    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setOauthLoading(provider);
    setStatus("");

    try {
      const { url } = await startOAuth(provider, getAuthCallbackUrl("/dashboard"));
      window.location.assign(url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start social sign-in.");
    } finally {
      setOauthLoading("");
    }
  }

  function handleContinue() {
    const normalizedEmail = email.trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setStatus("Please enter a valid email address.");
      return;
    }

    setEmail(normalizedEmail);
    setStatus("");
    setStep(2);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    if (!displayName.trim()) {
      setStatus("Display name is required.");
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password, password);
    if (passwordValidation) {
      setStatus(passwordValidation.message);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    try {
      const data = await signUpWithPassword(email, password, displayName.trim(), getSignupRedirectUrl());

      const signupMessage = mapSignupResult({
        email,
        identitiesLength: data.identitiesLength ?? undefined
      });

      setStatus(signupMessage.message);

      if (signupMessage.kind === "error") {
        return;
      }

      if (data.session && supabase) {
        const sessionError = await supabase.auth.setSession({
          access_token: data.session.accessToken,
          refresh_token: data.session.refreshToken
        });

        if (sessionError.error) {
          setStatus(sessionError.error.message);
          return;
        }

        router.push("/dashboard");
        return;
      }

      if ((data.identitiesLength ?? 0) === 0) {
        return;
      }

      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create the account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      footer={
        <>
          Already have an account? <AuthTextLink href="/auth/sign-in">Sign in</AuthTextLink>
        </>
      }
      legal={
        <>
          By clicking continue, you agree to our <AuthTextLink href="/terms">Terms of Service</AuthTextLink> and{" "}
          <AuthTextLink href="/privacy">Privacy Policy</AuthTextLink>.
        </>
      }
      title="Create an account"
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

      {step === 1 ? (
        <div className="space-y-5">
          <AuthField
            id="signup-email"
            input={
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="signup-email"
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
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800"
            onClick={handleContinue}
            type="button"
          >
            Continue
          </button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <AuthField
            id="display-name"
            input={
              <input
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                id="display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                type="text"
                value={displayName}
              />
            }
            label="Full Name"
          />

          <AuthField
            id="signup-password"
            hint="Must be at least 8 characters long."
            input={
              <div className="relative">
                <input
                  className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 pr-12 text-[17px] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
                  id="signup-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
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

          {status ? <p className="text-[15px] text-neutral-500">{status}</p> : null}

          <div className="flex gap-3">
            <button
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[16px] font-medium text-black transition hover:bg-neutral-50"
              onClick={() => setStep(1)}
              type="button"
            >
              Back
            </button>
            <button
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-black px-5 text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
              type="submit"
            >
              {loading ? "Signing up..." : "Sign Up"}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
