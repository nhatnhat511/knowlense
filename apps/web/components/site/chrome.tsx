"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandLockup } from "@/components/brand/brand";

type NavItem = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  tag: string;
  navItems?: NavItem[];
  primaryCta?: NavItem;
};

export function SiteHeader({ tag, navItems = [], primaryCta }: SiteHeaderProps) {
  const pathname = usePathname();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }

      if (event.key === "Tab") {
        window.setTimeout(() => {
          if (!menuRef.current?.contains(document.activeElement)) {
            setMenuOpen(false);
          }
        }, 0);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function handleMenuToggle() {
    setMenuOpen((current) => !current);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleMenuToggle();
    }
  }

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="shell topbar" ref={menuRef}>
        <BrandLockup className="brand-lockup" compact subtitle={tag} />

        <nav aria-label="Primary navigation" className="nav nav-desktop">
          {navItems.map((item) => (
            <Link
              aria-current={pathname === item.href ? "page" : undefined}
              className={`nav-link${/sign in|login/i.test(item.label) ? " nav-link-utility" : " nav-link-text"}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          {primaryCta ? (
            <Link aria-current={pathname === primaryCta.href ? "page" : undefined} className="primary-button" href={primaryCta.href}>
              {primaryCta.label}
            </Link>
          ) : null}
        </nav>

        <button
          aria-controls={menuId}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="menu-button"
          onClick={handleMenuToggle}
          onKeyDown={handleMenuKeyDown}
          type="button"
        >
          <span className="menu-button-bar" />
          <span className="menu-button-bar" />
          <span className="menu-button-bar" />
        </button>

        <div aria-label="Mobile navigation" className={`mobile-menu${menuOpen ? " open" : ""}`} id={menuId}>
          <nav className="mobile-menu-list">
            {navItems.map((item) => (
              <Link
                aria-current={pathname === item.href ? "page" : undefined}
                className="mobile-menu-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            {primaryCta ? (
              <Link aria-current={pathname === primaryCta.href ? "page" : undefined} className="primary-button" href={primaryCta.href}>
                {primaryCta.label}
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer site-footer-dark">
      <div className="shell footer-shell">
        <div className="footer-grid">
          <div>
            <BrandLockup className="mb-4" compact dark subtitle="TPT seller intelligence" />
            <p className="footer-copy">
              Knowlense helps Teachers Pay Teachers sellers move from scattered research to a structured workflow across the
              website and Chrome extension.
            </p>
            <a className="footer-inline-link" href="mailto:support@knowlense.com">
              support@knowlense.com
            </a>
          </div>
          <div>
            <div className="footer-list-title">Product</div>
            <div className="footer-links">
              <Link href="/pricing">Pricing</Link>
              <Link href="/about">About</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/account">Account</Link>
            </div>
          </div>
          <div>
            <div className="footer-list-title">Company</div>
            <div className="footer-links">
              <Link href="/contact">Contact</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms &amp; Condition</Link>
              <Link href="/refund-policy">Refund policy</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">© {currentYear} Knowlense. All rights reserved.</p>
          <div className="footer-meta-links">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Condition</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
