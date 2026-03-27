"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthLogoMark } from "@/components/auth/auth-shell";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pricing", label: "Pricing" },
  { href: "/account", label: "Account" }
];

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-6 text-[#171717] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-black/8 bg-white/90 px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03),0_18px_45px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="shrink-0 scale-[0.82]">
              <AuthLogoMark className="flex justify-center" />
            </div>
            <div className="-ml-2">
              <Link className="text-lg font-semibold tracking-[-0.04em] text-black" href="/">
                Knowlense
              </Link>
              <div className="text-sm text-neutral-500">Website account and billing workspace</div>
            </div>
          </div>

          <nav aria-label="App navigation" className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition ${
                    active ? "bg-black text-white" : "bg-white text-neutral-700 hover:bg-neutral-100 hover:text-black"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.055em] text-black sm:text-5xl">{title}</h1>
              {subtitle ? <p className="mt-3 text-[17px] leading-7 text-neutral-600">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}

export function AppPanel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03),0_18px_45px_rgba(0,0,0,0.04)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function AppPanelTitle({
  title,
  copy,
  badge
}: {
  title: string;
  copy?: string;
  badge?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.04em] text-black">{title}</h2>
        {copy ? <p className="mt-2 max-w-2xl text-[15px] leading-6 text-neutral-600">{copy}</p> : null}
      </div>
      {badge ? (
        <span className="inline-flex h-8 items-center rounded-full border border-black/10 bg-neutral-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export function AppMenuLink({
  href,
  label,
  description,
  danger
}: {
  href: string;
  label: string;
  description?: string;
  danger?: boolean;
}) {
  return (
    <Link
      className={`flex items-center justify-between rounded-[20px] border px-4 py-4 transition ${
        danger
          ? "border-red-100 bg-red-50 text-red-700 hover:border-red-200 hover:bg-red-100"
          : "border-black/8 bg-white text-black hover:border-black/12 hover:bg-neutral-50"
      }`}
      href={href}
    >
      <div>
        <div className="text-base font-medium">{label}</div>
        {description ? <div className="mt-1 text-sm text-neutral-500">{description}</div> : null}
      </div>
      <span className="text-lg leading-none">↗</span>
    </Link>
  );
}
