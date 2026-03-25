import { AuthCard } from "@/components/auth/auth-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthPage() {
  return (
    <main className="container grid gap-8 py-16 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-border/70 bg-gradient-to-br from-slate-950 to-slate-900 text-white">
        <CardHeader>
          <CardTitle className="text-3xl">Knowlense account access</CardTitle>
          <CardDescription className="text-slate-300">
            Use Supabase Auth to manage email sign in, sign up, and future billing-aware account flows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-slate-300">
          <p>Client-side auth is enough to get your first SaaS flow live without blocking on backend session plumbing.</p>
          <p>Once billing is added, redirect users here from the extension popup to keep account management centralized.</p>
          <p>This page is the clean handoff between the Chrome extension and your website product surface.</p>
        </CardContent>
      </Card>

      <AuthCard />
    </main>
  );
}
