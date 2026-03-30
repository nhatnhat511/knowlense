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

export async function fetchExtensionDevices(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/dashboard/extension-devices`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(payload?.devices)) {
    throw new Error(payload?.error ?? "Unable to load extension devices.");
  }

  return payload.devices as Array<{
    id: string;
    label: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    status: "active" | "revoked" | "expired";
  }>;
}

export async function revokeExtensionDevice(accessToken: string, sessionId: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/dashboard/extension-devices/${encodeURIComponent(sessionId)}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || typeof payload?.revoked !== "boolean") {
    throw new Error(payload?.error ?? "Unable to revoke the selected extension device.");
  }

  return payload as { revoked: boolean };
}

export async function revokeOtherExtensionDevices(accessToken: string, keepSessionId: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/dashboard/extension-devices/revoke-others`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ keepSessionId })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || typeof payload?.revokedCount !== "number") {
    throw new Error(payload?.error ?? "Unable to revoke the other extension browsers.");
  }

  return payload as { revokedCount: number };
}
