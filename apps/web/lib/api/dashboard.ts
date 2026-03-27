"use client";

import { getApiBaseUrl } from "./profile";

export type DashboardMetrics = {
  websiteSessions: {
    value: number;
    delta: string;
  };
  billing: {
    status: "free" | "active" | "expired" | "setup";
    readiness: string;
    ctaLabel: string;
    delta: string;
  };
  keywordRuns: {
    used: number;
    limit: number;
    remaining: number;
    disabled: boolean;
    delta: string;
  };
  extensionStatus: {
    status: "active" | "alert";
    label: string;
    delta: string;
  };
};

export type DashboardOverview = {
  currentAccount: {
    value: string;
    status: string;
  };
  latestQuery: {
    value: string;
    status: "waiting" | "processing" | "completed";
    updatedAt: string | null;
  };
  nextAction: {
    value: string;
  };
  recentRuns: Array<{
    id: string;
    createdAt: string;
    query: string;
    summary: {
      query: string;
      totalResults: number;
      dominantTerms: string[];
    };
    opportunities: Array<{
      phrase: string;
      score: number;
    }>;
  }>;
  quota: {
    used: number;
    limit: number;
    atLimit: boolean;
  };
};

async function fetchDashboardResource<T>(accessToken: string, path: string, key: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.[key]) {
    throw new Error(payload?.error ?? "Unable to load dashboard data.");
  }

  return payload[key] as T;
}

export function fetchDashboardMetrics(accessToken: string) {
  return fetchDashboardResource<DashboardMetrics>(accessToken, "/v1/dashboard/metrics", "metrics");
}

export function fetchDashboardOverview(accessToken: string) {
  return fetchDashboardResource<DashboardOverview>(accessToken, "/v1/dashboard/overview", "overview");
}

export async function fetchExtensionStatus(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/dashboard/extension-status`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.status) {
    throw new Error(payload?.error ?? "Unable to load extension status.");
  }

  return payload as {
    status: "active" | "alert";
    label: string;
    connected: boolean;
  };
}
