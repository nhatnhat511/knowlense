import Link from "next/link";

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
  return (
    <header className="site-header">
      <div className="shell topbar">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">K</span>
          <span className="brand">
            <span className="brand-name">Knowlense</span>
            <span className="brand-tag">{tag}</span>
          </span>
        </Link>
        <nav className="nav">
          {navItems.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          {primaryCta ? (
            <Link className="primary-button" href={primaryCta.href}>
              {primaryCta.label}
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="shell site-footer">
      <div className="footer-grid">
        <div>
          <div className="footer-title">Knowlense</div>
          <p className="footer-copy">
            Website-first authentication, Worker-owned logic, and extension workflows built for TPT sellers.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund-policy">Refund policy</Link>
        </div>
      </div>
    </footer>
  );
}
