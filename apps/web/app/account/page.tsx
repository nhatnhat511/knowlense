"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiProfile, type ApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppMenuLink, AppPanel, AppPanelTitle, AppShell } from "@/components/account/app-shell";

function initialsFromEmail(email: string | null) {
  if (!email) {
    return "K";
  }

  return email.slice(0, 2).toUpperCase();
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [status, setStatus] = useState("Checking account status...");
  const [emailConfirmed, setEmailConfirmed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase configuration.");
      setLoading(false);
      return;
    }

    const client = supabase;
    let active = true;

    async function hydrate() {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.access_token) {
        router.replace("/auth/sign-in?next=/account");
        return;
      }

      try {
        const [authResult, profileResult] = await Promise.all([client.auth.getUser(), fetchApiProfile(session.access_token)]);

        if (!active) {
          return;
        }

        setProfile(profileResult);
        setEmailConfirmed(Boolean(authResult.data.user?.email_confirmed_at));
        setStatus("Your website account is active and ready.");
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(error instanceof Error ? error.message : "Unable to load account.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  }

  return (
    <AppShell
      actions={
        <>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-50"
            href="/connect"
          >
            Connect extension
          </Link>
          <button
            className="inline-flex h-11 items-center rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
            onClick={handleSignOut}
            type="button"
          >
            Log out
          </button>
        </>
      }
      subtitle="Manage your website session, subscription entry points, billing links, and extension access from one place."
      title="Account"
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <AppPanel>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-xl font-semibold text-black">
                {initialsFromEmail(profile?.email ?? null)}
              </div>
              <div>
                <div className="text-xl font-semibold tracking-[-0.04em] text-black">
                  {loading ? "Loading account..." : profile?.email ?? "No active account"}
                </div>
                <div className="mt-1 text-sm text-neutral-500">{status}</div>
              </div>
            </div>
            <span className="inline-flex h-9 items-center rounded-full border border-black/10 bg-neutral-50 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              {emailConfirmed === null ? "Checking" : emailConfirmed ? "Verified" : "Pending verification"}
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Plan</div>
              <div className="mt-2 text-lg font-semibold text-black">Free</div>
              <div className="mt-1 text-sm text-neutral-500">Upgrade when you want recurring research usage.</div>
            </div>
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Website session</div>
              <div className="mt-2 text-lg font-semibold text-black">{profile ? "Active" : "Inactive"}</div>
              <div className="mt-1 text-sm text-neutral-500">The website stays the primary sign-in surface.</div>
            </div>
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Extension access</div>
              <div className="mt-2 text-lg font-semibold text-black">Approval based</div>
              <div className="mt-1 text-sm text-neutral-500">Each browser session is connected from the website.</div>
            </div>
          </div>
        </AppPanel>

        <AppPanel>
          <AppPanelTitle badge="Menu" copy="These are the actions most users look for after signing in." title="Account shortcuts" />
          <div className="space-y-3">
            <AppMenuLink description="Update profile state and review identity details." href="/account" label="Account" />
            <AppMenuLink description="Review plans and switch between monthly or yearly billing." href="/pricing" label="Subscription" />
            <AppMenuLink description="Read billing policy and contact support for invoice issues." href="/refund-policy" label="Billing & invoices" />
            <AppMenuLink description="Reach support and review privacy or service terms." href="/contact" label="Support" />
            <button
              className="flex w-full items-center justify-between rounded-[20px] border border-red-100 bg-red-50 px-4 py-4 text-left text-red-700 transition hover:border-red-200 hover:bg-red-100"
              onClick={handleSignOut}
              type="button"
            >
              <div>
                <div className="text-base font-medium">Log out</div>
                <div className="mt-1 text-sm text-red-600/80">End the current website session.</div>
              </div>
              <span className="text-lg leading-none">↗</span>
            </button>
          </div>
        </AppPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <AppPanel>
          <AppPanelTitle
            badge="Subscription"
            copy="Paddle handles checkout, taxes, and invoices. The Worker creates the correct checkout session for the selected plan."
            title="Plan and billing"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-black/8 bg-white p-5">
              <div className="text-sm font-medium text-neutral-500">Current plan</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black">Free</div>
              <p className="mt-3 text-sm leading-6 text-neutral-600">Good for validating the website auth flow, account setup, and first extension connection.</p>
            </div>
            <div className="rounded-[22px] border border-black/8 bg-[#fafafa] p-5">
              <div className="text-sm font-medium text-neutral-500">Upgrade options</div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black">$4.99</div>
              <p className="mt-3 text-sm leading-6 text-neutral-600">$41.9 yearly is also available for a lower effective monthly cost.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
              href="/pricing"
            >
              Manage subscription
            </Link>
            <Link
              className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-50"
              href="/refund-policy"
            >
              Refund policy
            </Link>
          </div>
        </AppPanel>

        <AppPanel>
          <AppPanelTitle badge="Security" copy="Password changes, email verification, and extension approval all start from the website." title="Security and access" />
          <div className="space-y-3 text-sm leading-6 text-neutral-600">
            <div className="rounded-[20px] border border-black/8 bg-[#fafafa] p-4">
              Use <span className="font-medium text-black">Change password</span> when you already have an active session and want to rotate credentials.
            </div>
            <div className="rounded-[20px] border border-black/8 bg-[#fafafa] p-4">
              Use <span className="font-medium text-black">Verify email</span> if the account exists but the confirmation step has not been completed yet.
            </div>
            <div className="rounded-[20px] border border-black/8 bg-[#fafafa] p-4">
              Use <span className="font-medium text-black">Connect extension</span> to approve a browser session without exposing website credentials inside the popup.
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-50"
              href="/auth/change-password"
            >
              Change password
            </Link>
            <Link
              className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-50"
              href="/auth/verify-email"
            >
              Verify email
            </Link>
          </div>
        </AppPanel>
      </div>
    </AppShell>
  );
}
