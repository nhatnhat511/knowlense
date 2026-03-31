import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const lastUpdated = "March 31, 2026";

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
        <div className="legal-intro">
          <span className="section-label">Privacy Policy</span>
          <h1 className="page-title">Privacy Policy</h1>
          <p className="page-copy">
            This Privacy Policy explains what Knowlense collects, why it is collected, how it is used, and how it is shared
            when you use the website, dashboard, browser extension, and paid billing workflows.
          </p>
          <p className="legal-meta">
            Last updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <article className="legal-document">
          <section className="legal-section">
            <h2>1. Scope of this policy</h2>
            <p>
              This policy applies to the public website at <strong>knowlense.com</strong>, the logged-in dashboard, browser
              extension experiences, support interactions, and subscription-related billing activity.
            </p>
            <p>
              It does not govern third-party websites, marketplaces, payment pages, or browser stores that are operated
              independently of Knowlense, even when they are linked from the service.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Information we collect</h2>
            <ul className="policy-list">
              <li>
                <strong>Account information</strong>
                <span>
                  Name, email address, authentication identifiers, sign-in provider details, profile image, and account status
                  used to create and manage access.
                </span>
              </li>
              <li>
                <strong>Extension connection data</strong>
                <span>
                  Connected browser sessions, device labels, user agent details, request timestamps, and revocation history
                  needed to manage secure extension access.
                </span>
              </li>
              <li>
                <strong>Product and workspace data</strong>
                <span>
                  Keyword audit results, SEO Health runs, search indexing checks, tracked keyword records, and related
                  dashboard summaries created through normal use of the service.
                </span>
              </li>
              <li>
                <strong>Billing references</strong>
                <span>
                  Subscription plan, billing status, Paddle customer references, transaction references, renewal state, and
                  other billing metadata required to provision Premium access.
                </span>
              </li>
              <li>
                <strong>Support communications</strong>
                <span>
                  Messages, email headers, screenshots, and issue details you send when requesting help from Knowlense.
                </span>
              </li>
              <li>
                <strong>Technical and security data</strong>
                <span>
                  Basic logs, browser information, page requests, and anti-abuse signals used to secure the service and
                  diagnose failures.
                </span>
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. How information is used</h2>
            <ul className="policy-list">
              <li>
                <strong>To operate the service</strong>
                <span>Authenticate accounts, connect the extension, render dashboards, and provide the requested features.</span>
              </li>
              <li>
                <strong>To process subscriptions</strong>
                <span>Activate, maintain, renew, cancel, and support Free and Premium plans.</span>
              </li>
              <li>
                <strong>To protect the platform</strong>
                <span>Detect misuse, investigate suspicious activity, and enforce account and extension security controls.</span>
              </li>
              <li>
                <strong>To support users</strong>
                <span>Respond to support requests, troubleshoot account issues, and communicate service-related updates.</span>
              </li>
              <li>
                <strong>To improve Knowlense</strong>
                <span>Understand product reliability, prioritize fixes, and improve workflows based on actual usage patterns.</span>
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Service providers and infrastructure</h2>
            <ul className="policy-list">
              <li>
                <strong>Supabase</strong>
                <span>Used for account authentication, identity management, and related account session services.</span>
              </li>
              <li>
                <strong>Cloudflare</strong>
                <span>Used for website delivery, Workers-based application logic, storage, logging, and related infrastructure.</span>
              </li>
              <li>
                <strong>Paddle</strong>
                <span>
                  Acts as Merchant of Record for paid subscriptions and handles payment processing, taxes, billing, and related
                  payment data.
                </span>
              </li>
              <li>
                <strong>Browser platforms</strong>
                <span>
                  Chrome Web Store and Microsoft Edge Add-ons may separately process installation and browser store metadata
                  under their own policies.
                </span>
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Data sharing</h2>
            <p>Knowlense does not sell personal information.</p>
            <p>Information may be shared only in the following limited circumstances:</p>
            <ul className="policy-list">
              <li>
                <strong>With service providers</strong>
                <span>To operate authentication, infrastructure, billing, support, and security workflows.</span>
              </li>
              <li>
                <strong>For legal compliance</strong>
                <span>When disclosure is required by law, regulation, legal process, or enforceable governmental request.</span>
              </li>
              <li>
                <strong>To protect rights and safety</strong>
                <span>
                  When necessary to investigate abuse, enforce terms, or protect the service, users, or the public from harm.
                </span>
              </li>
              <li>
                <strong>In a business transfer</strong>
                <span>
                  If Knowlense is involved in a merger, acquisition, financing, or sale of assets, data may be transferred as
                  part of that transaction.
                </span>
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Data retention</h2>
            <p>
              Knowlense keeps information for as long as reasonably necessary to operate the service, maintain subscriptions,
              resolve disputes, enforce agreements, and comply with legal obligations.
            </p>
            <p>
              Some records, such as billing references, audit logs, or revoked session records, may be retained after account
              closure when required for security, accounting, fraud prevention, or legal compliance.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Security</h2>
            <p>
              Knowlense uses commercially reasonable administrative, technical, and organizational measures to protect account
              and service data. No internet-connected service can guarantee absolute security, and users remain responsible for
              protecting their devices, browser profiles, and account credentials.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. International processing</h2>
            <p>
              Knowlense and its service providers may process information in more than one country. By using the service, you
              understand that your information may be transferred to and processed in locations where privacy laws may differ
              from those in your jurisdiction.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Your choices</h2>
            <ul className="policy-list">
              <li>
                <strong>Profile updates</strong>
                <span>You may update certain account details, password settings, and connected sign-in methods from the dashboard.</span>
              </li>
              <li>
                <strong>Connected browsers</strong>
                <span>You may revoke extension browser sessions from the dashboard or disconnect the extension from the popup.</span>
              </li>
              <li>
                <strong>Subscription controls</strong>
                <span>You may manage plan changes, billing, and cancellation through the available billing flows.</span>
              </li>
              <li>
                <strong>Support requests</strong>
                <span>Privacy-related requests may be sent to <strong>support@knowlense.com</strong>.</span>
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>10. Children’s privacy</h2>
            <p>
              Knowlense is intended for business and professional users. It is not directed to children, and Knowlense does
              not knowingly collect personal information from children.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Changes to this policy</h2>
            <p>
              Knowlense may update this Privacy Policy from time to time. When material changes are made, the updated policy
              will be posted on this page with a revised “Last updated” date.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Contact</h2>
            <p>
              For privacy questions, data requests, or account concerns, contact <strong>support@knowlense.com</strong>.
            </p>
          </section>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
