"use client";

import { getApiBaseUrl } from "./profile";

export type BillingInterval = "monthly" | "yearly";
export type BillingState = {
  status: "free" | "active" | "expired" | "setup" | "trial";
  planName: string;
  billingInterval: "monthly" | "yearly" | null;
  startedAt: string | null;
  nextBilledAt: string | null;
  trialEligible: boolean;
  trialActive: boolean;
  trialDaysRemaining: number;
};

export type YearlyUpgradePreview = {
  currencyCode: string | null;
  collectionMode: "automatic" | "manual" | null;
  nextBilledAt: string | null;
  immediateTransaction: {
    total: string | null;
    subtotal: string | null;
    tax: string | null;
  } | null;
  recurringTransaction: {
    total: string | null;
    subtotal: string | null;
    tax: string | null;
    interval: string | null;
    frequency: number | null;
  } | null;
  updateSummary: {
    chargeTotal: string | null;
    creditTotal: string | null;
    resultTotal: string | null;
  } | null;
  consentRequirementsCount: number;
};

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
    billing?: BillingState;
  };
}

export async function previewYearlyUpgrade(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/upgrade-yearly/preview`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.preview) {
    throw new Error(payload?.error ?? "Unable to preview this subscription upgrade.");
  }

  return payload as {
    preview: YearlyUpgradePreview;
  };
}

export async function applyYearlyUpgrade(accessToken: string) {
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
    billing: BillingState;
  };
}

export async function fetchManageSubscriptionUrl(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/manage`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Unable to open the subscription manager.");
  }

  return payload.url as string;
}
