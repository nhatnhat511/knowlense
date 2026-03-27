"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { mapSignupResult, validatePassword } from "@/lib/auth/errors";
import { getSignupRedirectUrl } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 1 | 2;
type StatusKind = "idle" | "error" | "success";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.35 11.1H12v2.98h5.36c-.23 1.52-1.13 2.81-2.41 3.68v2.43h3.9c2.28-2.1 3.5-5.18 3.5-8.84 0-.76-.07-1.51-.2-2.25Z"
        fill="#4285F4"
      />
      <path
        d="M12 21.8c2.68 0 4.94-.89 6.59-2.42l-3.9-2.43c-1.08.73-2.46 1.17-4.13 1.17-3.18 0-5.88-2.15-6.84-5.03H-.34v2.58A9.94 9.94 0 0 0 12 21.8Z"
        fill="#34A853"
      />
      <path
        d="M5.16 13.09A5.98 5.98 0 0 1 4.82 11.1c0-.69.12-1.36.34-1.99V6.53H-.34A9.94 9.94 0 0 0-1.4 11.1c0 1.6.38 3.11 1.06 4.57l3.5-2.58Z"
        fill="#FBBC04"
      />
      <path
        d="M12 4.08c1.46 0 2.77.5 3.8 1.49l2.84-2.84C16.93 1.17 14.67.2 12 .2A9.94 9.94 0 0 0-.34 6.53l3.5 2.58c.96-2.88 3.66-5.03 6.84-5.03Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.3 9.4 7.88 10.93.58.1.79-.25.79-.56 0-.28-.01-1.2-.02-2.18-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.87 10.87 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.73.81 1.17 1.83 1.17 3.09 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.2.67.8.56a11.53 11.53 0 0 0 7.87-10.93C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | "">("");

  function setMessage(message: string, kind: StatusKind = "idle") {
    setStatus(message);
    setStatusKind(kind);
  }

  function handleContinue() {
    const normalizedEmail = email.trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setMessage("Please enter a valid email address before continuing.", "error");
      return;
    }

    setEmail(normalizedEmail);
    setMessage("");
    setStep(2);
  }

  async function handleOAuth(provider: "google" | "github") {
    if (!supabase) {
      setMessage("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.", "error");
      return;
    }

    setOauthLoading(provider);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getSignupRedirectUrl()
        }
      });

      if (error) {
        setMessage(error.message, "error");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start social sign-in.", "error");
    } finally {
      setOauthLoading("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setMessage("Display name is required.", "error");
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password, password);
    if (passwordValidation) {
      setMessage(passwordValidation.message, passwordValidation.kind === "error" ? "error" : "idle");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setMessage("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.", "error");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getSignupRedirectUrl(),
          data: {
            display_name: normalizedDisplayName
          }
        }
      });

      const signupMessage = mapSignupResult({
        email,
        errorMessage: error?.message,
        identitiesLength: data.user?.identities?.length
      });

      setMessage(
        signupMessage.message,
        signupMessage.kind === "error" ? "error" : signupMessage.kind === "success" ? "success" : "idle"
      );

      if (signupMessage.kind === "error") {
        return;
      }

      if (data.session?.access_token) {
        router.push("/dashboard");
        return;
      }

      if ((data.user?.identities?.length ?? 0) === 0) {
        return;
      }

      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the account.", "error");
    } finally {
      setLoading(false);
    }
  }

  const progressWidth = step === 1 ? "50%" : "100%";

  return (
    <main className="app-shell">
      <SiteHeader
        tag="Create account"
        navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/auth/sign-in", label: "Sign in" }]}
      />

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-blue-700 uppercase">
                  Create account
                </span>
                <span className="text-sm font-medium text-slate-500">Step {step} of 2</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  aria-hidden="true"
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-500 ease-out"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                {step === 1 ? "Start with your email" : "Set up your account details"}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                {step === 1
                  ? "Begin with the email you want to use for Knowlense, or continue with Google or GitHub."
                  : "Create a secure password and choose the display name shown inside your Knowlense workspace."}
              </p>
            </div>

            {step === 1 ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                    disabled={oauthLoading !== ""}
                    onClick={() => handleOAuth("google")}
                    type="button"
                  >
                    <GoogleIcon />
                    {oauthLoading === "google" ? "Connecting..." : "Continue with Google"}
                  </button>

                  <button
                    className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                    disabled={oauthLoading !== ""}
                    onClick={() => handleOAuth("github")}
                    type="button"
                  >
                    <GithubIcon />
                    {oauthLoading === "github" ? "Connecting..." : "Continue with GitHub"}
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">or use email</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@schoolstore.com"
                    type="email"
                    value={email}
                  />
                  <p className="text-sm text-slate-500">We will use this address for sign-in, verification, and account updates.</p>
                </div>

                {status ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      statusKind === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : statusKind === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {status}
                  </div>
                ) : null}

                <button
                  className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 text-base font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600 hover:shadow-[0_20px_45px_rgba(37,99,235,0.32)]"
                  onClick={handleContinue}
                  type="button"
                >
                  Continue
                </button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Email</span>
                  <span className="mt-1 block text-sm font-medium text-slate-700">{email}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="display-name">
                    Display name
                  </label>
                  <input
                    id="display-name"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="e.g. Ms. Carter Resources"
                    type="text"
                    value={displayName}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    type="password"
                    value={password}
                  />
                  <p className="text-sm text-slate-500">Use a password with at least 8 characters.</p>
                </div>

                {status ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      statusKind === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : statusKind === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {status}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-base font-medium text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => setStep(1)}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 text-base font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600 hover:shadow-[0_20px_45px_rgba(37,99,235,0.32)]"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? "Creating account..." : "Create account"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500">
              <span>Already have an account?</span>
              <Link className="font-medium text-slate-800 transition-colors hover:text-blue-600" href="/auth/sign-in">
                Sign in
              </Link>
              <span className="text-slate-300">•</span>
              <Link className="font-medium text-slate-800 transition-colors hover:text-blue-600" href="/auth/forgot-password">
                Forgot password
              </Link>
            </div>
          </div>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
