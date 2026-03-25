import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { corsMiddleware } from "./middleware/cors";
import { requireAuth } from "./middleware/auth";
import { analyzeEntity } from "./lib/analyze";
import { checkSubscriptionStatus, getUsageCounterKey } from "./lib/subscription";
import { getSupabaseAdmin } from "./lib/supabase";
import { verifyPaddleSignature } from "./lib/paddle";
import { getWikiSummary, incrementDailyUsage } from "./lib/wiki";
import type { AppVariables, Bindings } from "./types";

const app = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

app.use("*", corsMiddleware);

app.onError((error, c) => {
  const status = error instanceof HTTPException ? error.status : 500;

  return c.json(
    {
      ok: false,
      error: error.message || "Internal server error."
    },
    status
  );
});

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "knowlense-api",
    version: "0.1.0"
  })
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "knowlense-api",
    timestamp: new Date().toISOString()
  })
);

app.post("/analyze", async (c) => {
  const body: { text?: string; context?: string } = await c.req
    .json<{
      text?: string;
      context?: string;
    }>()
    .catch(() => ({} as { text?: string; context?: string }));

  const result = await analyzeEntity(
    {
      text: body.text,
      context: body.context
    },
    c.env.CACHE_KV
  );

  return c.json(result);
});

app.post("/api/analyze", async (c) => {
  const body: { text?: string; context?: string } = await c.req
    .json<{
      text?: string;
      context?: string;
    }>()
    .catch(() => ({} as { text?: string; context?: string }));

  const result = await analyzeEntity(
    {
      text: body.text,
      context: body.context
    },
    c.env.CACHE_KV
  );

  return c.json(result);
});

app.post("/api/auth/sync", requireAuth, async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const authUser = c.get("user");
  const body: { fullName?: string; avatarUrl?: string } = await c.req
    .json<{ fullName?: string; avatarUrl?: string }>()
    .catch(() => ({}));

  const fullName = body.fullName || authUser.fullName;
  const avatarUrl = body.avatarUrl || authUser.avatarUrl;

  const { error: profileUpsertError } = await supabase.from("profiles").upsert(
    {
      id: authUser.id,
      email: authUser.email,
      full_name: fullName,
      avatar_url: avatarUrl,
      subscription_plan: "free"
    },
    {
      onConflict: "id"
    }
  );

  if (profileUpsertError) {
    throw new HTTPException(500, {
      message: `Failed to sync user profile: ${profileUpsertError.message}`
    });
  }

  const { error: settingsUpsertError } = await supabase.from("user_settings").upsert(
    {
      user_id: authUser.id
    },
    {
      onConflict: "user_id"
    }
  );

  if (settingsUpsertError) {
    throw new HTTPException(500, {
      message: `Failed to ensure user settings: ${settingsUpsertError.message}`
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, subscription_plan, paddle_customer_id")
    .eq("id", authUser.id)
    .single();

  if (profileError) {
    throw new HTTPException(500, {
      message: `Failed to load synced user profile: ${profileError.message}`
    });
  }

  return c.json({
    ok: true,
    user: profile
  });
});

app.get("/api/subscription/status", requireAuth, async (c) => {
  const authUser = c.get("user");
  const subscription = await checkSubscriptionStatus(c.env, authUser.id);

  return c.json({
    ok: true,
    subscription
  });
});

app.get("/api/wiki/search", requireAuth, async (c) => {
  const authUser = c.get("user");
  const term = c.req.query("term") || "";
  const subscription = await checkSubscriptionStatus(c.env, authUser.id);

  if (!subscription.isPremium) {
    const usageKey = getUsageCounterKey(authUser.id);
    const usageCount = await incrementDailyUsage(authUser.id, usageKey, c.env.CACHE_KV);

    if (usageCount > 10) {
      throw new HTTPException(403, {
        message: "Please upgrade to Premium"
      });
    }
  }

  const result = await getWikiSummary(term, c.env.CACHE_KV);

  return c.json({
    ok: true,
    term: result.term,
    summary: result.extract,
    source: result.pageurl,
    subscription
  });
});

app.post("/api/user/settings", requireAuth, async (c) => {
  const authUser = c.get("user");
  const supabase = getSupabaseAdmin(c.env);
  const body: {
    whitelist?: string[] | Record<string, unknown>[];
    blacklist?: string[] | Record<string, unknown>[];
    preferredLanguage?: string;
  } = await c.req
    .json<{
      whitelist?: string[] | Record<string, unknown>[];
      blacklist?: string[] | Record<string, unknown>[];
      preferredLanguage?: string;
    }>()
    .catch(() => ({}));

  const payload = {
    user_id: authUser.id,
    whitelist: Array.isArray(body.whitelist) ? body.whitelist : [],
    blacklist: Array.isArray(body.blacklist) ? body.blacklist : [],
    preferred_language: body.preferredLanguage || "en-US"
  };

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(payload, {
      onConflict: "user_id"
    })
    .select("user_id, whitelist, blacklist, preferred_language")
    .single();

  if (error) {
    throw new HTTPException(500, {
      message: `Failed to update user settings: ${error.message}`
    });
  }

  return c.json({
    ok: true,
    settings: data
  });
});

app.post("/api/subscription/checkout", requireAuth, async (c) => {
  const authUser = c.get("user");
  const supabase = getSupabaseAdmin(c.env);
  const body: { plan?: "monthly" | "yearly"; customerEmail?: string } = await c.req
    .json<{ plan?: "monthly" | "yearly"; customerEmail?: string }>()
    .catch(() => ({}));
  const plan = body.plan === "yearly" ? "yearly" : "monthly";
  const priceId = plan === "yearly" ? c.env.PADDLE_PRICE_ID_YEARLY : c.env.PADDLE_PRICE_ID_MONTHLY;

  if (!c.env.PADDLE_API_KEY || !priceId) {
    throw new HTTPException(500, {
      message: "Missing Paddle API configuration."
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("paddle_customer_id, email")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    throw new HTTPException(500, {
      message: `Failed to load profile before checkout: ${profileError.message}`
    });
  }

  const paddleModule = await import("@paddle/paddle-node-sdk");
  const Paddle = (paddleModule as unknown as { Paddle: new (key: string, options?: Record<string, unknown>) => any }).Paddle;
  const paddle = new Paddle(c.env.PADDLE_API_KEY, {
    environment: c.env.PADDLE_ENVIRONMENT || "sandbox"
  });

  const transaction = await paddle.transactions.create({
    items: [
      {
        priceId,
        quantity: 1
      }
    ],
    customerId: profile?.paddle_customer_id || undefined,
    customerEmail: body.customerEmail || profile?.email || authUser.email || undefined,
    customData: {
      user_id: authUser.id,
      email: authUser.email,
      plan
    }
  });

  const checkoutUrl = transaction?.checkout?.url;

  if (!checkoutUrl) {
    throw new HTTPException(500, {
      message: "Failed to create Paddle checkout session."
    });
  }

  return c.json({
    ok: true,
    url: checkoutUrl
  });
});

app.post("/api/webhooks/paddle", async (c) => {
  const webhookSecret = c.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new HTTPException(500, {
      message: "Missing PADDLE_WEBHOOK_SECRET."
    });
  }

  const rawBody = await c.req.raw.text();
  const signatureHeader = c.req.header("Paddle-Signature");
  const validSignature = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);

  if (!validSignature) {
    throw new HTTPException(401, {
      message: "Invalid Paddle webhook signature."
    });
  }

  const payload = JSON.parse(rawBody) as PaddleWebhookEvent;
  const update = mapPaddleEventToSubscription(payload);

  if (!update) {
    return c.json({
      ok: true,
      ignored: true,
      eventType: payload.event_type
    });
  }

  const supabase = getSupabaseAdmin(c.env);
  const userLookup = await resolveUserLookup(supabase, update.userId, update.email);

  if (!userLookup) {
    throw new HTTPException(400, {
      message: "Webhook payload does not contain a usable user identifier."
    });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      subscription_plan: update.plan === "premium" ? update.billingPlan : "free",
      paddle_customer_id: update.paddleCustomerId
    })
    .eq("id", userLookup.id);

  if (profileError) {
    throw new HTTPException(500, {
      message: `Failed to update profile from Paddle webhook: ${profileError.message}`
    });
  }

  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userLookup.id,
      paddle_subscription_id: update.paddleSubscriptionId,
      status: update.planStatus,
      trial_ends_at: update.trialEndsAt,
      current_period_end: update.currentPeriodEnd
    },
    {
      onConflict: "user_id"
    }
  );

  if (subscriptionError) {
    throw new HTTPException(500, {
      message: `Failed to update subscription from Paddle webhook: ${subscriptionError.message}`
    });
  }

  return c.json({
    ok: true,
    updated: true,
    eventType: payload.event_type
  });
});

export default app;

type PaddleWebhookEvent = {
  event_type: string;
  data?: {
    id?: string;
    status?: string;
    collection_mode?: string;
    current_billing_period?: {
      starts_at?: string;
      ends_at?: string;
    };
    custom_data?: {
      user_id?: string;
      email?: string;
      plan?: "free" | "monthly" | "yearly";
    };
    customer_id?: string;
    customer?: {
      email?: string;
    };
  };
};

function mapPaddleEventToSubscription(payload: PaddleWebhookEvent) {
  const eventType = payload.event_type;
  const data = payload.data;

  if (!data) {
    return null;
  }

  const normalizedStatus = (data.status || "").toLowerCase();
  const isTrial = normalizedStatus === "trialing" || eventType.includes("trial");
  const isPremium = ["active", "trialing", "past_due"].includes(normalizedStatus) || eventType.startsWith("subscription.");
  const plan = isTrial ? "trial" : isPremium ? "premium" : "free";

  const planStatus =
    normalizedStatus || (eventType.includes("canceled") ? "canceled" : eventType.includes("paused") ? "paused" : "active");

  return {
    userId: data.custom_data?.user_id ?? null,
    email: data.custom_data?.email ?? data.customer?.email ?? null,
    billingPlan: data.custom_data?.plan ?? (isPremium ? "monthly" : "free"),
    plan,
    planStatus,
    paddleCustomerId: data.customer_id ?? null,
    paddleSubscriptionId: data.id ?? null,
    trialEndsAt: isTrial ? data.current_billing_period?.ends_at ?? null : null,
    currentPeriodEnd: data.current_billing_period?.ends_at ?? null
  };
}

async function resolveUserLookup(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | null,
  email: string | null
) {
  if (userId) {
    return { id: userId };
  }

  if (!email) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

  if (error) {
    throw new HTTPException(500, {
      message: `Failed to resolve profile by email: ${error.message}`
    });
  }

  return data;
}
