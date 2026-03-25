import { PricingTable } from "@/components/marketing/pricing-table";

export default function PricingPage() {
  return (
    <main className="container py-16">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
        <h1 className="text-5xl font-semibold tracking-tight">Simple plans for a focused extension business.</h1>
        <p className="text-lg text-muted-foreground">
          Start free, then upgrade to unlock higher summary limits, richer sources, and premium support.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-5xl">
        <PricingTable />
      </div>
    </main>
  );
}
