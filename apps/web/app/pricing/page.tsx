"use client";

import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { PricingSection } from "@/components/site/pricing-section";

export default function PricingPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Pricing"
        navItems={[
          { href: "/about", label: "About" },
          { href: "/contact", label: "Contact" },
          { href: "/account", label: "Account" }
        ]}
      />

      <section className="shell marketing-surface">
        <PricingSection />

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">What free is for</h2>
            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                <span>Create an account and verify the website auth flow.</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                <span>Connect the extension for the first time.</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                <span>Evaluate whether the product fits your seller workflow.</span>
              </li>
            </ul>
          </article>

          <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Billing details</h2>
            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                <span>Paddle handles subscription checkout, invoices, taxes, and payment details.</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                <span>Monthly and yearly self-serve checkouts are created through Cloudflare Workers.</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                <span>Refund handling follows the policy published on the refund page and the linked Paddle transaction.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
