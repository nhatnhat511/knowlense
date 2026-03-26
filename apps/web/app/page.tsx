import Link from "next/link";

const features = [
  {
    title: "Listing Grader",
    copy: "Audit title structure, first-screen copy, preview coverage, and conversion friction while you edit a TPT product.",
    bullets: ["Title and tag score", "Thumbnail and preview checks", "Action-first optimization notes"]
  },
  {
    title: "Keyword Finder",
    copy: "Capture the language sellers use on live TPT search pages and turn it into an organized opportunity map.",
    bullets: ["Keyword clusters", "Intent tagging", "Repeatable niche research"]
  },
  {
    title: "Market Gap Board",
    copy: "Highlight saturated topics, underserved grades, and likely bundle opportunities without spreadsheet sprawl.",
    bullets: ["Gap summaries", "Opportunity backlog", "Expansion ideas for each niche"]
  }
];

const plans = [
  {
    title: "Starter",
    price: "$0",
    copy: "For testing the extension, auth flow, and base dashboard.",
    bullets: ["Extension popup", "Website account", "Manual keyword board"]
  },
  {
    title: "Pro",
    price: "$29",
    copy: "The first real SaaS tier for active TPT sellers.",
    bullets: ["Listing grader", "Keyword suggestions", "Saved opportunities"],
    featured: true
  },
  {
    title: "Studio",
    price: "$79",
    copy: "For sellers with VAs, larger catalogs, and a repeatable optimization workflow.",
    bullets: ["Multi-seat access", "Priority sync jobs", "Expansion planning"]
  }
];

export default function HomePage() {
  return (
    <main className="shell page-grid">
      <header className="topbar">
        <Link href="/" className="brand">
          Knowlense
        </Link>
        <nav className="nav">
          <a className="pill" href="#features">
            Features
          </a>
          <a className="pill" href="#pricing">
            Pricing
          </a>
          <Link className="ghost-button" href="/auth">
            Sign in
          </Link>
          <Link className="primary-button" href="/dashboard">
            Open app
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="panel hero-copy">
          <div className="eyebrow">Chrome extension + SaaS workflow for TPT sellers</div>
          <h1>See what your listings are missing before revenue does.</h1>
          <p>
            Knowlense gives TPT sellers a cleaner operating system: audit listings in-place, collect market signals,
            and track what to fix next from a dedicated SaaS dashboard.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/auth">
              Start with your account
            </Link>
            <a className="secondary-button" href="#features">
              Explore the MVP
            </a>
          </div>
        </div>

        <div className="panel hero-metrics">
          <div className="metric-card">
            <div className="metric-label">Primary outcome</div>
            <div className="metric-value">Recover underperforming listings</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Chrome extension focus</div>
            <div className="metric-value">Popup, auth, and seller-side analysis</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Cloudflare split</div>
            <div className="metric-value">Pages for UI, Workers for logic</div>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-header">
          <div>
            <div className="section-title">Built for the first usable release</div>
            <p className="section-copy">
              The initial stack is optimized for quick deployment: static frontend, Worker API, Supabase auth, Paddle
              billing, and a popup-first extension experience.
            </p>
          </div>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p className="muted">{feature.copy}</p>
              <ul className="feature-list">
                {feature.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="section-header">
          <div>
            <div className="section-title">Pricing rails are wired for Paddle</div>
            <p className="section-copy">
              The page is ready for your Paddle checkout integration on the Worker side. Right now it communicates the
              tier structure clearly while the subscription APIs are still thin.
            </p>
          </div>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`pricing-card${plan.featured ? " featured" : ""}`} key={plan.title}>
              <h3>{plan.title}</h3>
              <p className="metric-value">{plan.price}</p>
              <p className="muted">{plan.copy}</p>
              <ul className="pricing-list">
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="section-actions">
          <Link className="primary-button" href="/auth">
            Create your Knowlense account
          </Link>
          <Link className="secondary-button" href="/dashboard">
            Preview the app shell
          </Link>
        </div>
      </section>

      <footer className="footer">
        Knowlense is structured for `knowlense-web` on Cloudflare Pages and `knowlense-api` on Cloudflare Workers.
      </footer>
    </main>
  );
}
