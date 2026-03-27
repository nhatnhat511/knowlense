"use client";

import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { PricingSection } from "@/components/site/pricing-section";

export default function PricingPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="TPT seller intelligence"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/about", label: "About" },
          { href: "/contact", label: "Contact" },
          { href: "/auth/sign-in", label: "Sign in" }
        ]}
        primaryCta={{ href: "/auth/sign-up", label: "Start free" }}
      />

      <section className="shell marketing-surface">
        <PricingSection />
      </section>

      <SiteFooter />
    </main>
  );
}
