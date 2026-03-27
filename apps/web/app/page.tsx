import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const proofPoints = [
  {
    label: "Website-first auth",
    value: "Safer account flow",
    copy: "Users authenticate on the web app first, then approve the extension separately."
  },
  {
    label: "Worker-owned logic",
    value: "One central API layer",
    copy: "Core logic stays in Cloudflare Workers instead of being scattered across surfaces."
  },
  {
    label: "Focused workflow",
    value: "Built for TPT sellers",
    copy: "Research, listing review, and next actions stay connected in one product flow."
  }
];

const modules = [
  {
    meta: "Research",
    title: "Keyword Finder",
    copy: "Capture live TPT search pages and turn them into structured keyword opportunities with consistent scoring."
  },
  {
    meta: "Optimization",
    title: "Listing Grader",
    copy: "Review titles, previews, and positioning signals directly alongside the seller workflow."
  },
  {
    meta: "Decision making",
    title: "Opportunity Board",
    copy: "Keep promising ideas, adjacent niches, and next actions inside one workspace instead of loose notes."
  }
];

const checklist = [
  "Keep seller research in one cleaner workflow",
  "Connect web auth and extension usage without friction",
  "Turn marketplace observations into actual next steps"
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="TPT seller intelligence"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/about", label: "About" },
          { href: "/contact", label: "Contact Sales" },
          { href: "/auth/sign-in", label: "Login" }
        ]}
        primaryCta={{ href: "/auth/sign-up", label: "Sign Up" }}
      />

      <section className="shell hero-home">
        <div className="hero-copy-block hero-copy-clean">
          <span className="eyebrow hero-eyebrow">Built for Teachers Pay Teachers sellers</span>
          <h1 className="page-title hero-headline">One workspace for research, listings, and smarter seller decisions.</h1>
          <p className="page-copy hero-copy-text">
            Knowlense gives TPT sellers a cleaner SaaS workflow: website-first account management, secure extension
            connection, and structured product insight that stays useful after the browser tab closes.
          </p>

          <div className="hero-cta-row">
            <Link className="primary-button hero-primary" href="/auth/sign-up">
              Get started. It&apos;s free.
            </Link>
            <div className="hero-cta-note">
              <span>Free to start.</span>
              <span>No credit card required.</span>
            </div>
          </div>
        </div>

        <aside className="hero-aside">
          <div className="hero-chip">New: seller-side intelligence for TPT</div>
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
            <div className="stage-sidebar-title">Knowlense workspace</div>
            <ul className="stage-sidebar-list">
              <li className="active">Keyword Finder</li>
              <li>Listing Grader</li>
              <li>Opportunity Board</li>
              <li>Dashboard</li>
              <li>Extension Connect</li>
            </ul>
          </div>

          <div className="stage-preview">
            <div className="stage-topbar">
              <span className="stage-pill">Store Research</span>
              <span className="stage-search">Search query: reading comprehension</span>
            </div>
            <div className="stage-table">
              <div className="stage-row heading">
                <span>Keyword Cluster</span>
                <span>Competition</span>
                <span>Opportunity</span>
                <span>Status</span>
              </div>
              <div className="stage-row">
                <span>Main idea passages</span>
                <span>Medium</span>
                <span>High</span>
                <span>Review</span>
              </div>
              <div className="stage-row">
                <span>Paired reading passages</span>
                <span>Low</span>
                <span>High</span>
                <span>Promising</span>
              </div>
              <div className="stage-row">
                <span>Theme worksheets</span>
                <span>High</span>
                <span>Medium</span>
                <span>Saturated</span>
              </div>
            </div>
          </div>

          <div className="stage-note-card">
            <div className="stage-note-label">Next action</div>
            <strong>Build a differentiated paired-passage listing</strong>
            <p>Use the current search snapshot to create a higher-conviction product angle before competition thickens.</p>
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
          <span className="section-label">Core Modules</span>
          <h2 className="section-title">Purpose-built for the parts of the seller workflow that actually matter.</h2>
          <p className="section-copy">
            Knowlense is designed to help sellers research the market, sharpen listings, and turn signals into practical next
            moves.
          </p>
        </div>

        <div className="module-grid">
          {modules.map((module) => (
            <article className="module-card" key={module.title}>
              <span className="module-meta">{module.meta}</span>
              <h3>{module.title}</h3>
              <p>{module.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
