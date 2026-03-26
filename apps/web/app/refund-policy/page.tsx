import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function RefundPolicyPage() {
  return (
    <main className="app-shell">
      <SiteHeader tag="Refund Policy" navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/terms", label: "Terms" }, { href: "/contact", label: "Contact" }]} />
      <section className="shell legal-surface">
        <h1 className="page-title">Refund Policy</h1>
        <p className="page-copy">
          Monthly and yearly subscriptions are billed through Paddle. Refund requests should be submitted to support@knowlense.com
          with your billing email and the relevant transaction details.
        </p>
        <div className="legal-card">
          <h2>How requests are handled</h2>
          <p className="page-copy">Refund requests are reviewed against the billing timeline, subscription state, and Paddle transaction record tied to your account.</p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
