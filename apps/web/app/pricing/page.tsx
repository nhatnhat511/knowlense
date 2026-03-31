"use client";

import {
  PublicSiteHeader,
  SiteFooter,
} from "@/components/site/chrome";
import { PricingSection } from "@/components/site/pricing-section";

export default function PricingPage() {
  return (
    <main className="app-shell">
      <PublicSiteHeader />

      <section className="shell marketing-surface">
        <PricingSection />
      </section>

      <SiteFooter />
    </main>
  );
}
