"use client";

import { useEffect, useState } from "react";
import { fetchExtensionStatus } from "@/lib/api/dashboard";
import { useToast } from "@/components/providers/app-providers";

export function useExtensionStatus(accessToken: string, enabled: boolean) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<{
    status: "active" | "alert";
    label: string;
    connected: boolean;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken) {
      return;
    }

    let active = true;

    async function loadStatus() {
      try {
        const nextStatus = await fetchExtensionStatus(accessToken);

        if (!active) {
          return;
        }

        setStatus(nextStatus);
      } catch (error) {
        if (!active) {
          return;
        }

        showToast(error instanceof Error ? error.message : "Unable to refresh extension status.");
      }
    }

    void loadStatus();
    const interval = window.setInterval(() => {
      void loadStatus();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [accessToken, enabled, showToast]);

  return status;
}
