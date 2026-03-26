import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function RefundPolicyPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Refund Policy"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/terms", label: "Terms" },
          { href: "/contact", label: "Contact" }
        ]}
      />

      <section className="shell legal-surface">
        <div className="section-heading">
          <span className="section-label">Refunds</span>
          <h1 className="page-title">Refund handling should be clear before a user enters checkout.</h1>
          <p className="page-copy">
            Monthly and yearly subscriptions are billed through Paddle. Refund requests should be sent to
            support@knowlense.com with the billing email and any relevant transaction details.
          </p>
        </div>

        <div className="legal-grid">
          <article className="legal-card">
            <h2>How requests are reviewed</h2>
            <ul className="policy-list">
              <li>
                <strong>Transaction context</strong>
                <span>Requests are reviewed against the Paddle transaction record and the subscription timeline tied to your account.</span>
              </li>
              <li>
                <strong>Account state</strong>
                <span>Support may check whether the account and the relevant plan were active when the request was submitted.</span>
              </li>
              <li>
                <strong>Supporting information</strong>
                <span>Including the billing email and any related screenshots helps resolve the request faster.</span>
              </li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>Before you request a refund</h2>
            <ul className="policy-list">
              <li>
                <strong>Check the pricing page</strong>
                <span>Make sure the selected plan and billing interval match what you intended to purchase.</span>
              </li>
              <li>
                <strong>Check support options</strong>
                <span>If the issue is access-related, support may be able to fix the product problem without a refund path.</span>
              </li>
              <li>
                <strong>Use the correct account email</strong>
                <span>Support should be able to match the request to the actual subscription record.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
