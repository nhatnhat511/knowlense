"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  legal?: ReactNode;
};

export function AuthLogoMark({ className = "mb-8 flex justify-center" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="grid h-10 w-10 grid-cols-2 gap-1 rounded-full bg-black p-1.5">
        <span className="rounded-full bg-white" />
        <span className="rounded-full bg-white" />
        <span className="rounded-full bg-white" />
        <span className="rounded-full bg-white" />
      </div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children, footer, legal }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-12 text-[#171717]">
      <AuthLogoMark />

      <section className="mx-auto w-full max-w-[420px] rounded-[22px] border border-black/10 bg-white px-6 py-8 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_30px_rgba(0,0,0,0.04)] sm:px-7">
        <div className="mb-7 text-center">
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-black">{title}</h1>
          {subtitle ? <p className="mt-3 text-base leading-7 text-neutral-600">{subtitle}</p> : null}
        </div>

        {children}

        {footer ? <div className="mt-6 border-t border-black/8 pt-5 text-center text-[15px] text-neutral-600">{footer}</div> : null}
      </section>

      {legal ? <div className="mx-auto mt-7 max-w-[420px] text-center text-[15px] leading-7 text-neutral-500">{legal}</div> : null}
    </main>
  );
}

export function AuthSocialButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-black/12 bg-white px-4 text-[17px] font-medium text-black transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="my-7 flex items-center gap-4">
      <div className="h-px flex-1 bg-black/10" />
      <span className="text-sm text-neutral-500">or</span>
      <div className="h-px flex-1 bg-black/10" />
    </div>
  );
}

export function AuthField({
  id,
  label,
  hint,
  error,
  input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[15px] font-medium text-black" htmlFor={id}>
        {label}
      </label>
      {input}
      {hint ? <p className="text-[15px] text-neutral-500">{hint}</p> : null}
      {error ? <p className="text-[14px] text-red-600">{error}</p> : null}
    </div>
  );
}

export function AuthTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="font-medium text-black underline underline-offset-4 transition hover:text-neutral-700" href={href}>
      {children}
    </Link>
  );
}

export function AuthPasswordToggleIcon({ visible }: { visible: boolean }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M2 12c1.9-3.6 5.4-6 10-6s8.1 2.4 10 6c-1.9 3.6-5.4 6-10 6s-8.1-2.4-10-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      {!visible ? (
        <path d="M4 4l16 16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      ) : null}
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.35 11.1H12v2.98h5.36c-.23 1.52-1.13 2.81-2.41 3.68v2.43h3.9c2.28-2.1 3.5-5.18 3.5-8.84 0-.76-.07-1.51-.2-2.25Z"
        fill="#4285F4"
      />
      <path
        d="M12 21.8c2.68 0 4.94-.89 6.59-2.42l-3.9-2.43c-1.08.73-2.46 1.17-4.13 1.17-3.18 0-5.88-2.15-6.84-5.03H-.34v2.58A9.94 9.94 0 0 0 12 21.8Z"
        fill="#34A853"
      />
      <path
        d="M5.16 13.09A5.98 5.98 0 0 1 4.82 11.1c0-.69.12-1.36.34-1.99V6.53H-.34A9.94 9.94 0 0 0-1.4 11.1c0 1.6.38 3.11 1.06 4.57l3.5-2.58Z"
        fill="#FBBC04"
      />
      <path
        d="M12 4.08c1.46 0 2.77.5 3.8 1.49l2.84-2.84C16.93 1.17 14.67.2 12 .2A9.94 9.94 0 0 0-.34 6.53l3.5 2.58c.96-2.88 3.66-5.03 6.84-5.03Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.3 9.4 7.88 10.93.58.1.79-.25.79-.56 0-.28-.01-1.2-.02-2.18-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.87 10.87 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.73.81 1.17 1.83 1.17 3.09 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.2.67.8.56a11.53 11.53 0 0 0 7.87-10.93C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}
