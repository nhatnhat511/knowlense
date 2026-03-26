import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Terms of Service</span>
            </span>
          </Link>
        </div>
      </header>
      <section className="shell legal-surface">
        <h1 className="page-title">Terms of Service</h1>
        <p className="page-copy">
          By using Knowlense, you agree not to misuse the service, to keep account credentials secure, and to comply with the
          policies of any third-party platforms you analyze through the extension.
        </p>
      </section>
    </main>
  );
}
