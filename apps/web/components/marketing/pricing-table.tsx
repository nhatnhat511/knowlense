import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    name: "Monthly",
    price: "$4.99",
    cadence: "/month",
    label: "Flexible billing",
    cta: "Choose monthly"
  },
  {
    name: "Yearly",
    price: "$41.90",
    cadence: "/year",
    label: "Save over monthly",
    cta: "Choose yearly",
    featured: true
  }
];

const rows = [
  ["Summaries per month", "500", "Unlimited fair use"],
  ["Priority source retrieval", "No", "Yes"],
  ["Whitelist / blacklist controls", "Yes", "Yes"],
  ["Account sync across devices", "Yes", "Yes"],
  ["Priority support", "No", "Email priority"]
];

export function PricingTable() {
  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.featured ? "border-primary/30 bg-sky-50/60" : "border-border/70 bg-white/90"}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.label}</CardDescription>
                </div>
                {plan.featured ? <Badge>Best value</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                <span className="pb-1 text-sm text-muted-foreground">{plan.cadence}</span>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Access the full Knowlense extension dashboard
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Wikipedia and web-source summary pipeline
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  Ready to connect to Stripe checkout
                </li>
              </ul>
              <Button className="w-full">{plan.cta}</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-border/70 bg-white/95">
        <div className="grid grid-cols-3 border-b border-border bg-muted/40 px-6 py-4 text-sm font-semibold">
          <div>Feature</div>
          <div>Free</div>
          <div>Premium</div>
        </div>
        <div className="divide-y divide-border">
          {rows.map(([feature, free, premium]) => (
            <div key={feature} className="grid grid-cols-3 px-6 py-4 text-sm">
              <div className="font-medium">{feature}</div>
              <div className="text-muted-foreground">{free}</div>
              <div className="font-medium text-foreground">{premium}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
