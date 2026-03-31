"use client";

import { getApiBaseUrl } from "@/lib/api/profile";

export async function sendContactMessage(input: {
  name: string;
  email: string;
  message: string;
}) {
  const response = await fetch(`${getApiBaseUrl()}/v1/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => null);
  const fallbackText = payload ? null : await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(payload?.error ?? fallbackText ?? "Unable to send your message right now.");
  }

  return payload as { ok: true };
}
