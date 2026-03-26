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
      <SiteHeader tag="Authentication" navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/contact", label: "Contact" }]} />

      <section className="shell auth-index-surface">
        <div className="section-heading">
          <h1 className="page-title">Account flows</h1>
          <p className="page-copy">Each authentication situation now has its own dedicated route and logic on the website.</p>
        </div>
        <div className="module-grid auth-route-grid">
          {routes.map((route) => (
            <Link className="module-card" href={route.href} key={route.href}>
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
