"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ConnectRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestId = searchParams.get("request");
    const nextUrl = requestId ? `/dashboard?section=account&request=${encodeURIComponent(requestId)}` : "/dashboard?section=account";
    router.replace(nextUrl);
  }, [router, searchParams]);

  return <main className="min-h-screen bg-[#f7f7f5]" />;
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f7f5]" />}>
      <ConnectRedirectContent />
    </Suspense>
  );
}
