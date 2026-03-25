import { Globe2, LockKeyhole, Receipt, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Auth that matches your SaaS",
    description: "Supabase email auth is wired for client-side sign in and sign up flows.",
    icon: LockKeyhole
  },
  {
    title: "Billing-friendly pricing page",
    description: "Monthly and yearly plans are laid out for immediate Stripe or Lemon Squeezy integration.",
    icon: Receipt
  },
  {
    title: "Extension-aware settings",
    description: "Whitelist, blacklist, source preferences, and future quota controls fit naturally in the dashboard.",
    icon: SlidersHorizontal
  },
  {
    title: "Cloudflare deployment path",
    description: "Scripts and config are included so the app can be built for Cloudflare Pages.",
    icon: Globe2
  }
];

export function FeatureGrid() {
  return (
    <section className="container pb-20">
      <div className="mb-10 max-w-2xl space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight">Built for a real extension business, not a demo.</h2>
        <p className="text-muted-foreground">
          The project structure is ready for product marketing, user onboarding, and authenticated settings from the
          first commit.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <Card key={feature.title} className="border-border/70 bg-white/90">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Ship the website and extension as separate surfaces with a shared identity and consistent SaaS
                language.
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
