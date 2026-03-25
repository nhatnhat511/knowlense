import { getSupabaseAdmin } from "./supabase";
import type { Bindings } from "../types";

export async function checkSubscriptionStatus(env: Bindings, userId: string) {
  const supabase = getSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read subscription: ${error.message}`);
  }

  const status = (data?.status || "free").toLowerCase();
  const now = Date.now();
  const trialActive = Boolean(data?.trial_ends_at && Date.parse(data.trial_ends_at) > now);
  const periodActive = Boolean(data?.current_period_end && Date.parse(data.current_period_end) > now);
  const isPremium = status === "active" || status === "trialing" || trialActive || periodActive;
  const state = status === "trialing" || trialActive ? "trial" : isPremium ? "premium" : "free";

  return {
    isPremium,
    state,
    status,
    trialEndsAt: data?.trial_ends_at ?? null,
    currentPeriodEnd: data?.current_period_end ?? null
  };
}

export function getUsageCounterKey(userId: string) {
  const isoDay = new Date().toISOString().slice(0, 10);
  return `usage:${userId}:${isoDay}`;
}
