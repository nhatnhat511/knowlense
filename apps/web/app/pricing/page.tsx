"use client";

import Link from "next/link";
import { AppPanel, AppPanelTitle, AppShell } from "@/components/account/app-shell";
import { PricingSection } from "@/components/site/pricing-section";

export default function PricingPage() {
  return (
    <AppShell
      actions={
        <>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-50"
            href="/contact"
          >
            Contact sales
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href="/auth/sign-up"
          >
            Start free
          </Link>
        </>
      }
      subtitle="Choose the plan that matches your current stage. Start free, then upgrade through a Worker-created Paddle checkout when you are ready."
      title="Pricing"
    >
      <PricingSection />

      <div className="grid gap-6 lg:grid-cols-2">
        <AppPanel>
          <AppPanelTitle
            badge="Free plan"
            copy="The free tier is intentionally practical. It should be enough to verify the product workflow before you pay."
            title="What free is for"
          />
          <ul className="space-y-3 text-sm leading-6 text-neutral-600">
            <li className="rounded-[20px] border border-black/8 bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">Create a website account and verify the full sign-up flow.</li>
            <li className="rounded-[20px] border border-black/8 bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">Connect the extension for the first time and approve a browser session safely.</li>
            <li className="rounded-[20px] border border-black/8 bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">Evaluate whether Knowlense fits the way you research TPT listings.</li>
          </ul>
        </AppPanel>

        <AppPanel>
          <AppPanelTitle
            badge="Billing"
            copy="Billing stays separate from the website UI, but the plan selection and checkout session start here."
            title="Billing details"
          />
          <ul className="space-y-3 text-sm leading-6 text-neutral-600">
            <li className="rounded-[20px] border border-black/8 bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">Paddle handles subscription checkout, taxes, payment methods, and invoices.</li>
            <li className="rounded-[20px] border border-black/8 bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">Monthly and yearly checkout sessions are created by Cloudflare Workers using your configured Paddle price IDs.</li>
            <li className="rounded-[20px] border border-black/8 bg-white px-4 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">Refund and billing questions should reference the account email plus the Paddle transaction where possible.</li>
          </ul>
        </AppPanel>
      </div>
    </AppShell>
  );
}
