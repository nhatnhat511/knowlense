"use client";

import { useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

type FormErrors = {
  email?: string;
  message?: string;
  name?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoadingSpinner() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-100" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Please enter your name.";
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (message.trim().length < 20) {
      nextErrors.message = "Please share at least 20 characters so we have enough context.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    // Validate field-by-field so each input can render its own inline feedback.
    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Placeholder submit flow until a backend endpoint is connected.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setStatus("Thanks. Your enquiry has been captured and the team can review it.");
      setName("");
      setEmail("");
      setMessage("");
      setErrors({});
    } catch {
      setStatus("Something went wrong while sending your enquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <SiteHeader
        tag="Contact"
        navItems={[
          { href: "/pricing", label: "Pricing" },
          { href: "/about", label: "About" },
          { href: "/account", label: "Account" }
        ]}
      />

      <section className="shell marketing-surface">
        <div className="section-heading">
          <span className="section-label">Contact</span>
          <h1 className="page-title">Reach Knowlense support with the details needed to actually resolve the issue.</h1>
          <p className="page-copy">
            For product questions, account issues, privacy requests, or billing follow-up, contact the team at
            support@knowlense.com and include the account email tied to the issue.
          </p>
        </div>

        <div className="contact-grid">
          <article className="contact-card">
            <h2>Get in touch</h2>
            <p className="page-copy">
              Share your enquiry with enough context and we can route it faster to the right part of the product or support flow.
            </p>

            <form className="mt-2 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="contact-name">
                  Your name
                </label>
                <input
                  id="contact-name"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Doe"
                  type="text"
                  value={name}
                />
                {errors.name ? <p className="text-sm text-red-500">{errors.name}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="contact-email">
                  Email
                </label>
                <input
                  id="contact-email"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
                {errors.email ? <p className="text-sm text-red-500">{errors.email}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="contact-message">
                  Enquiry
                </label>
                <textarea
                  id="contact-message"
                  className="min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us what happened, where it happened, and what outcome you need."
                  value={message}
                />
                {errors.message ? <p className="text-sm text-red-500">{errors.message}</p> : null}
              </div>

              {status ? <p className="text-sm text-slate-600">{status}</p> : null}

              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? <LoadingSpinner /> : "Gửi"}
              </button>
            </form>
          </article>

          <article className="contact-card">
            <h2>What to include</h2>
            <ul className="contact-list">
              <li>
                <strong>Account email</strong>
                <span>The email used on the website helps us trace authentication, billing, and extension records.</span>
              </li>
              <li>
                <strong>Relevant flow</strong>
                <span>Tell us whether the issue happened during sign in, verify email, connect extension, checkout, or a dashboard action.</span>
              </li>
              <li>
                <strong>Useful context</strong>
                <span>Include screenshots, timestamps, and the page you were on so the report is actionable.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
