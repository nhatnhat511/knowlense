import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function TermsPage() {
  return (
    <main className="app-shell">
      <SiteHeader tag="Terms of Service" navItems={[{ href: "/privacy", label: "Privacy" }, { href: "/refund-policy", label: "Refund policy" }, { href: "/contact", label: "Contact" }]} />
      <section className="shell legal-surface">
        <h1 className="page-title">Terms of Service</h1>
        <p className="page-copy">
          By using Knowlense, you agree not to misuse the service, to keep account credentials secure, and to comply with the
          policies of any third-party platforms you analyze through the extension.
        </p>
        <div className="legal-card">
          <h2>Acceptable use</h2>
          <p className="page-copy">You are responsible for how you use the extension and for ensuring that your marketplace activity complies with third-party platform rules.</p>
        </div>
        <div className="legal-card">
          <h2>Accounts and security</h2>
          <p className="page-copy">You must keep your website credentials and any connected browser environment under your control.</p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
