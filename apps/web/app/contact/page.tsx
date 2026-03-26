import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Contact</span>
            </span>
          </Link>
        </div>
      </header>
      <section className="shell legal-surface">
        <h1 className="page-title">Contact</h1>
        <p className="page-copy">For product, support, billing, or privacy questions, contact the Knowlense team at support@knowlense.com.</p>
      </section>
    </main>
  );
}
