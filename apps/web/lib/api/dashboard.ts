"use client";

import { getApiBaseUrl } from "./profile";

export type DashboardMetrics = {
  websiteSessions: {
    value: number;
    delta: string;
  };
  billing: {
    status: "free" | "active" | "expired" | "setup" | "trial";
    planName: string;
    billingInterval: "monthly" | "yearly" | null;
    nextBilledAt: string | null;
    trialEligible: boolean;
    trialActive: boolean;
    trialDaysRemaining: number;
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

export type RankTrackingDashboard = {
  summary: {
    activeTargets: number;
    baselinePending: number;
    improving: number;
    declining: number;
    stable: number;
  };
  filters: {
    selectedRange: "7d" | "30d" | "90d" | "all";
    selectedTargetId: string | null;
    targets: Array<{
      id: string;
      label: string;
      productTitle: string;
      keyword: string;
    }>;
  };
  chart: {
    targetId: string | null;
    title: string;
    keyword: string;
    baselineReady: boolean;
    baselineProgress: number;
    rangeLabel: string;
    insight: string;
    currentRankLabel: string;
    bestRankLabel: string;
    points: Array<{
      checkedAt: string;
      dayLabel: string;
      rankValue: number;
      rankLabel: string;
      status: "ranked" | "beyond_page_3";
      resultPage: number | null;
      pagePosition: number | null;
    }>;
  };
};

async function fetchDashboardResource<T>(accessToken: string, path: string, key: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
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

export async function fetchRankTrackingDashboard(
  accessToken: string,
  params?: { range?: "7d" | "30d" | "90d" | "all"; targetId?: string | null }
) {
  const query = new URLSearchParams();
  if (params?.range) {
    query.set("range", params.range);
  }
  if (params?.targetId) {
    query.set("targetId", params.targetId);
  }

  return fetchDashboardResource<RankTrackingDashboard>(
    accessToken,
    `/v1/dashboard/rank-tracking${query.toString() ? `?${query.toString()}` : ""}`,
    "rankTracking"
  );
}

export async function fetchExtensionStatus(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/dashboard/extension-status`, {
    cache: "no-store",
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

export async function startDashboardTrial(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/dashboard/trial/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.trial) {
    throw new Error(payload?.error ?? "Unable to start your trial.");
  }

  return payload.trial as {
    status: "trial";
    planName: string;
    trialDaysRemaining: number;
  };
}
