import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function ContactPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Contact"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/about", label: "About" },
          { href: "/account", label: "Account" }
        ]}
      />

      <section className="shell marketing-surface">
        <div className="section-heading">
          <span className="section-label">Contact</span>
          <h1 className="page-title">Reach Knowlense support with the details needed to actually resolve the issue.</h1>
          <p className="page-copy">
            For product questions, account issues, privacy requests, or billing follow-up, contact the team at
            support@knowlense.com and include the account email tied to the issue.
          </p>
        </div>

        <div className="contact-grid">
          <article className="contact-card">
            <h2>What to include</h2>
            <ul className="contact-list">
              <li>
                <strong>Account email</strong>
                <span>The email used on the website helps us trace authentication, billing, and extension records.</span>
              </li>
              <li>
                <strong>Relevant flow</strong>
                <span>Tell us whether the issue happened during sign in, verify email, connect extension, checkout, or a dashboard action.</span>
              </li>
              <li>
                <strong>Useful context</strong>
                <span>Include screenshots, timestamps, and the page you were on so the report is actionable.</span>
              </li>
            </ul>
          </article>

          <article className="contact-card">
            <h2>Common request types</h2>
            <ul className="contact-list">
              <li>
                <strong>Access and security</strong>
                <span>Problems with sign in, verification emails, password recovery, or session state.</span>
              </li>
              <li>
                <strong>Billing and subscriptions</strong>
                <span>Questions about plan selection, Paddle checkout, invoices, or refunds.</span>
              </li>
              <li>
                <strong>Privacy and account data</strong>
                <span>Requests related to your stored information, account ownership, or service policies.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
