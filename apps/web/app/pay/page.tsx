"use client";

import Script from "next/script";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/profile";

declare global {
  interface Window {
    Paddle?: {
      Environment: {
        set: (environment: "sandbox" | "production") => void;
      };
      Initialize: (options: {
        token: string;
      }) => void;
    };
  }
}

type PublicConfig = {
  paddleEnvironment: "sandbox" | "production";
  paddleClientSideTokenConfigured: boolean;
};

function PaddlePaymentLinkContent() {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get("_ptxn");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [status, setStatus] = useState("Preparing secure checkout...");
  const [error, setError] = useState("");

  const clientToken = useMemo(
    () => process.env.NEXT_PUBLIC_PADDLE_CLIENT_SIDE_TOKEN ?? process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
    []
  );

  useEffect(() => {
    if (!transactionId) {
      setError("This checkout link is missing the Paddle transaction reference.");
      setStatus("");
      return;
    }

    if (!scriptLoaded) {
      return;
    }

    let active = true;

    async function initializeCheckout() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/v1/public/config`, {
          cache: "no-store"
        });
        const config = (await response.json().catch(() => null)) as PublicConfig | null;

        if (!active) {
          return;
        }

        if (!config) {
          throw new Error("Unable to read Paddle environment settings.");
        }

        if (!clientToken || !config.paddleClientSideTokenConfigured) {
          throw new Error("Paddle client-side token is not configured for the Knowlense checkout page.");
        }

        if (!window.Paddle) {
          throw new Error("Paddle.js did not load correctly.");
        }

        window.Paddle.Environment.set(config.paddleEnvironment);
        window.Paddle.Initialize({
          token: clientToken
        });

        setStatus("Opening checkout...");
      } catch (nextError) {
        if (!active) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Unable to open Paddle checkout.");
        setStatus("");
      }
    }

    void initializeCheckout();

    return () => {
      active = false;
    };
  }, [clientToken, scriptLoaded, transactionId]);

  return (
    <main className="app-shell min-h-screen">
      <Script onLoad={() => setScriptLoaded(true)} src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" />
      <section className="shell flex min-h-screen items-center justify-center py-16">
        <div className="w-full max-w-xl rounded-[30px] border border-[#ebe3d6] bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7f70]">Secure checkout</div>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em] text-black">Preparing your upgrade</h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-neutral-600">
            You're being redirected to a secure checkout to complete your Premium plan.
          </p>
          {status ? <div className="mt-6 rounded-2xl border border-[#ebe3d6] bg-[#faf6ee] px-4 py-3 text-sm text-neutral-700">{status}</div> : null}
          {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        </div>
      </section>
    </main>
  );
}

export default function PaddlePaymentLinkPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell min-h-screen">
          <section className="shell flex min-h-screen items-center justify-center py-16">
            <div className="w-full max-w-xl rounded-[30px] border border-[#ebe3d6] bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7f70]">Secure checkout</div>
              <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em] text-black">Preparing your upgrade</h1>
              <div className="mt-6 rounded-2xl border border-[#ebe3d6] bg-[#faf6ee] px-4 py-3 text-sm text-neutral-700">Preparing secure checkout...</div>
            </div>
          </section>
        </main>
      }
    >
      <PaddlePaymentLinkContent />
    </Suspense>
  );
}
