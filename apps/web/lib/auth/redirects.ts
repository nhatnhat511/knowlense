"use client";

export function getSiteOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

const ALLOWED_NEXT_PATH_PREFIXES = ["/dashboard", "/account", "/pricing", "/connect", "/auth"];

export function normalizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  const isAllowed = ALLOWED_NEXT_PATH_PREFIXES.some((prefix) => {
    return nextPath === prefix || nextPath.startsWith(`${prefix}/`) || nextPath.startsWith(`${prefix}?`) || nextPath.startsWith(`${prefix}#`);
  });

  if (!isAllowed) {
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
