"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import logoKnowlense from "@/logo/logoknowlense.svg";

type BrandLockupProps = {
  href?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  centered?: boolean;
  iconOnly?: boolean;
  dark?: boolean;
  className?: string;
  trailing?: ReactNode;
};

function BrandIcon({
  size = 44,
  dark = false
}: {
  size?: number;
  dark?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center overflow-hidden" style={{ height: size, width: size }}>
      <Image
        alt="Knowlense logo"
        className="object-contain"
        priority
        sizes={`${size}px`}
        src={logoKnowlense}
      />
    </span>
  );
}

export function BrandLockup({
  href = "/",
  title = "Knowlense",
  subtitle,
  compact = false,
  centered = false,
  iconOnly = false,
  dark = false,
  className = "",
  trailing
}: BrandLockupProps) {
  const size = compact ? 44 : 52;

  return (
    <Link
      aria-label={`${title} home`}
      className={`inline-flex items-center gap-3 ${centered ? "justify-center" : ""} ${className}`.trim()}
      href={href}
    >
      <BrandIcon dark={dark} size={size} />
      {!iconOnly ? (
        <span className={`flex min-w-0 flex-col ${centered ? "items-center text-center" : ""}`}>
          <span
            className={`text-lg font-semibold tracking-[-0.02em] ${dark ? "text-white" : "text-black"}`}
            style={{ fontFamily: "var(--font-display), var(--font-sans), sans-serif" }}
          >
            {title}
          </span>
          {subtitle ? (
            <span className={`text-sm leading-5 ${dark ? "text-white/65" : "text-neutral-500"}`}>{subtitle}</span>
          ) : null}
        </span>
      ) : null}
      {trailing}
    </Link>
  );
}

export function BrandMarkOnly({
  centered = false,
  dark = false,
  size = 48,
  className = ""
}: {
  centered?: boolean;
  dark?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`${centered ? "flex justify-center" : ""} ${className}`.trim()}>
      <BrandIcon dark={dark} size={size} />
    </div>
  );
}
