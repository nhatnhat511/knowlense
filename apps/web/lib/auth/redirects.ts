"use client";

export function getSiteOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export function getSignupRedirectUrl() {
  return `${getSiteOrigin()}/auth/callback`;
}

export function getPasswordResetRedirectUrl() {
  return `${getSiteOrigin()}/auth/update-password`;
}
