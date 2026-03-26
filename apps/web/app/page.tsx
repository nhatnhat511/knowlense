import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

const productPoints = [
  "Analyze TPT search pages from a Chrome extension",
  "Store Keyword Finder runs in Cloudflare D1",
  "Keep authentication on the website, not inside the extension"
];

const modules = [
  {
    title: "Keyword Finder",
    copy: "Capture live search result pages from TPT and turn them into keyword opportunities with rule-based scoring."
  },
  {
    title: "Listing Grader",
    copy: "Audit titles, previews, and positioning directly where sellers already work inside TPT."
  },
  {
    title: "Opportunity Board",
    copy: "Save, review, and prioritize niche ideas without relying on disconnected spreadsheets."
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
        primaryCta={{ href: "/dashboard", label: "Open app" }}
      />

      <section className="shell hero-simple">
        <div className="hero-copy-block">
          <span className="eyebrow">Website-first auth. Worker-owned logic. D1-owned data.</span>
          <h1 className="page-title hero-headline">A cleaner SaaS workflow for TPT sellers.</h1>
          <p className="page-copy hero-copy-text">
            Knowlense is built as a focused product surface: authentication on the website, logic through Cloudflare
            Workers, and extension sessions that connect securely after web sign-in.
          </p>
          <div className="stack-row">
            <Link className="primary-button" href="/auth/sign-up">
              Create account
            </Link>
            <Link className="secondary-button" href="/dashboard">
              View dashboard
            </Link>
          </div>
        </div>
        <div className="hero-panel-clean">
          <div className="panel-kicker">What is ready now</div>
          <ul className="clean-list">
            {productPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="shell modules-section" id="modules">
        <div className="section-heading">
          <h2 className="section-title">Core product modules</h2>
          <p className="section-copy">
            The product is being built around actionable seller workflows, not generic marketing copy or AI filler.
          </p>
        </div>
        <div className="module-grid">
          {modules.map((module) => (
            <article className="module-card" key={module.title}>
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
