"use client";

import { getApiBaseUrl } from "./profile";

export type KeywordRun = {
  id: string;
  query_text: string;
  summary: {
    query: string;
    normalizedQuery: string;
    totalResults: number;
    capturedAt: string;
    dominantTerms: string[];
    adjacentModifiers: string[];
    saturatedPhrases: string[];
  };
  keywords: Array<{
    phrase: string;
    opportunityScore: number;
    frequency: number;
    saturationLevel: "low" | "medium" | "high";
    reason: string;
  }>;
  opportunities: Array<{
    phrase: string;
    score: number;
    type: "adjacent" | "underserved";
    reason: string;
  }>;
  created_at: string;
};

export async function fetchKeywordRuns(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/keyword-finder/runs`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to load Keyword Finder history.");
  }

  return {
    runs: (payload?.runs ?? []) as KeywordRun[],
    warning: payload?.warning as string | undefined
  };
}
