"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { mapSignupResult, validatePassword } from "@/lib/auth/errors";
import { getSignupRedirectUrl } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setStatusKind("idle");

    const passwordValidation = validatePassword(password, confirmPassword);
    if (passwordValidation) {
      setStatus(passwordValidation.message);
      setStatusKind(passwordValidation.kind === "error" ? "error" : "idle");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setStatus("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setStatusKind("error");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getSignupRedirectUrl()
        }
      });

      const signupMessage = mapSignupResult({
        email,
        errorMessage: error?.message,
        identitiesLength: data.user?.identities?.length
      });

      setStatus(signupMessage.message);
      setStatusKind(signupMessage.kind === "error" ? "error" : signupMessage.kind === "success" ? "success" : "idle");

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
      setStatus(error instanceof Error ? error.message : "Unable to create the account.");
      setStatusKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <SiteHeader tag="Create account" navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/auth/sign-in", label: "Sign in" }]} />

      <section className="shell auth-surface single-card">
        <section className="auth-card">
          <span className="eyebrow">Website sign up</span>
          <h1 className="page-title auth-title">Create your account</h1>
          <p className="page-copy">
            Set up your website account first. Email verification, password recovery, and extension access are managed
            from the web app.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <span className="field-hint">Use at least 8 characters.</span>
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            <div className={`status ${statusKind !== "idle" ? statusKind : ""}`}>{status}</div>
            <button className="primary-button wide-button" disabled={loading} type="submit">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <div className="stack-row">
            <Link className="ghost-button" href="/auth/sign-in">
              Already have an account
            </Link>
            <Link className="ghost-button" href="/auth/forgot-password">
              Forgot password
            </Link>
          </div>
          <p className="auth-support-note">
            If the account already exists, Knowlense follows the authentication behavior configured in Supabase rather than
            exposing unnecessary account-enumeration details.
          </p>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
