"use client";

import { getApiBaseUrl } from "./profile";

export type BillingInterval = "monthly" | "yearly";

export async function createCheckout(accessToken: string, interval: BillingInterval) {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/checkout`, {
    method: "POST",
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
