import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PaddleBillingInterval = "monthly" | "yearly";

export type BillingStoreBindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export type BillingProfileState = {
  status: "free" | "active" | "expired" | "trial";
  planName: string;
  billingInterval: PaddleBillingInterval | null;
  startedAt: string | null;
  nextBilledAt: string | null;
  trialEligible: boolean;
  trialActive: boolean;
  trialDaysRemaining: number;
};

type BillingProfileRow = {
  user_id: string;
  status: string;
  plan_name: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  billing_interval: string | null;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  paddle_transaction_id: string | null;
  paddle_price_id: string | null;
  started_at: string | null;
  next_billed_at: string | null;
  last_event_at: string | null;
  updated_at: string;
};

type PaddleWebhookEventRow = {
  event_id: string;
  event_type: string;
  processed_at: string;
};

type BillingProfileUpdateOptions = {
  interval: PaddleBillingInterval | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  transactionId?: string | null;
  priceId?: string | null;
  startedAt?: string | null;
  nextBilledAt?: string | null;
  occurredAt?: string | null;
};

type BillingFreeOptions = {
  customerId?: string | null;
  subscriptionId?: string | null;
  occurredAt?: string | null;
};

type TrialBillingOptions = {
  startedAt: string;
  endsAt: string;
};

function createBillingAdminClient(env: BillingStoreBindings): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getPremiumPlanName(interval: PaddleBillingInterval | null) {
  return interval === "yearly" ? "Premium Yearly" : "Premium Monthly";
}

async function requireSingleRow<T>(
  promise: PromiseLike<{ data: T | null; error: { message?: string } | null }>
) {
  const result = await promise;
  if (result.error) {
    throw new Error(result.error.message ?? "Unable to read billing data from Supabase.");
  }
  return result.data;
}

async function requireRows<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
) {
  const result = await promise;
  if (result.error) {
    throw new Error(result.error.message ?? "Unable to read billing rows from Supabase.");
  }
  return result.data ?? [];
}

async function requireVoidResult(
  promise: PromiseLike<{ error: { message?: string } | null }>
) {
  const result = await promise;
  if (result.error) {
    throw new Error(result.error.message ?? "Unable to write billing data to Supabase.");
  }
}

async function readBillingProfileRow(env: BillingStoreBindings, userId: string) {
  const supabase = createBillingAdminClient(env);
  return requireSingleRow(
    supabase
      .from("billing_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<BillingProfileRow>()
  );
}

export async function ensureBillingTables(_env: BillingStoreBindings) {
  // Supabase schema is managed ahead of time via SQL migrations.
}

export async function startTrialBillingProfile(
  env: BillingStoreBindings,
  userId: string,
  options: TrialBillingOptions
) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  await requireVoidResult(
    supabase.from("billing_profiles").upsert(
      {
        user_id: userId,
        status: "trial",
        plan_name: "Premium Trial",
        trial_started_at: options.startedAt,
        trial_ends_at: options.endsAt,
        billing_interval: null,
        updated_at: options.startedAt
      },
      {
        onConflict: "user_id"
      }
    )
  );
}

export async function upsertPremiumBillingProfile(
  env: BillingStoreBindings,
  userId: string,
  options: BillingProfileUpdateOptions
) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  const current = await readBillingProfileRow(env, userId);
  const nowIso = new Date().toISOString();

  await requireVoidResult(
    supabase.from("billing_profiles").upsert(
      {
        user_id: userId,
        status: "active",
        plan_name: getPremiumPlanName(options.interval),
        trial_started_at: null,
        trial_ends_at: null,
        billing_interval: options.interval,
        paddle_customer_id: options.customerId ?? current?.paddle_customer_id ?? null,
        paddle_subscription_id: options.subscriptionId ?? current?.paddle_subscription_id ?? null,
        paddle_transaction_id: options.transactionId ?? current?.paddle_transaction_id ?? null,
        paddle_price_id: options.priceId ?? current?.paddle_price_id ?? null,
        started_at: options.startedAt ?? current?.started_at ?? null,
        next_billed_at: options.nextBilledAt ?? current?.next_billed_at ?? null,
        last_event_at: options.occurredAt ?? current?.last_event_at ?? null,
        updated_at: nowIso
      },
      {
        onConflict: "user_id"
      }
    )
  );
}

export async function markBillingProfileFree(
  env: BillingStoreBindings,
  userId: string,
  options: BillingFreeOptions
) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  const current = await readBillingProfileRow(env, userId);

  await requireVoidResult(
    supabase.from("billing_profiles").upsert(
      {
        user_id: userId,
        status: "free",
        plan_name: "Free",
        trial_started_at: null,
        trial_ends_at: null,
        billing_interval: null,
        paddle_customer_id: options.customerId ?? current?.paddle_customer_id ?? null,
        paddle_subscription_id: options.subscriptionId ?? current?.paddle_subscription_id ?? null,
        paddle_transaction_id: null,
        paddle_price_id: null,
        started_at: null,
        next_billed_at: null,
        last_event_at: options.occurredAt ?? current?.last_event_at ?? null,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id"
      }
    )
  );
}

export async function clearTrialBillingProfile(
  env: BillingStoreBindings,
  userId: string,
  updatedAt = new Date().toISOString()
) {
  const supabase = createBillingAdminClient(env);
  await requireVoidResult(
    supabase
      .from("billing_profiles")
      .update({
        status: "free",
        plan_name: "Free",
        trial_started_at: null,
        trial_ends_at: null,
        updated_at: updatedAt
      })
      .eq("user_id", userId)
  );
}

export async function findBillingUserIdBySubscriptionId(env: BillingStoreBindings, subscriptionId: string) {
  const supabase = createBillingAdminClient(env);
  const row = await requireSingleRow(
    supabase
      .from("billing_profiles")
      .select("user_id")
      .eq("paddle_subscription_id", subscriptionId)
      .maybeSingle<{ user_id: string }>()
  );

  return row?.user_id ?? null;
}

export async function findBillingUserIdByCustomerId(env: BillingStoreBindings, customerId: string) {
  const supabase = createBillingAdminClient(env);
  const row = await requireSingleRow(
    supabase
      .from("billing_profiles")
      .select("user_id")
      .eq("paddle_customer_id", customerId)
      .maybeSingle<{ user_id: string }>()
  );

  return row?.user_id ?? null;
}

export async function resolveBillingUserId(
  env: BillingStoreBindings,
  options: {
    userId?: string | null;
    subscriptionId?: string | null;
    customerId?: string | null;
  }
) {
  if (options.userId) {
    return options.userId;
  }

  if (options.subscriptionId) {
    const userId = await findBillingUserIdBySubscriptionId(env, options.subscriptionId);
    if (userId) {
      return userId;
    }
  }

  if (options.customerId) {
    const userId = await findBillingUserIdByCustomerId(env, options.customerId);
    if (userId) {
      return userId;
    }
  }

  return null;
}

export async function readBillingLinkage(env: BillingStoreBindings, userId: string) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  return requireSingleRow(
    supabase
      .from("billing_profiles")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", userId)
      .maybeSingle<{ paddle_customer_id: string | null; paddle_subscription_id: string | null }>()
  );
}

export async function readSubscriptionIdForUser(env: BillingStoreBindings, userId: string) {
  const supabase = createBillingAdminClient(env);
  const row = await requireSingleRow(
    supabase
      .from("billing_profiles")
      .select("paddle_subscription_id")
      .eq("user_id", userId)
      .maybeSingle<{ paddle_subscription_id: string | null }>()
  );

  return row?.paddle_subscription_id ?? null;
}

export async function readRawBillingProfile(env: BillingStoreBindings, userId: string) {
  return readBillingProfileRow(env, userId);
}

export async function touchBillingDates(
  env: BillingStoreBindings,
  userId: string,
  options: {
    startedAt?: string | null;
    nextBilledAt?: string | null;
    updatedAt?: string;
  }
) {
  const supabase = createBillingAdminClient(env);
  const current = await readBillingProfileRow(env, userId);

  if (!current) {
    return;
  }

  await requireVoidResult(
    supabase
      .from("billing_profiles")
      .update({
        started_at: options.startedAt ?? current.started_at,
        next_billed_at: options.nextBilledAt ?? current.next_billed_at,
        updated_at: options.updatedAt ?? new Date().toISOString()
      })
      .eq("user_id", userId)
  );
}

export async function readBillingProfile(env: BillingStoreBindings, userId: string): Promise<BillingProfileState> {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  const row = await requireSingleRow(
    supabase
      .from("billing_profiles")
      .select("user_id, status, plan_name, trial_started_at, trial_ends_at, billing_interval, started_at, next_billed_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle<{
        user_id: string;
        status: string;
        plan_name: string;
        trial_started_at: string | null;
        trial_ends_at: string | null;
        billing_interval: string | null;
        started_at: string | null;
        next_billed_at: string | null;
        updated_at: string;
      }>()
  );

  if (!row) {
    return {
      status: "free",
      planName: "Free",
      billingInterval: null,
      startedAt: null,
      nextBilledAt: null,
      trialEligible: true,
      trialActive: false,
      trialDaysRemaining: 0
    };
  }

  if (row.status === "trial" && row.trial_ends_at) {
    const remainingMs = new Date(row.trial_ends_at).getTime() - Date.now();

    if (remainingMs <= 0) {
      await clearTrialBillingProfile(env, userId);

      return {
        status: "expired",
        planName: "Free",
        billingInterval: null,
        startedAt: null,
        nextBilledAt: null,
        trialEligible: false,
        trialActive: false,
        trialDaysRemaining: 0
      };
    }

    return {
      status: "trial",
      planName: "Premium Trial",
      billingInterval: null,
      startedAt: row.trial_started_at,
      nextBilledAt: row.trial_ends_at,
      trialEligible: false,
      trialActive: true,
      trialDaysRemaining: Math.max(Math.ceil(remainingMs / (1000 * 60 * 60 * 24)), 1)
    };
  }

  if (row.status === "premium" || row.status === "active") {
    return {
      status: "active",
      planName: row.plan_name || "Premium",
      billingInterval: row.billing_interval === "monthly" || row.billing_interval === "yearly" ? row.billing_interval : null,
      startedAt: row.started_at,
      nextBilledAt: row.next_billed_at,
      trialEligible: false,
      trialActive: false,
      trialDaysRemaining: 0
    };
  }

  return {
    status: row.status === "expired" ? "expired" : "free",
    planName: row.plan_name || "Free",
    billingInterval: null,
    startedAt: null,
    nextBilledAt: null,
    trialEligible: row.trial_started_at == null,
    trialActive: false,
    trialDaysRemaining: 0
  };
}

export async function hasProcessedPaddleWebhookEvent(env: BillingStoreBindings, eventId: string) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  const row = await requireSingleRow(
    supabase
      .from("paddle_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle<{ event_id: string }>()
  );

  return Boolean(row?.event_id);
}

export async function recordProcessedPaddleWebhookEvent(
  env: BillingStoreBindings,
  eventId: string,
  eventType: string,
  processedAt = new Date().toISOString()
) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  await requireVoidResult(
    supabase.from("paddle_webhook_events").upsert(
      {
        event_id: eventId,
        event_type: eventType,
        processed_at: processedAt
      },
      {
        onConflict: "event_id"
      }
    )
  );
}

export async function recordBillingEvent(
  env: BillingStoreBindings,
  options: {
    userId?: string | null;
    eventType: string;
    paddleEventId?: string | null;
    paddleSubscriptionId?: string | null;
    paddleTransactionId?: string | null;
    payload?: unknown;
  }
) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  await requireVoidResult(
    supabase.from("billing_events").insert({
      user_id: options.userId ?? null,
      source: "paddle",
      event_type: options.eventType,
      paddle_event_id: options.paddleEventId ?? null,
      paddle_subscription_id: options.paddleSubscriptionId ?? null,
      paddle_transaction_id: options.paddleTransactionId ?? null,
      payload: options.payload ?? null
    })
  );
}

export async function listRecentWebhookEvents(env: BillingStoreBindings, limit = 20) {
  await ensureBillingTables(env);

  const supabase = createBillingAdminClient(env);
  const rows = await requireRows(
    supabase
      .from("paddle_webhook_events")
      .select("*")
      .order("processed_at", { ascending: false })
      .limit(limit)
      .returns<PaddleWebhookEventRow[]>()
  );

  return rows;
}
