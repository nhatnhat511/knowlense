"use client";

import { getApiBaseUrl } from "@/lib/api/profile";

export type AuthApiSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
};

export type AuthApiUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailConfirmed: boolean;
  authType: "supabase" | "extension";
  signInMethod: "email" | "google" | "github" | "unknown";
};

async function postAuthResource<TResponse>(path: string, body: Record<string, unknown>, accessToken?: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  const fallbackText = payload ? null : await response.clone().text().catch(() => "");

  if (!response.ok) {
    throw new Error(payload?.error ?? fallbackText ?? "Unable to complete the authentication request.");
  }

  return payload as TResponse;
}

export function signInWithPassword(email: string, password: string) {
  return postAuthResource<{ session: AuthApiSession; user: AuthApiUser }>("/v1/auth/sign-in", { email, password });
}

export function signUpWithPassword(email: string, password: string, displayName: string, redirectTo: string) {
  return postAuthResource<{
    session: AuthApiSession | null;
    user: AuthApiUser | null;
    identitiesLength: number | null;
    requiresEmailVerification: boolean;
  }>("/v1/auth/sign-up", { email, password, displayName, redirectTo });
}

export function startOAuth(provider: "google" | "github", redirectTo: string) {
  return postAuthResource<{ url: string }>("/v1/auth/oauth/start", { provider, redirectTo });
}

export function validateAuthProvider(accessToken: string) {
  return postAuthResource<{
    allowed: boolean;
    method?: "email" | "google" | "github";
    existingMethod?: "email" | "google" | "github";
  }>("/v1/auth/validate-provider", {}, accessToken);
}

export function exchangeOAuthCode(code: string) {
  return postAuthResource<{ session: AuthApiSession; user: AuthApiUser }>("/v1/auth/exchange-code", { code });
}

export function requestPasswordReset(email: string, redirectTo: string) {
  return postAuthResource<{ ok: true }>("/v1/auth/forgot-password", { email, redirectTo });
}

export function resendVerificationEmail(email: string, redirectTo: string) {
  return postAuthResource<{ ok: true }>("/v1/auth/resend-verification", { email, redirectTo });
}

export function changePassword(password: string, accessToken: string) {
  return postAuthResource<{ ok: true }>("/v1/auth/change-password", { password }, accessToken);
}

export function signOutFromApi(accessToken?: string) {
  return postAuthResource<{ ok: true }>("/v1/auth/sign-out", {}, accessToken);
}
