import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function TermsPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Terms of Service"
        navItems={[
          { href: "/privacy", label: "Privacy" },
          { href: "/refund-policy", label: "Refund policy" },
          { href: "/contact", label: "Contact" }
        ]}
      />

      <section className="shell legal-surface">
        <div className="section-heading">
          <span className="section-label">Terms</span>
          <h1 className="page-title">Use of Knowlense must respect both the product and the platforms being analyzed.</h1>
          <p className="page-copy">
            By using Knowlense, you agree to use the service lawfully, maintain control of your account and browser
            environment, and comply with the rules of any third-party platforms you analyze through the extension.
          </p>
        </div>

        <div className="legal-grid">
          <article className="legal-card">
            <h2>Account responsibilities</h2>
            <ul className="policy-list">
              <li>
                <strong>Credential control</strong>
                <span>You are responsible for protecting your website credentials and the browser profile used with the extension.</span>
              </li>
              <li>
                <strong>Accurate account details</strong>
                <span>You must provide and maintain an email address that can receive service and billing communications.</span>
              </li>
              <li>
                <strong>Session management</strong>
                <span>You are responsible for disconnecting or signing out from devices and browsers you no longer control.</span>
              </li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>Acceptable use</h2>
            <ul className="policy-list">
              <li>
                <strong>Respect third-party rules</strong>
                <span>Your use of the extension must comply with the terms, policies, and technical limits of the platforms you access.</span>
              </li>
              <li>
                <strong>No misuse</strong>
                <span>You may not use the service to abuse, disrupt, reverse-engineer, or attempt to bypass product safeguards.</span>
              </li>
              <li>
                <strong>Service changes</strong>
                <span>Knowlense may update product behavior, pricing, or access rules as the service evolves.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
