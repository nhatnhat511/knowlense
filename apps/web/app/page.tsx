import Link from "next/link";

const features = [
  {
    icon: "LG",
    title: "Listing Grader",
    copy: "Audit title quality, preview depth, positioning clarity, and conversion friction while a seller is already inside TPT.",
    bullets: ["Title and tag diagnostics", "Preview and thumbnail checks", "Prioritized fix list per product"]
  },
  {
    icon: "KF",
    title: "Keyword Finder",
    copy: "Turn live TPT search result pages into structured keyword intelligence instead of guesswork and spreadsheets.",
    bullets: ["Search snapshot capture", "Phrase clustering", "Opportunity scoring from real pages"]
  },
  {
    icon: "MG",
    title: "Market Gap Board",
    copy: "Spot underserved modifiers, adjacent niches, and bundle directions that are more actionable than generic SEO tips.",
    bullets: ["Gap explanations", "Adjacent niche suggestions", "Saved opportunity backlog"]
  }
];

const plans = [
  {
    title: "Starter",
    price: "$0",
    suffix: "/month",
    copy: "For validating the extension, account flow, and initial TPT research workflow.",
    bullets: ["Extension popup", "Website account", "Basic keyword captures"]
  },
  {
    title: "Pro",
    price: "$29",
    suffix: "/month",
    copy: "The first paid plan for sellers actively optimizing listings and exploring niche expansion.",
    bullets: ["Listing Grader", "Keyword Finder", "Saved opportunities and account sync"],
    featured: true
  },
  {
    title: "Studio",
    price: "$79",
    suffix: "/month",
    copy: "For higher-volume sellers running a real operating workflow across many products.",
    bullets: ["Multi-seat collaboration", "Priority sync jobs", "Deeper catalog planning"]
  }
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <div className="shell topbar">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">K</span>
            <span className="brand">
              <span className="brand-name">Knowlense</span>
              <span className="brand-tag">TPT seller intelligence</span>
            </span>
          </Link>
          <nav className="nav">
            <a className="nav-link" href="#product">
              Product
            </a>
            <a className="nav-link" href="#pricing">
              Pricing
            </a>
            <Link className="ghost-button" href="/auth">
              Sign in
            </Link>
            <Link className="primary-button" href="/dashboard">
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Chrome extension + Pages + Workers + Supabase</span>
            <h1 className="hero-title">A SaaS operating layer for serious TPT sellers.</h1>
            <p>
              Knowlense helps sellers analyze listings inside TPT, capture keyword signals from real search pages, and
              move opportunities into a cleaner account-based workflow.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/auth">
                Create account
              </Link>
              <Link className="secondary-button" href="/dashboard">
                View app shell
              </Link>
            </div>
            <div className="hero-proof">
              <div className="proof-item">
                <span className="proof-value">1</span>
                <span className="proof-label">Unified login across site and extension</span>
              </div>
              <div className="proof-item">
                <span className="proof-value">3</span>
                <span className="proof-label">Core modules in the MVP direction</span>
              </div>
              <div className="proof-item">
                <span className="proof-value">API</span>
                <span className="proof-label">Session validation through Workers</span>
              </div>
            </div>
          </div>

          <div className="card hero-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Seller command center</div>
                <div className="panel-subtitle">What the first real SaaS surface should feel like</div>
              </div>
              <span className="status-chip">Live MVP foundation</span>
            </div>

            <div className="preview-window">
              <div className="preview-topbar">
                <span className="preview-dot" />
                <span className="preview-dot" />
                <span className="preview-dot" />
              </div>
              <div className="preview-body">
                <div className="preview-line" />
                <div className="preview-line-short" />
                <div className="preview-block" />
              </div>
            </div>

            <div className="signal-list">
              <div className="signal-item">
                <span className="signal-label">Session model</span>
                <span className="signal-value">Supabase + `/v1/me`</span>
              </div>
              <div className="signal-item">
                <span className="signal-label">Frontend</span>
                <span className="signal-value">Next.js on Pages</span>
              </div>
              <div className="signal-item">
                <span className="signal-label">Extension role</span>
                <span className="signal-value">In-context TPT analysis</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section" id="product">
        <div className="shell">
          <div className="section-header">
            <div>
              <h2 className="section-title">Built around a credible SaaS workflow</h2>
              <p className="section-copy">
                The product direction is not “AI writes some copy.” It is an operating system for recovering revenue,
                finding adjacent niches, and turning live TPT research into structured action.
              </p>
            </div>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
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
        </div>
      </section>

      <section className="page-section">
        <div className="shell split-band">
          <div className="card band-card">
            <span className="eyebrow">Architecture</span>
            <h2 className="section-title" style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)", marginTop: 18 }}>
              Split correctly for Cloudflare from day one.
            </h2>
            <p className="section-copy" style={{ marginTop: 14 }}>
              `knowlense-web` handles the product surface and account experience. `knowlense-api` owns auth validation,
              business logic, and billing rails. The extension becomes the seller-side entry point.
            </p>
          </div>
          <div className="card band-card">
            <span className="eyebrow">Why it matters</span>
            <ul className="clean-list">
              <li>Website and extension use the same identity model.</li>
              <li>Workers can become the source of truth for billing and feature access.</li>
              <li>The UI is ready to grow into a real product instead of a temporary landing page.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="page-section" id="pricing">
        <div className="shell">
          <div className="section-header">
            <div>
              <h2 className="section-title">Pricing that maps cleanly to Paddle</h2>
              <p className="section-copy">
                The visual structure is ready for checkout wiring later. For now it frames the SaaS correctly and avoids
                the look of a placeholder startup page.
              </p>
            </div>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`pricing-card${plan.featured ? " featured" : ""}`} key={plan.title}>
                {plan.featured ? <div className="plan-tag">Recommended launch plan</div> : null}
                <h3>{plan.title}</h3>
                <div className="price">
                  <strong>{plan.price}</strong>
                  <span>{plan.suffix}</span>
                </div>
                <p className="muted">{plan.copy}</p>
                <ul className="pricing-list">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="section-actions" style={{ marginTop: 24 }}>
            <Link className="primary-button" href="/auth">
              Start with your account
            </Link>
            <Link className="ghost-button" href="/dashboard">
              Inspect the app shell
            </Link>
          </div>
        </div>
      </section>

      <footer className="shell footer">Knowlense is now structured like a SaaS product, not a placeholder site.</footer>
    </main>
  );
}
