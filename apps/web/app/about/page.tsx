import {
  PublicSiteHeader,
  SiteFooter
} from "@/components/site/chrome";

export default function AboutPage() {
  return (
    <main className="app-shell">
      <PublicSiteHeader />

      <section className="shell marketing-surface">
        <div className="section-heading">
          <span className="section-label">About Knowlense</span>
          <h1 className="page-title">Knowlense is built to make TPT seller research feel more deliberate.</h1>
          <p className="page-copy">
            The product is being shaped around one clear goal: give sellers a cleaner path from market observation to useful
            action without making the extension, the account system, and the web app feel disconnected.
          </p>
        </div>

        <div className="comparison-grid">
          <article className="comparison-card">
            <h2>What Knowlense is trying to replace</h2>
            <ul className="clean-list">
              <li>Jumping between marketplace tabs, notes, and spreadsheets.</li>
              <li>Weak handoff between account state and extension usage.</li>
              <li>Research flows that feel improvised instead of productized.</li>
            </ul>
          </article>
          <article className="comparison-card">
            <h2>What Knowlense is trying to provide</h2>
            <ul className="clean-list">
              <li>A stable website account layer.</li>
              <li>A secure extension connection flow.</li>
              <li>A dashboard that keeps recent research visible and usable.</li>
            </ul>
          </article>
        </div>

        <div className="process-grid">
          <article className="process-card">
            <span className="process-step">01</span>
            <h3>Website-first account management</h3>
            <p>Authentication, password recovery, and account updates stay in the web app where users expect them.</p>
          </article>
          <article className="process-card">
            <span className="process-step">02</span>
            <h3>Worker-owned product logic</h3>
            <p>Business logic and API behavior live in Cloudflare Workers instead of being split across multiple surfaces.</p>
          </article>
          <article className="process-card">
            <span className="process-step">03</span>
            <h3>Extension as a task surface</h3>
            <p>The extension should help sellers do work inside TPT, not become the place where everything else is managed.</p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
