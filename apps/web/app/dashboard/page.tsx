import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardPage() {
  return (
    <main className="container py-16">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Dashboard</p>
        <h1 className="text-4xl font-semibold tracking-tight">User controls for the Knowlense extension.</h1>
        <p className="max-w-3xl text-muted-foreground">
          This is the application surface where authenticated users manage plans, sources, and extension settings.
        </p>
      </div>
      <DashboardShell />
    </main>
  );
}
