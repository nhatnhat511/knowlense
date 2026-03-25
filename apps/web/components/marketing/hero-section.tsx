import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const proofPoints = [
  "Wikipedia summaries in one selection",
  "Supabase-powered user accounts",
  "Extension-ready usage and billing paths"
];

export function HeroSection() {
  return (
    <section className="container grid gap-12 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div className="space-y-8">
        <Badge className="w-fit">SaaS knowledge layer for the browser</Badge>
        <div className="space-y-5">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Turn highlighted text into clear context, without breaking your flow.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Knowlense gives your Chrome extension a polished SaaS front door: pricing, auth, onboarding, and a
            dashboard that feels production-ready from day one.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/auth">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          {proofPoints.map((point) => (
            <div key={point} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden border-white/70 bg-white">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Live product snapshot</p>
              <h2 className="mt-1 text-2xl font-semibold">SaaS-ready extension stack</h2>
            </div>
            <div className="rounded-full bg-secondary p-3">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-border bg-muted/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">Selection intelligence</span>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-sm leading-6 text-muted-foreground">
                  "Artificial intelligence is intelligence demonstrated by machines..."
                </p>
                <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
                  Summary: AI is the capability of machines to perform tasks that typically require human
                  intelligence.
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-border bg-white p-5">
                <p className="text-sm text-muted-foreground">Conversion-ready pricing</p>
                <p className="mt-2 text-3xl font-semibold">$4.99/mo</p>
                <p className="mt-2 text-sm text-muted-foreground">Premium unlocks higher limits and better sources.</p>
              </div>
              <div className="rounded-3xl border border-border bg-white p-5">
                <p className="text-sm text-muted-foreground">Dashboard controls</p>
                <p className="mt-2 text-3xl font-semibold">Whitelist domains</p>
                <p className="mt-2 text-sm text-muted-foreground">Fine-tune where the extension appears.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
