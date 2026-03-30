"use client";

export function getSiteOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

function normalizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard";
  }

  return nextPath;
}

export function getAuthCallbackUrl(nextPath?: string) {
  const callbackUrl = new URL(`${getSiteOrigin()}/auth/callback`);
  callbackUrl.searchParams.set("next", normalizeNextPath(nextPath));
  return callbackUrl.toString();
}

export function getSignupRedirectUrl() {
  return getAuthCallbackUrl("/dashboard");
}

export function getPasswordResetRedirectUrl() {
  return `${getSiteOrigin()}/auth/update-password`;
}
