import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const lastUpdated = "March 31, 2026";

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
          <h1 className="page-title">These Terms govern access to the Knowlense website, dashboard, extension, and paid plans.</h1>
          <p className="page-copy">
            By creating an account, connecting the extension, or using any part of Knowlense, you agree to these Terms of
            Service. If you do not agree, do not use the service.
          </p>
          <p className="page-copy">
            Last updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="legal-grid">
          <article className="legal-card">
            <h2>1. About Knowlense</h2>
            <p>
              Knowlense provides research, listing analysis, SEO workflow, extension-based product insights, and related
              subscription services for Teachers Pay Teachers sellers and similar professional users.
            </p>
          </article>

          <article className="legal-card">
            <h2>2. Eligibility and account registration</h2>
            <ul className="policy-list">
              <li>
                <strong>Accurate information</strong>
                <span>You must provide truthful, current, and complete registration and billing information.</span>
              </li>
              <li>
                <strong>Account control</strong>
                <span>You are responsible for maintaining the confidentiality of your account credentials and browser access.</span>
              </li>
              <li>
                <strong>Authorized use</strong>
                <span>You may use Knowlense only for lawful business, professional, or personal workflow purposes.</span>
              </li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>3. Website and extension access</h2>
            <p>
              Knowlense uses a website-first account model. Extension access depends on an authorized website account session
              and may be approved, revoked, or disconnected at any time through the available account controls.
            </p>
            <p>
              You are responsible for devices, browser profiles, and extensions connected to your account. If you lose control
              of a device, revoke the relevant browser session immediately.
            </p>
          </article>

          <article className="legal-card">
            <h2>4. Acceptable use</h2>
            <ul className="policy-list">
              <li>
                <strong>Respect third-party rules</strong>
                <span>
                  You must comply with the terms, policies, technical restrictions, and marketplace rules of any third-party
                  services you access through Knowlense, including Teachers Pay Teachers, browser platforms, and billing
                  providers.
                </span>
              </li>
              <li>
                <strong>No abuse or interference</strong>
                <span>
                  You may not misuse the service, attempt to disrupt its operation, reverse engineer protected functionality,
                  bypass safeguards, or use automation in a way that violates applicable rules.
                </span>
              </li>
              <li>
                <strong>No unlawful use</strong>
                <span>
                  You may not use Knowlense to violate law, infringe rights, transmit harmful material, or interfere with the
                  security or reliability of any system.
                </span>
              </li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>5. Plans, billing, and renewals</h2>
            <p>
              Knowlense may offer Free and Premium plans. Premium access is billed on a recurring basis unless canceled before
              renewal.
            </p>
            <p>
              Paid subscriptions are billed through <strong>Paddle</strong>, which acts as Merchant of Record. Paddle handles
              payment processing, taxes, billing, and certain buyer communications related to paid plans.
            </p>
            <p>
              Pricing, plan limits, included features, and billing intervals may change from time to time. Changes do not
              affect charges already completed unless otherwise required by law.
            </p>
          </article>

          <article className="legal-card">
            <h2>6. Refunds and cancellations</h2>
            <p>
              Refund handling is governed by the Knowlense Refund Policy and Paddle’s role as Merchant of Record. Cancellation
              stops future renewals, but does not automatically create a refund for past charges unless specifically approved or
              required by law.
            </p>
          </article>

          <article className="legal-card">
            <h2>7. Product changes and availability</h2>
            <p>
              Knowlense may add, modify, suspend, or remove features, pricing, limits, integrations, or workflows at any time.
              The service may also experience interruptions, maintenance windows, or third-party dependency issues outside
              Knowlense’s control.
            </p>
          </article>

          <article className="legal-card">
            <h2>8. Intellectual property</h2>
            <p>
              Knowlense and its related software, website content, design elements, branding, and product workflows are
              protected by intellectual property laws. These Terms do not transfer any ownership rights to you.
            </p>
            <p>
              You retain ownership of your own content, support communications, and business materials, subject to the rights
              necessary for Knowlense to operate and support the service.
            </p>
          </article>

          <article className="legal-card">
            <h2>9. Feedback</h2>
            <p>
              If you provide feedback, suggestions, or product ideas, Knowlense may use them without restriction or obligation,
              unless otherwise agreed in writing.
            </p>
          </article>

          <article className="legal-card">
            <h2>10. Suspension and termination</h2>
            <p>
              Knowlense may suspend or terminate access if these Terms are violated, if payment obligations are not met, if a
              third-party platform restriction requires action, or if continued access would create legal, security, or abuse
              risks.
            </p>
            <p>
              You may stop using the service at any time. Subscription cancellations affect future renewal behavior but may not
              delete historical records immediately.
            </p>
          </article>

          <article className="legal-card">
            <h2>11. Disclaimers</h2>
            <p>
              Knowlense is provided on an “as is” and “as available” basis to the fullest extent permitted by law. Knowlense
              does not guarantee uninterrupted availability, perfect accuracy, search engine outcomes, marketplace rankings, or
              any particular commercial result.
            </p>
          </article>

          <article className="legal-card">
            <h2>12. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, Knowlense will not be liable for indirect, incidental, special,
              consequential, exemplary, or punitive damages, or for loss of profits, revenues, goodwill, data, or business
              opportunities arising from or related to the service.
            </p>
          </article>

          <article className="legal-card">
            <h2>13. Changes to these Terms</h2>
            <p>
              Knowlense may revise these Terms from time to time. Continued use of the service after updated Terms are posted
              means you accept the revised version.
            </p>
          </article>

          <article className="legal-card">
            <h2>14. Contact</h2>
            <p>
              Questions about these Terms may be sent to <strong>support@knowlense.com</strong>.
            </p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
