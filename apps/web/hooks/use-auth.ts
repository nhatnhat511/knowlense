"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiProfile } from "@/lib/api/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/components/providers/app-providers";

export function useAuthGuard(nextPath: string) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { user, setUser } = useSessionStore();
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const client = supabase;
    let active = true;

    async function applySession(session: Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"], redirectIfMissing: boolean) {
      if (!active) {
        return;
      }

      if (!session?.access_token) {
        setUser(null);
        setAccessToken("");
        if (redirectIfMissing) {
          router.replace(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
        }
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      setAccessToken(session.access_token);
      try {
        const profile = await fetchApiProfile(session.access_token);

        if (!active) {
          return;
        }

        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name ?? profile.email?.split("@")[0] ?? "there",
          avatarUrl: profile.avatarUrl
        });
        setAccessToken(session.access_token);
      } catch {
        await client.auth.signOut();
        setUser(null);
        setAccessToken("");
        if (redirectIfMissing) {
          router.replace(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    async function hydrate() {
      const {
        data: { session }
      } = await client.auth.getSession();

      await applySession(session, true);
    }

    void hydrate();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setAccessToken("");
        router.replace(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        if (session?.access_token) {
          setAccessToken(session.access_token);
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void applySession(session, false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [nextPath, router, setUser, supabase]);

  return {
    accessToken,
    isLoading,
    user
  };
}
