"use client";

import { useEffect, useRef, useState } from "react";
import { fetchExtensionStatus } from "@/lib/api/dashboard";
import { useToast } from "@/components/providers/app-providers";

export function useExtensionStatus(accessToken: string, enabled: boolean) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<{
    status: "active" | "alert";
    label: string;
    connected: boolean;
  } | null>(null);
  const lastToastMessageRef = useRef("");

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
        lastToastMessageRef.current = "";
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to refresh extension status.";
        setStatus({
          status: "alert",
          label: "Alert",
          connected: false
        });
        if (lastToastMessageRef.current !== message) {
          showToast(message);
          lastToastMessageRef.current = message;
        }
      }
    }

    void loadStatus();
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void loadStatus();
    }, 120000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [accessToken, enabled, showToast]);

  return status;
}
