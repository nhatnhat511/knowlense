"use client";

import { getApiBaseUrl } from "./profile";

export type BillingInterval = "monthly" | "yearly";

export async function createCheckout(accessToken: string, interval: BillingInterval) {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/checkout`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ interval })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.checkoutUrl) {
    throw new Error(payload?.error ?? "Unable to start Paddle checkout.");
  }

  return payload as {
    checkoutUrl: string;
    interval: BillingInterval;
  };
}

export async function confirmCheckout(accessToken: string, transactionId: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/confirm`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ transactionId })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to confirm Paddle checkout.");
  }

  return payload as {
    confirmed: boolean;
    ready: boolean;
    status?: string;
    billing?: {
      status: "free" | "active" | "expired" | "setup" | "trial";
      planName: string;
      billingInterval: "monthly" | "yearly" | null;
      nextBilledAt: string | null;
      trialEligible: boolean;
      trialActive: boolean;
      trialDaysRemaining: number;
    };
  };
}

export async function upgradeSubscriptionToYearly(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/upgrade-yearly`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "Unable to upgrade this subscription.");
  }

  return payload as {
    ok: true;
    billing: {
      status: "free" | "active" | "expired" | "setup" | "trial";
      planName: string;
      billingInterval: "monthly" | "yearly" | null;
      nextBilledAt: string | null;
      trialEligible: boolean;
      trialActive: boolean;
      trialDaysRemaining: number;
    };
  };
}
