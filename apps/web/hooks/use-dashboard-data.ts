"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDashboardMetrics, fetchDashboardOverview, type DashboardMetrics, type DashboardOverview } from "@/lib/api/dashboard";
import { useToast } from "@/components/providers/app-providers";

export function useDashboardData(accessToken: string, enabled: boolean) {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const lastToastMessageRef = useRef("");

  useEffect(() => {
    if (!enabled || !accessToken) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [metricsResult, overviewResult] = await Promise.all([
          fetchDashboardMetrics(accessToken),
          fetchDashboardOverview(accessToken)
        ]);

        if (!active) {
          return;
        }

        setMetrics(metricsResult);
        setOverview(overviewResult);
        lastToastMessageRef.current = "";
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load dashboard data.";
        setError(message);
        if (lastToastMessageRef.current !== message) {
          showToast(message);
          lastToastMessageRef.current = message;
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [accessToken, enabled, refreshKey, showToast]);

  useEffect(() => {
    if (!enabled || !accessToken) {
      return;
    }

    if (!overview || overview.latestQuery.status === "completed") {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshKey((value) => value + 1);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [accessToken, enabled, overview]);

  return {
    metrics,
    overview,
    loading,
    error,
    refresh() {
      setRefreshKey((value) => value + 1);
    }
  };
}
