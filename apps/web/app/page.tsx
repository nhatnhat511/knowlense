import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const proofPoints = [
  {
    label: "Website-first auth",
    value: "No login form in the extension",
    copy: "Users authenticate on the web app first, then approve the extension from a dedicated connect flow."
  },
  {
    label: "Worker-owned logic",
    value: "API and scoring stay centralized",
    copy: "Core logic runs through Cloudflare Workers instead of being duplicated across the website and extension."
  },
  {
    label: "Focused workflow",
    value: "Built for TPT seller research",
    copy: "Knowlense is shaped around keyword discovery, listing quality, and opportunity tracking."
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

const workflow = [
  {
    step: "1",
    title: "Sign in on the website",
    copy: "Account creation, email verification, password resets, and billing all live in the web app."
  },
  {
    step: "2",
    title: "Connect the extension safely",
    copy: "The popup opens a secure connect flow so the extension gets its own Worker-issued session afterward."
  },
  {
    step: "3",
    title: "Run live TPT research",
    copy: "Use the extension while browsing TPT, then review recent analyses and next actions on the dashboard."
  }
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="TPT seller intelligence"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/about", label: "About" },
          { href: "/contact", label: "Contact" },
          { href: "/auth/sign-in", label: "Sign in" }
        ]}
        primaryCta={{ href: "/auth/sign-up", label: "Start free" }}
      />

      <section className="shell hero-simple">
        <div className="hero-copy-block">
          <span className="eyebrow">Built for Teachers Pay Teachers sellers</span>
          <h1 className="page-title hero-headline">One cleaner system for TPT research, account access, and extension workflows.</h1>
          <p className="page-copy hero-copy-text">
            Knowlense gives sellers a calmer way to work: website-first account management, secure extension connection, and
            structured insights from the marketplace pages they already review every day.
          </p>
          <div className="stack-row">
            <Link className="primary-button" href="/auth/sign-up">
              Create account
            </Link>
            <Link className="secondary-button" href="/pricing">
              View pricing
            </Link>
          </div>

          <div className="hero-proof-grid">
            {proofPoints.map((point) => (
              <article className="metric-card" key={point.label}>
                <span className="metric-label">{point.label}</span>
                <strong className="metric-value">{point.value}</strong>
                <span className="metric-copy">{point.copy}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="hero-panel-clean">
          <div>
            <div className="panel-kicker">What the product does well</div>
            <p className="page-copy">
              Knowlense is not trying to be a generic AI wrapper. It is a purpose-built workflow for TPT sellers who need
              clearer research, better account control, and less friction between the website and extension.
            </p>
          </div>

          <div className="hero-panel-stack">
            <ul className="hero-panel-list">
              <li>Account flows stay on the website where authentication belongs.</li>
              <li>The extension only receives a dedicated session after website approval.</li>
              <li>Keyword Finder results are captured from live TPT search pages, not invented lists.</li>
            </ul>
          </div>

          <div className="stack-row">
            <Link className="primary-button" href="/dashboard">
              Open app
            </Link>
            <Link className="ghost-button" href="/about">
              Learn more
            </Link>
          </div>
        </div>
      </section>

      <section className="shell modules-section">
        <div className="section-heading">
          <span className="section-label">Core Modules</span>
          <h2 className="section-title">Designed around real seller tasks, not disconnected feature ideas.</h2>
          <p className="section-copy">
            Each module is meant to support a concrete part of the seller workflow: what to research, what to improve, and
            what to build next.
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

      <section className="shell marketing-surface">
        <div className="section-heading">
          <span className="section-label">Workflow</span>
          <h2 className="section-title">A product flow that stays understandable as the product grows.</h2>
        </div>

        <div className="process-grid">
          {workflow.map((item) => (
            <article className="process-card" key={item.step}>
              <span className="process-step">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
