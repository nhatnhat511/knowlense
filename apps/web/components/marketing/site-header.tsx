"use client";

import Link from "next/link";
import { BrainCircuit, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-18 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <span className="text-lg">Knowlense</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="/">Landing</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/auth">Login</Link>
        </nav>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : user ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/pricing">See pricing</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth">Login / Signup</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
