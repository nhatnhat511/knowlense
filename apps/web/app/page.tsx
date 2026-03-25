import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { HeroSection } from "@/components/marketing/hero-section";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <FeatureGrid />

      <section className="container pb-20">
        <div className="rounded-[2rem] border border-border/70 bg-slate-950 px-8 py-14 text-white shadow-soft">
          <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Launch checklist</p>
              <h2 className="text-3xl font-semibold tracking-tight">Ship the web layer before you scale the extension.</h2>
              <p className="max-w-2xl text-slate-300">
                The structure includes App Router pages, Supabase auth wiring, and Cloudflare-friendly build scripts.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg">
              <Link href="/dashboard">
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
