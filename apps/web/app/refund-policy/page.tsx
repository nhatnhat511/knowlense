import Link from "next/link";

export default function RefundPolicyPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">Refund Policy</span>
            </span>
          </Link>
        </div>
      </header>
      <section className="shell legal-surface">
        <h1 className="page-title">Refund Policy</h1>
        <p className="page-copy">
          Monthly and yearly subscriptions are billed through Paddle. Refund requests should be submitted to support@knowlense.com
          with your billing email and the relevant transaction details.
        </p>
      </section>
    </main>
  );
}
