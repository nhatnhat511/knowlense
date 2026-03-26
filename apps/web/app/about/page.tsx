import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">About</span>
            </span>
          </Link>
        </div>
      </header>
      <section className="shell legal-surface">
        <h1 className="page-title">About Knowlense</h1>
        <p className="page-copy">
          Knowlense is a SaaS workflow for sellers on Teachers Pay Teachers. It focuses on keyword research, listing analysis,
          and structured opportunity tracking built on a website, Worker APIs, and a Chrome extension.
        </p>
      </section>
    </main>
  );
}
