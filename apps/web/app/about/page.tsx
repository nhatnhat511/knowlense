import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function AboutPage() {
  return (
    <main className="app-shell">
      <SiteHeader tag="About" navItems={[{ href: "/pricing", label: "Pricing" }, { href: "/contact", label: "Contact" }, { href: "/auth/sign-in", label: "Sign in" }]} />
      <section className="shell legal-surface">
        <h1 className="page-title">About Knowlense</h1>
        <p className="page-copy">
          Knowlense is a SaaS workflow for sellers on Teachers Pay Teachers. It focuses on keyword research, listing analysis,
          and structured opportunity tracking built on a website, Worker APIs, and a Chrome extension.
        </p>
        <div className="legal-card">
          <h2>What the product is solving</h2>
          <p className="page-copy">
            Sellers often switch between marketplace tabs, spreadsheets, manual notes, and disconnected tools. Knowlense is
            designed to keep research, account access, and extension actions inside one system.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
