"use client";

import { useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { sendContactMessage } from "@/lib/api/contact";

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

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        message: message.trim()
      });

      setStatus("Thanks. Your message has been sent to the Knowlense team.");
      setName("");
      setEmail("");
      setMessage("");
      setErrors({});
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send your message right now.");
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
          { href: "/faq", label: "FAQ" }
        ]}
      />

      <section className="shell marketing-surface">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.8fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-slate-950">Contact</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">Questions about your account, billing, or extension setup? Send a message and we&apos;ll help you move forward.</p>
            <div className="mt-8 space-y-4 text-sm leading-7 text-slate-700">
              <p>
                Email:{" "}
                <a className="font-medium text-slate-950 underline-offset-4 hover:underline" href="mailto:phamnhat5111997@gmail.com">
                  phamnhat5111997@gmail.com
                </a>
              </p>
              <p>We usually respond within 24 hours.</p>
              <p>Use this form for product questions, account access issues, billing follow-up, or extension connection support.</p>
            </div>
            <a
              className="mt-8 inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
              href="mailto:phamnhat5111997@gmail.com?subject=Knowlense%20Website%20Contact"
            >
              Email Support
            </a>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="contact-name">
                  Name
                </label>
                <input
                  id="contact-name"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  value={name}
                />
                {errors.name ? <p className="text-sm text-red-600">{errors.name}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="contact-email">
                  Email
                </label>
                <input
                  id="contact-email"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
                {errors.email ? <p className="text-sm text-red-600">{errors.email}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="contact-message">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  className="min-h-44 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us how we can help..."
                  value={message}
                />
                {errors.message ? <p className="text-sm text-red-600">{errors.message}</p> : null}
              </div>

              {status ? (
                <p className={`text-sm ${status.startsWith("Thanks") ? "text-emerald-700" : "text-red-600"}`}>{status}</p>
              ) : null}

              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? <LoadingSpinner /> : "Send Message"}
              </button>
            </form>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
