import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { corsMiddleware } from "./middleware/cors";
import { requireAuth } from "./middleware/auth";
import { getSupabaseAdmin } from "./lib/supabase";
import { verifyPaddleSignature } from "./lib/paddle";
import type { AppVariables, Bindings, SubscriptionState } from "./types";

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

app.post("/api/auth/sync", requireAuth, async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const authUser = c.get("user");
  const body: { fullName?: string; avatarUrl?: string } = await c.req
    .json<{ fullName?: string; avatarUrl?: string }>()
    .catch(() => ({}));

  const fullName = body.fullName || authUser.fullName;
  const avatarUrl = body.avatarUrl || authUser.avatarUrl;

  const { error: userUpsertError } = await supabase.from("users").upsert(
    {
      id: authUser.id,
      email: authUser.email,
      full_name: fullName,
      avatar_url: avatarUrl
    },
    {
      onConflict: "id"
    }
  );

  if (userUpsertError) {
    throw new HTTPException(500, {
      message: `Failed to sync user profile: ${userUpsertError.message}`
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
    .from("users")
    .select("id, email, full_name, avatar_url, plan, plan_status, trial_ends_at")
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
  const supabase = getSupabaseAdmin(c.env);
  const authUser = c.get("user");
  const { data, error } = await supabase
    .from("users")
    .select("plan, plan_status, trial_ends_at")
    .eq("id", authUser.id)
    .single();

  if (error) {
    throw new HTTPException(500, {
      message: `Failed to read subscription status: ${error.message}`
    });
  }

  const subscription = normalizeSubscription(data?.plan, data?.plan_status, data?.trial_ends_at);

  return c.json({
    ok: true,
    subscription
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
  let query = supabase.from("users").update({
    plan: update.plan,
    plan_status: update.planStatus,
    paddle_customer_id: update.paddleCustomerId,
    paddle_subscription_id: update.paddleSubscriptionId,
    trial_ends_at: update.trialEndsAt
  });

  if (update.userId) {
    query = query.eq("id", update.userId);
  } else if (update.email) {
    query = query.eq("email", update.email);
  } else {
    throw new HTTPException(400, {
      message: "Webhook payload does not contain a usable user identifier."
    });
  }

  const { error } = await query;

  if (error) {
    throw new HTTPException(500, {
      message: `Failed to update subscription from Paddle webhook: ${error.message}`
    });
  }

  return c.json({
    ok: true,
    updated: true,
    eventType: payload.event_type
  });
});

export default app;

function normalizeSubscription(
  plan: string | null | undefined,
  planStatus: string | null | undefined,
  trialEndsAt: string | null | undefined
) {
  const now = Date.now();
  const trialActive = Boolean(trialEndsAt && Number.isFinite(Date.parse(trialEndsAt)) && Date.parse(trialEndsAt) > now);
  const normalizedPlan = (plan || "free").toLowerCase();
  const normalizedStatus = (planStatus || "active").toLowerCase();

  let state: SubscriptionState = "free";

  if (trialActive || normalizedPlan === "trial") {
    state = "trial";
  } else if (normalizedPlan === "premium" || normalizedPlan === "paid") {
    state = "premium";
  }

  return {
    state,
    plan: normalizedPlan,
    status: normalizedStatus,
    trialEndsAt: trialEndsAt ?? null
  };
}

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
    plan,
    planStatus,
    paddleCustomerId: data.customer_id ?? null,
    paddleSubscriptionId: data.id ?? null,
    trialEndsAt: isTrial ? data.current_billing_period?.ends_at ?? null : null
  };
}
