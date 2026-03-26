import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function PrivacyPage() {
  return (
    <main className="app-shell">
      <SiteHeader tag="Privacy Policy" navItems={[{ href: "/terms", label: "Terms" }, { href: "/refund-policy", label: "Refund policy" }, { href: "/contact", label: "Contact" }]} />
      <section className="shell legal-surface">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-copy">
          Knowlense uses Supabase for authentication, Cloudflare Workers for API processing, Cloudflare D1 for application
          data, and Paddle for subscription billing. Only the minimum data required to operate the service is collected.
        </p>
        <div className="legal-card">
          <h2>Data categories</h2>
          <p className="page-copy">This includes account email, session identifiers, billing references, and search research data created inside the product.</p>
        </div>
        <div className="legal-card">
          <h2>Service providers</h2>
          <p className="page-copy">Supabase handles auth, Cloudflare hosts the application and API, and Paddle handles subscription payments and tax collection.</p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
