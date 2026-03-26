import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function ContactPage() {
  return (
    <main className="app-shell">
      <SiteHeader tag="Contact" navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }, { href: "/account", label: "Account" }]} />
      <section className="shell legal-surface">
        <h1 className="page-title">Contact</h1>
        <p className="page-copy">For product, support, billing, or privacy questions, contact the Knowlense team at support@knowlense.com.</p>
        <div className="legal-card">
          <h2>What to include</h2>
          <p className="page-copy">
            Include your account email, the page or flow involved, and any relevant billing or extension details so support
            can trace the issue quickly.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
