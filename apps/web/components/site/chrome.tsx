"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrandLockup } from "@/components/brand/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  tag: string;
  navItems?: NavItem[];
  primaryCta?: NavItem;
};

export const DEFAULT_PUBLIC_HEADER_TAG = "Boost Your TPT Rankings & Sales";
export const DEFAULT_PUBLIC_NAV_ITEMS: NavItem[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/auth/sign-in", label: "Login" }
];
export const DEFAULT_PUBLIC_PRIMARY_CTA: NavItem = { href: "/auth/sign-up", label: "Sign Up" };

export function SiteHeader({ tag, navItems = [], primaryCta }: SiteHeaderProps) {
  const pathname = usePathname();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [account, setAccount] = useState<{ initials: string; name: string | null; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      setAccount(null);
      return;
    }
    const client = supabase;
    let active = true;

    function normalizeAccount(session: Session | null) {
      const email = session?.user.email ?? "";
      const metadata = session?.user.user_metadata ?? {};
      const displayName =
        typeof metadata.display_name === "string"
          ? metadata.display_name
          : typeof metadata.full_name === "string"
            ? metadata.full_name
            : email.split("@")[0] || null;
      const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
      const initialsSource = (displayName ?? email).trim();
      const initials = initialsSource
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "A";

      return {
        initials,
        name: displayName || null,
        avatarUrl
      };
    }

    async function hydrate() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      setAccount(session ? normalizeAccount(session) : null);
      setAuthReady(true);
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      setAccount(session ? normalizeAccount(session) : null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
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

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  function handleMenuToggle() {
    setMenuOpen((current) => !current);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleMenuToggle();
    }
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => null);
    }
    window.location.href = "/";
  }

  const signedOutNavItems = navItems.filter((item) => !/sign in|login/i.test(item.label));
  const loginItem = navItems.find((item) => /sign in|login/i.test(item.label));
  const isSignedIn = authReady && Boolean(account);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="shell topbar" ref={menuRef}>
        <BrandLockup className="brand-lockup" compact subtitle={tag} />

        <nav aria-label="Primary navigation" className="nav nav-desktop">
          {(isSignedIn ? signedOutNavItems : navItems).map((item) => (
            <Link
              aria-current={pathname === item.href ? "page" : undefined}
              className={`nav-link${/sign in|login/i.test(item.label) ? " nav-link-utility" : " nav-link-text"}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          {isSignedIn ? (
            <>
              <Link aria-current={pathname === "/dashboard" ? "page" : undefined} className="nav-link nav-link-utility" href="/dashboard">
                Dashboard
              </Link>
              <div className="account-menu-shell" ref={accountMenuRef}>
                <button
                  aria-expanded={accountMenuOpen}
                  aria-label={account?.name ? `${account.name} account menu` : "Account menu"}
                  className="header-avatar"
                  onClick={() => setAccountMenuOpen((current) => !current)}
                  title={account?.name ?? "Account"}
                  type="button"
                >
                  {account?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={account?.name ?? "Account"} className="header-avatar-image" src={account.avatarUrl} />
                  ) : (
                    <span>{account?.initials ?? "A"}</span>
                  )}
                </button>
                {accountMenuOpen ? (
                  <div className="account-menu-dropdown">
                    <Link className="account-menu-item" href="/dashboard?section=account">
                      Account
                    </Link>
                    <Link className="account-menu-item" href="/dashboard?section=subscription">
                      Subscription
                    </Link>
                    <button className="account-menu-item account-menu-item-danger" onClick={() => void handleSignOut()} type="button">
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : primaryCta ? (
            <>
              {loginItem ? (
                <Link aria-current={pathname === loginItem.href ? "page" : undefined} className="nav-link nav-link-utility" href={loginItem.href}>
                  {loginItem.label}
                </Link>
              ) : null}
              <Link aria-current={pathname === primaryCta.href ? "page" : undefined} className="primary-button" href={primaryCta.href}>
                {primaryCta.label}
              </Link>
            </>
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
            {(isSignedIn ? signedOutNavItems : navItems).map((item) => (
              <Link
                aria-current={pathname === item.href ? "page" : undefined}
                className="mobile-menu-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            {isSignedIn ? (
              <>
                <Link aria-current={pathname === "/dashboard" ? "page" : undefined} className="mobile-menu-link" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="mobile-menu-link" href="/dashboard?section=account">
                  Account
                </Link>
              </>
            ) : primaryCta ? (
              <>
                {loginItem ? (
                  <Link aria-current={pathname === loginItem.href ? "page" : undefined} className="mobile-menu-link" href={loginItem.href}>
                    {loginItem.label}
                  </Link>
                ) : null}
                <Link aria-current={pathname === primaryCta.href ? "page" : undefined} className="primary-button" href={primaryCta.href}>
                  {primaryCta.label}
                </Link>
              </>
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
            <BrandLockup className="mb-4" compact dark subtitle="Boost Your TPT Rankings & Sales" />
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
