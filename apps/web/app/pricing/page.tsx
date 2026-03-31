"use client";

import {
  DEFAULT_PUBLIC_HEADER_TAG,
  DEFAULT_PUBLIC_NAV_ITEMS,
  DEFAULT_PUBLIC_PRIMARY_CTA,
  SiteFooter,
  SiteHeader
} from "@/components/site/chrome";
import { PricingSection } from "@/components/site/pricing-section";

export default function PricingPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag={DEFAULT_PUBLIC_HEADER_TAG}
        navItems={DEFAULT_PUBLIC_NAV_ITEMS}
        primaryCta={DEFAULT_PUBLIC_PRIMARY_CTA}
      />

      <section className="shell marketing-surface">
        <PricingSection />
      </section>

      <SiteFooter />
    </main>
  );
}
