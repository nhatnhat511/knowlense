"use client";

import { getApiBaseUrl } from "./profile";

export async function authorizeExtensionConnection(accessToken: string, requestId: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/extension/session/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requestId })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to connect the extension.");
  }

  return payload as {
    connected: boolean;
    user: {
      id: string;
      email: string | null;
    };
  };
}
