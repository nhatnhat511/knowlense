"use client";

export type ApiProfile = {
  email: string | null;
  id: string;
  name: string | null;
  avatarUrl: string | null;
  emailConfirmed: boolean;
  authType: "supabase" | "extension";
};

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "https://api.knowlense.com").replace(/\/$/, "");
}

export async function fetchApiProfile(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error ?? "Unable to validate the current session.");
  }

  return payload.user as ApiProfile;
}
