import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Privacy Policy</span>
            </span>
          </Link>
        </div>
      </header>
      <section className="shell legal-surface">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-copy">
          Knowlense uses Supabase for authentication, Cloudflare Workers for API processing, Cloudflare D1 for application
          data, and Paddle for subscription billing. Only the minimum data required to operate the service is collected.
        </p>
      </section>
    </main>
  );
}
