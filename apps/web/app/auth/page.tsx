import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const routes = [
  { href: "/auth/sign-in", title: "Sign in", copy: "Access your account from the website." },
  { href: "/auth/sign-up", title: "Create account", copy: "Register a new Knowlense account." },
  { href: "/auth/verify-email", title: "Verify email", copy: "Check status or resend the confirmation email." },
  { href: "/auth/forgot-password", title: "Forgot password", copy: "Request a reset email from Supabase." },
  { href: "/auth/change-password", title: "Change password", copy: "Update the password while signed in." },
  { href: "/auth/update-password", title: "Update password", copy: "Set a new password after recovery." }
];

export default function AuthIndexPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Authentication"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/contact", label: "Contact" },
          { href: "/auth/sign-in", label: "Sign in" }
        ]}
        primaryCta={{ href: "/auth/sign-up", label: "Create account" }}
      />

      <section className="shell auth-index-surface">
        <div className="section-heading">
          <span className="section-label">Account Flows</span>
          <h1 className="page-title">Every account state has a dedicated website flow.</h1>
          <p className="page-copy">
            Sign up, sign in, verify email, recover access, and update credentials through purpose-built routes instead of
            one overloaded form.
          </p>
        </div>
        <div className="module-grid auth-route-grid">
          {routes.map((route) => (
            <Link className="module-card" href={route.href} key={route.href}>
              <span className="module-meta">Auth route</span>
              <h3>{route.title}</h3>
              <p>{route.copy}</p>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
