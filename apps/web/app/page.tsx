import Link from "next/link";
import { PublicSiteHeader, SiteFooter } from "@/components/site/chrome";

const proofPoints = [
  {
    label: "Built for TPT",
    value: "Focused on product visibility",
    copy: "Every workflow is designed around improving how TPT products are found, reviewed, and improved."
  },
  {
    label: "Free to start",
    value: "Immediate product audits",
    copy: "Run core checks before paying, then unlock tracking and broader research when you need more depth."
  },
  {
    label: "Website + extension",
    value: "One connected workspace",
    copy: "Use the extension for fast product checks and the dashboard for account, billing, and workspace management."
  }
];

const featureModules = [
  {
    meta: "Extension",
    title: "SEO Health",
    copy: "Run a focused listing audit to review the signals that matter most for a stronger, clearer, more searchable product page."
  }
];

const workflowSteps = [
  {
    meta: "Step 1",
    title: "Open a TPT product",
    copy: "Launch the extension on any product page and start with a fast audit instead of jumping between tabs and notes."
  },
  {
    meta: "Step 2",
    title: "Run the right checks",
    copy: "Review listing health in one place with guidance that is easy to act on."
  },
  {
    meta: "Step 3",
    title: "Manage the workspace",
    copy: "Move into the dashboard when you want account management, billing controls, and a cleaner extension workflow."
  }
];

const checklist = [
  "Run SEO Health reviews in one focused panel",
  "Review TPT listing quality without leaving the product page",
  "Manage billing and extension access from one workspace"
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <PublicSiteHeader />

      <section className="shell hero-home">
        <div className="hero-copy-block hero-copy-clean">
          <span className="eyebrow hero-eyebrow">Built for Teachers Pay Teachers sellers</span>
          <h1 className="page-title hero-headline">Boost Your TPT Rankings and Sales with One Clear SEO Workspace.</h1>
          <p className="page-copy hero-copy-text">
            Knowlense helps TPT sellers audit listings, improve product-page quality, and manage extension access without
            juggling scattered tools.
          </p>

          <div className="hero-cta-row">
            <Link className="primary-button hero-primary" href="/auth/sign-up">
              Start Free
            </Link>
            <div className="hero-cta-note">
              <span>Free plan available.</span>
              <span>Upgrade when you need unlimited SEO Health audits.</span>
            </div>
          </div>
        </div>

        <aside className="hero-aside">
          <div className="hero-chip">Core extension checks</div>
          <ul className="hero-checklist">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="hero-stage">
        <div className="shell hero-stage-frame">
          <div className="stage-sidebar">
            <div className="stage-sidebar-title">Knowlense extension</div>
            <ul className="stage-sidebar-list">
              <li className="active">SEO Health</li>
              <li>Account</li>
            </ul>
          </div>

          <div className="stage-preview">
            <div className="stage-topbar">
              <span className="stage-pill">Live product check</span>
              <span className="stage-search">Product: Reading Comprehension Passages Bundle</span>
            </div>
            <div className="stage-table">
              <div className="stage-row heading">
                <span>Signal</span>
                <span>Status</span>
                <span>Coverage</span>
                <span>Next step</span>
              </div>
              <div className="stage-row">
                <span>Listing health review</span>
                <span>Needs work</span>
                <span>7 of 10</span>
                <span>Improve</span>
              </div>
              <div className="stage-row">
                <span>Media coverage</span>
                <span>Solid</span>
                <span>Preview + images</span>
                <span>Keep</span>
              </div>
            </div>
          </div>

          <div className="stage-note-card">
            <div className="stage-note-label">Recommended next move</div>
            <strong>Improve the remaining SEO Health checks, then rerun the audit to confirm the page is stronger.</strong>
            <p>Use the dashboard to manage subscription and extension access once your product workflow is in place.</p>
          </div>
        </div>
      </section>

      <section className="shell marketing-surface">
        <div className="hero-proof-grid">
          {proofPoints.map((point) => (
            <article className="metric-card" key={point.label}>
              <span className="metric-label">{point.label}</span>
              <strong className="metric-value">{point.value}</strong>
              <span className="metric-copy">{point.copy}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="shell modules-section">
        <div className="section-heading">
          <span className="section-label">Core Features</span>
          <h2 className="section-title">Everything on the page is built around the checks TPT sellers actually need.</h2>
          <p className="section-copy">
            Knowlense is not a generic SEO suite. It is a focused workflow for checking product pages, identifying gaps, and
            deciding what to improve next.
          </p>
        </div>

        <div className="module-grid">
          {featureModules.map((module) => (
            <article className="module-card" key={module.title}>
              <span className="module-meta">{module.meta}</span>
              <h3>{module.title}</h3>
              <p>{module.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell modules-section">
        <div className="section-heading compact">
          <span className="section-label">How It Works</span>
          <h2 className="section-title">A simpler path from product page review to ranking improvement.</h2>
          <p className="section-copy">
            Start with the extension, keep your account and billing on the website, and use one cleaner workflow for ongoing
            listing improvement.
          </p>
        </div>

        <div className="module-grid">
          {workflowSteps.map((step) => (
            <article className="module-card" key={step.title}>
              <span className="module-meta">{step.meta}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell marketing-surface">
        <div className="section-heading compact">
          <span className="section-label">Start Free</span>
          <h2 className="section-title">Run your first listing checks before you commit to Premium.</h2>
          <p className="section-copy">
            The free plan lets you use core audits inside the extension. Premium unlocks unlimited SEO Health usage and a more
            complete workflow for long-term growth.
          </p>
        </div>

        <div className="stack-row">
          <Link className="primary-button" href="/auth/sign-up">
            Create Free Account
          </Link>
          <Link className="secondary-button" href="/pricing">
            View Pricing
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
