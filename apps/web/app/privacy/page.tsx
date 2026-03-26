import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function PrivacyPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Privacy Policy"
        navItems={[
          { href: "/terms", label: "Terms" },
          { href: "/refund-policy", label: "Refund policy" },
          { href: "/contact", label: "Contact" }
        ]}
      />

      <section className="shell legal-surface">
        <div className="section-heading">
          <span className="section-label">Privacy</span>
          <h1 className="page-title">Knowlense keeps the service stack understandable and the data categories limited.</h1>
          <p className="page-copy">
            Knowlense uses Supabase for authentication, Cloudflare Workers for application logic, Cloudflare D1 for product
            data, and Paddle for billing. The service should collect only the information needed to run the account, billing,
            and extension workflow.
          </p>
        </div>

        <div className="legal-grid">
          <article className="legal-card">
            <h2>What is collected</h2>
            <ul className="policy-list">
              <li>
                <strong>Account data</strong>
                <span>Email address, authentication-related identifiers, and account state required for sign in and recovery flows.</span>
              </li>
              <li>
                <strong>Product data</strong>
                <span>Keyword Finder runs, search snapshots, and extension connection records created through normal use of the service.</span>
              </li>
              <li>
                <strong>Billing references</strong>
                <span>Plan selection and Paddle transaction references needed to manage subscription-related support.</span>
              </li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>Service providers</h2>
            <ul className="policy-list">
              <li>
                <strong>Supabase</strong>
                <span>Handles user authentication and website account access.</span>
              </li>
              <li>
                <strong>Cloudflare</strong>
                <span>Hosts the web app, the Worker API, and D1-backed product data storage.</span>
              </li>
              <li>
                <strong>Paddle</strong>
                <span>Processes subscriptions, payment details, tax handling, and billing records.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
