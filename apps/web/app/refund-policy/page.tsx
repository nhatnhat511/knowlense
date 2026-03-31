import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const lastUpdated = "March 31, 2026";

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
          <h1 className="page-title">Knowlense explains when refunds may be considered and how billing issues should be handled.</h1>
          <p className="page-copy">
            Knowlense subscriptions are billed through <strong>Paddle</strong>, which acts as Merchant of Record. Paddle is
            responsible for payment processing, billing, taxes, charge handling, and certain refund decisions.
          </p>
          <p className="page-copy">
            Last updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="legal-grid">
          <article className="legal-card">
            <h2>1. Billing provider</h2>
            <p>
              All paid subscriptions are sold and billed by Paddle as Merchant of Record. This means Paddle processes your
              payment, issues the charge, and may review or process refunds according to Paddle’s own policies and buyer terms.
            </p>
          </article>

          <article className="legal-card">
            <h2>2. Refund eligibility</h2>
            <p>
              Refund requests are not automatically granted. Requests may be reviewed case by case for situations such as:
            </p>
            <ul className="policy-list">
              <li>
                <strong>Accidental duplicate charges</strong>
                <span>The same subscription or transaction was charged more than once by mistake.</span>
              </li>
              <li>
                <strong>Confirmed billing errors</strong>
                <span>The charged amount, plan, or renewal event does not match the intended billing record.</span>
              </li>
              <li>
                <strong>Unauthorized charges</strong>
                <span>There is a legitimate indication that a payment was made without the account holder’s authorization.</span>
              </li>
            </ul>
            <p>
              Except where required by law, general dissatisfaction, unused time remaining in a billing period, or cancellation
              after renewal do not automatically qualify for a refund.
            </p>
          </article>

          <article className="legal-card">
            <h2>3. How to request a refund</h2>
            <p>
              You may contact Paddle directly through <strong>paddle.net</strong> or email <strong>support@knowlense.com</strong>
              {" "}for assistance.
            </p>
            <p>To help resolve a request quickly, include:</p>
            <ul className="policy-list">
              <li>
                <strong>Purchase email</strong>
                <span>The email address used for the transaction or subscription.</span>
              </li>
              <li>
                <strong>Order reference</strong>
                <span>The Paddle receipt, transaction ID, or other billing reference if available.</span>
              </li>
              <li>
                <strong>Charge details</strong>
                <span>The charge date, amount, and a short explanation of the issue.</span>
              </li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>4. Processing times</h2>
            <p>
              Approved refunds are returned to the original payment method. Processing times depend on Paddle, the payment
              method used, banking systems, and card issuer timelines. Card refunds often appear within a few business days,
              while some payment methods may take longer.
            </p>
          </article>

          <article className="legal-card">
            <h2>5. Subscription cancellation</h2>
            <p>
              Canceling a subscription prevents future renewals. Cancellation does not automatically issue a refund for prior
              charges unless a refund is separately approved or required by law.
            </p>
          </article>

          <article className="legal-card">
            <h2>6. Chargebacks and disputes</h2>
            <p>
              If a payment dispute or chargeback is initiated, Knowlense and Paddle may request additional information to
              investigate the matter. Initiating a chargeback may affect subscription access while the dispute is being
              reviewed.
            </p>
          </article>

          <article className="legal-card">
            <h2>7. Policy updates</h2>
            <p>
              Knowlense may update this Refund Policy from time to time. The most current version will always be posted on this
              page with a revised “Last updated” date.
            </p>
          </article>

          <article className="legal-card">
            <h2>8. Contact</h2>
            <p>
              For refund-related questions, billing assistance, or invoice issues, contact <strong>support@knowlense.com</strong>.
            </p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
