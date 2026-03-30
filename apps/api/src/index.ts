import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";
import { analyzeKeywordSnapshot, type SearchSnapshot } from "./lib/keywordFinder";
import { analyzeProductKeywords, findRecentProductRun, type ProductKeywordSnapshot } from "./lib/productKeywords";
import {
  createOrUpdateRankTrackingTarget,
  deactivateRankTrackingTarget,
  listRankTrackingTargets,
  recordRankTrackingCheck,
  readRankTrackingDashboard,
  runScheduledRankTracking,
  type RankTrackingStatus
} from "./lib/rankTracking";
import { analyzeProductSeoAudit, analyzeProductSeoHealth, type ProductSeoAuditSnapshot } from "./lib/seoAuditor";

type Bindings = {
  CORS_ORIGIN?: string;
  DB: D1Database;
  PADDLE_ENVIRONMENT?: "sandbox" | "production";
  PADDLE_API_KEY?: string;
  PADDLE_PRICE_ID_MONTHLY?: string;
  PADDLE_PRICE_ID_YEARLY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type Variables = {
  user: {
    email: string | null;
    id: string;
    name: string | null;
    avatarUrl: string | null;
    emailConfirmed: boolean;
    authType: "supabase" | "extension";
  };
};

type StoredKeywordRun = {
  id: string;
  query_text: string;
  summary: {
    query: string;
    normalizedQuery: string;
    totalResults: number;
    capturedAt: string;
    dominantTerms: string[];
    adjacentModifiers: string[];
    saturatedPhrases: string[];
  };
  keywords: Array<{
    phrase: string;
    opportunityScore: number;
    frequency: number;
    saturationLevel: "low" | "medium" | "high";
    reason: string;
  }>;
  opportunities: Array<{
    phrase: string;
    score: number;
    type: "adjacent" | "underserved";
    reason: string;
  }>;
  created_at: string;
};

type StoredProductKeywordRun = {
  id: string;
  product_id: string | null;
  product_url: string;
  title_text: string;
  intent: {
    topics: string[];
    formats: string[];
    contexts: string[];
    grades: string[];
    subjects: string[];
    mainSeeds: string[];
  };
  summary: {
    generatedKeywords: number;
    checkedKeywords: number;
    rankedKeywords: number;
    bestRank: number;
    analyzedAt: string;
    cooldownMinutes: number;
    cacheHitCount: number;
    note: string;
  };
  keywords: Array<{
    keyword: string;
    score: number;
    source: "product" | "tpt";
    rankPosition: number;
    resultPage: number | null;
    status: "ranked" | "beyond_page_3";
    confidence: "high" | "medium" | "low";
    searchUrl: string;
    checkedAt: string;
  }>;
  created_at: string;
};

type StoredProductSeoAudit = {
  id: string;
  product_id: string | null;
  product_url: string;
  title_text: string;
  primary_keyword: string | null;
  audit: {
    keyword: string;
    seoScore: number;
    relatedSuggestions: string[];
    titlePlacement: {
      mentionCount: number;
      status: "good" | "missing" | "stuffed";
      message: string;
    };
    descriptionPlacement: {
      mentionCount: number;
      status: "good" | "missing" | "stuffed";
      message: string;
    };
    checks: {
      titleContainsKeyword: boolean;
      descriptionContainsKeyword: boolean;
      titleLengthOk: boolean;
      titleKeywordRepeated: boolean;
      descriptionKeywordOverused: boolean;
      subjectsComplete: boolean;
      tagsComplete: boolean;
      pagesFilled: boolean;
      mediaComplete: boolean;
      discountEnabled: boolean;
      bundleEnabled: boolean;
      hasInternalProductLink: boolean;
    };
    counts: {
      titleLength: number;
      titleKeywordMentions: number;
      descriptionKeywordMentions: number;
      subjectsCount: number;
      tagsCount: number;
      imageCount: number;
      hasVideo: boolean;
      hasReviewSection: boolean;
    };
    actionItems: string[];
    analyzedAt: string;
    note: string;
  };
  created_at: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function createAdminClient(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}

function createAuthClient(env: Bindings) {
  if (!env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY is not configured on knowlense-api.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json"
  };
}

async function hashToken(token: string) {
  const input = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createExtensionToken() {
  const randomValues = crypto.getRandomValues(new Uint8Array(24));
  const tokenBody = btoa(String.fromCharCode(...randomValues)).replace(/[+/=]/g, "").slice(0, 32);
  return `knlx_${tokenBody}`;
}

function isoFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function normalizeSupabaseUser(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};
  const displayName =
    typeof metadata.display_name === "string"
      ? metadata.display_name
      : typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof user.email === "string"
          ? user.email.split("@")[0]
          : null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  return {
    id: user.id,
    email: user.email ?? null,
    name: displayName,
    avatarUrl,
    emailConfirmed: Boolean(user.email_confirmed_at),
    authType: "supabase" as const
  };
}

function getDefaultDashboardMetrics(billingConfigured: boolean) {
  return {
    metrics: {
      websiteSessions: {
        value: 0,
        delta: "--"
      },
      billing: {
        status: "free" as const,
        planName: "Free",
        trialEligible: true,
        trialActive: false,
        trialDaysRemaining: 0,
        readiness: billingConfigured ? "Upgrade" : "Setup",
        ctaLabel: billingConfigured ? "Upgrade" : "Configure",
        delta: billingConfigured ? "--" : "Action needed"
      },
      keywordRuns: {
        used: 0,
        limit: 10,
        remaining: 10,
        disabled: false,
        delta: "--"
      },
      extensionStatus: {
        status: "alert" as const,
        label: "Alert",
        delta: "Reconnect"
      }
    }
  };
}

async function ensureBillingTables(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS billing_profiles (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'free',
      plan_name TEXT NOT NULL DEFAULT 'Free',
      trial_started_at TEXT,
      trial_ends_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);
}

async function readBillingProfile(db: D1Database, userId: string) {
  await ensureBillingTables(db);

  const row = await db.prepare(
    `SELECT user_id, status, plan_name, trial_started_at, trial_ends_at, updated_at
     FROM billing_profiles
     WHERE user_id = ?1
     LIMIT 1`
  ).bind(userId).first<{
    user_id: string;
    status: string;
    plan_name: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    updated_at: string;
  }>();

  if (!row) {
    return {
      status: "free" as const,
      planName: "Free",
      trialEligible: true,
      trialActive: false,
      trialDaysRemaining: 0
    };
  }

  if (row.status === "trial" && row.trial_ends_at) {
    const remainingMs = new Date(row.trial_ends_at).getTime() - Date.now();

    if (remainingMs <= 0) {
      await db.prepare(
        `UPDATE billing_profiles
         SET status = 'free', plan_name = 'Free', trial_started_at = NULL, trial_ends_at = NULL, updated_at = ?2
         WHERE user_id = ?1`
      ).bind(userId, new Date().toISOString()).run();

      return {
        status: "expired" as const,
        planName: "Free",
        trialEligible: false,
        trialActive: false,
        trialDaysRemaining: 0
      };
    }

    return {
      status: "trial" as const,
      planName: "Premium Trial",
      trialEligible: false,
      trialActive: true,
      trialDaysRemaining: Math.max(Math.ceil(remainingMs / (1000 * 60 * 60 * 24)), 1)
    };
  }

  if (row.status === "premium" || row.status === "active") {
    return {
      status: "active" as const,
      planName: row.plan_name || "Premium",
      trialEligible: false,
      trialActive: false,
      trialDaysRemaining: 0
    };
  }

  return {
    status: row.status === "expired" ? ("expired" as const) : ("free" as const),
    planName: row.plan_name || "Free",
    trialEligible: row.trial_started_at == null,
    trialActive: false,
    trialDaysRemaining: 0
  };
}

function getDefaultDashboardOverview(user: Variables["user"]) {
  return {
    overview: {
      currentAccount: {
        value: user.email ?? user.id,
        status: "active"
      },
      latestQuery: {
        value: "Waiting",
        status: "waiting" as const,
        updatedAt: null
      },
      nextAction: {
        value: "Connect"
      },
      recentRuns: [],
      quota: {
        used: 0,
        limit: 10,
        atLimit: false
      }
    }
  };
}

async function authenticateSupabaseToken(env: Bindings, token: string) {
  const supabase = createAdminClient(env);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return normalizeSupabaseUser(data.user);
}

async function authenticateExtensionToken(env: Bindings, token: string) {
  const tokenHash = await hashToken(token);
  const session = await env.DB.prepare(
    `SELECT user_id, user_email
     FROM extension_sessions
     WHERE token_hash = ?1
       AND revoked_at IS NULL
       AND datetime(expires_at) > datetime('now')
     LIMIT 1`
  )
    .bind(tokenHash)
    .first<{ user_id: string; user_email: string | null }>();

  if (!session) {
    return null;
  }

  return {
    id: session.user_id,
    email: session.user_email,
    name: session.user_email?.split("@")[0] ?? null,
    avatarUrl: null,
    emailConfirmed: true,
    authType: "extension" as const
  };
}

async function authenticateRequest(c: {
  req: { header: (name: string) => string | undefined };
  env: Bindings;
  set: (key: "user", value: Variables["user"]) => void;
}) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { error: "Missing bearer token.", status: 401 as const };
  }

  const user =
    token.startsWith("knlx_") ? await authenticateExtensionToken(c.env, token) : await authenticateSupabaseToken(c.env, token);

  if (!user) {
    return { error: "Invalid session.", status: 401 as const };
  }

  c.set("user", user);
  return null;
}

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.CORS_ORIGIN ?? "*";
      if (allowedOrigin === "*" || !origin) {
        return allowedOrigin;
      }
      return origin === allowedOrigin ? origin : allowedOrigin;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
  })
);

app.get("/", (c) => c.json({ name: "knowlense-api", status: "ok" }));

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString()
  })
);

app.get("/v1/public/config", (c) =>
  c.json({
    app: "Knowlense",
    paddleEnvironment: c.env.PADDLE_ENVIRONMENT ?? "sandbox"
  })
);

app.post("/v1/auth/sign-in", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return c.json({ error: "Email and password are required." }, 400);
    }

    const supabase = createAuthClient(c.env);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    if (!data.session || !data.user) {
      return c.json({ error: "Supabase did not return a session." }, 500);
    }

    return c.json({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null
      },
      user: normalizeSupabaseUser(data.user)
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to sign in." }, 500);
  }
});

app.post("/v1/auth/sign-up", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : undefined;

    if (!email || !password || !displayName) {
      return c.json({ error: "Email, password, and display name are required." }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters long." }, 400);
    }

    const supabase = createAuthClient(c.env);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          display_name: displayName
        }
      }
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({
      session: data.session
        ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? null
          }
        : null,
      user: data.user ? normalizeSupabaseUser(data.user) : null,
      identitiesLength: data.user?.identities?.length ?? null,
      requiresEmailVerification: !data.session
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to sign up." }, 500);
  }
});

app.post("/v1/auth/oauth/start", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const provider = body?.provider;
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : "";

    if (provider !== "google" && provider !== "github") {
      return c.json({ error: "Unsupported OAuth provider." }, 400);
    }

    if (!redirectTo) {
      return c.json({ error: "Missing redirect URL." }, 400);
    }

    const supabase = createAuthClient(c.env);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error || !data.url) {
      return c.json({ error: error?.message ?? "Unable to start OAuth flow." }, 400);
    }

    return c.json({ url: data.url });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to start OAuth flow." }, 500);
  }
});

app.post("/v1/auth/exchange-code", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code : "";

    if (!code) {
      return c.json({ error: "Missing OAuth code." }, 400);
    }

    const supabase = createAuthClient(c.env);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    if (!data.session || !data.user) {
      return c.json({ error: "Supabase did not return a session." }, 500);
    }

    return c.json({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null
      },
      user: normalizeSupabaseUser(data.user)
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to exchange OAuth code." }, 500);
  }
});

app.post("/v1/auth/forgot-password", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : "";

    if (!email || !redirectTo) {
      return c.json({ error: "Email and redirect URL are required." }, 400);
    }

    const supabase = createAuthClient(c.env);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to send password reset email." }, 500);
  }
});

app.post("/v1/auth/resend-verification", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : "";

    if (!email || !redirectTo) {
      return c.json({ error: "Email and redirect URL are required." }, 400);
    }

    const supabase = createAuthClient(c.env);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to resend verification email." }, 500);
  }
});

app.use("/v1/me", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.get("/v1/me", async (c) => {
  const user = c.get("user");
  const billing = await readBillingProfile(c.env.DB, user.id);

  return c.json({
    user,
    billing
  });
});

app.use("/v1/auth/change-password", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.post("/v1/auth/change-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const user = c.get("user");

  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters long." }, 400);
  }

  const supabase = createAdminClient(c.env);
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ ok: true });
});

app.post("/v1/auth/sign-out", async (c) => c.json({ ok: true }));

app.post("/v1/extension/session/start", async (c) => {
  const requestId = crypto.randomUUID();
  const expiresAt = isoFromNow(10);

  try {
    await c.env.DB.prepare(
      `INSERT INTO extension_connection_requests (id, status, expires_at)
       VALUES (?1, 'pending', ?2)`
    )
      .bind(requestId, expiresAt)
      .run();
  } catch {
    return c.json({ error: "Unable to start extension connection flow." }, 500);
  }

  return c.json({
    requestId,
    expiresAt
  });
});

app.get("/v1/extension/session/poll", async (c) => {
  const requestId = c.req.query("requestId");

  if (!requestId) {
    return c.json({ error: "Missing requestId." }, 400);
  }

  const request = await c.env.DB.prepare(
    `SELECT id, status, user_email, session_id, expires_at, claimed_at
     FROM extension_connection_requests
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(requestId)
    .first<{
      id: string;
      status: string;
      user_email: string | null;
      session_id: string | null;
      expires_at: string;
      claimed_at: string | null;
    }>();

  if (!request) {
    return c.json({ error: "Unknown connection request." }, 404);
  }

  if (new Date(request.expires_at).getTime() <= Date.now()) {
    return c.json({ status: "expired" });
  }

  if (request.status !== "authorized" || !request.session_id) {
    return c.json({ status: request.status });
  }

  const session = await c.env.DB.prepare(
    `SELECT token_hash, user_id, user_email, expires_at
     FROM extension_sessions
     WHERE id = ?1
       AND revoked_at IS NULL
     LIMIT 1`
  )
    .bind(request.session_id)
    .first<{ token_hash: string; user_id: string; user_email: string | null; expires_at: string }>();

  if (!session) {
    return c.json({ status: "pending" });
  }

  const tokenDelivery = await c.env.DB.prepare(
    `SELECT token_plaintext
     FROM extension_connection_requests
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(requestId)
    .first<{ token_plaintext: string | null }>()
    .catch(() => null);

  if (!tokenDelivery?.token_plaintext) {
    return c.json({ status: "pending" });
  }

  await c.env.DB.prepare(
    `UPDATE extension_connection_requests
     SET claimed_at = COALESCE(claimed_at, CURRENT_TIMESTAMP)
     WHERE id = ?1`
  )
    .bind(requestId)
    .run();

  return c.json({
    status: "connected",
    sessionToken: tokenDelivery.token_plaintext,
    user: {
      id: session.user_id,
      email: session.user_email
    },
    expiresAt: session.expires_at
  });
});

app.use("/v1/extension/session/authorize", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  const user = c.get("user");
  if (user.authType !== "supabase") {
    return c.json({ error: "Website authorization requires a Supabase web session." }, 403);
  }

  await next();
});

app.post("/v1/extension/session/authorize", async (c) => {
  const body = await c.req.json().catch(() => null);
  const requestId = body?.requestId as string | undefined;

  if (!requestId) {
    return c.json({ error: "Missing requestId." }, 400);
  }

  const request = await c.env.DB.prepare(
    `SELECT id, status, expires_at
     FROM extension_connection_requests
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(requestId)
    .first<{ id: string; status: string; expires_at: string }>();

  if (!request) {
    return c.json({ error: "Unknown connection request." }, 404);
  }

  if (new Date(request.expires_at).getTime() <= Date.now()) {
    return c.json({ error: "Connection request expired." }, 410);
  }

  const user = c.get("user");
  const sessionId = crypto.randomUUID();
  const sessionToken = createExtensionToken();
  const tokenHash = await hashToken(sessionToken);
  const sessionExpiresAt = isoFromNow(60 * 24 * 365);

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO extension_sessions (id, user_id, user_email, token_hash, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      ).bind(sessionId, user.id, user.email, tokenHash, sessionExpiresAt),
      c.env.DB.prepare(
        `UPDATE extension_connection_requests
         SET status = 'authorized',
             user_id = ?2,
             user_email = ?3,
             session_id = ?4,
             token_plaintext = ?5
         WHERE id = ?1`
      ).bind(requestId, user.id, user.email, sessionId, sessionToken)
    ]);
  } catch {
    return c.json({ error: "Unable to authorize extension session." }, 500);
  }

  return c.json({
    connected: true,
    user: {
      id: user.id,
      email: user.email
    }
  });
});

app.use("/v1/keyword-finder/*", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.use("/v1/product-keywords/*", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.post("/v1/keyword-finder/analyze", async (c) => {
  const body = (await c.req.json().catch(() => null)) as SearchSnapshot | null;

  if (!body?.query || !body?.pageUrl || !Array.isArray(body.results) || body.results.length === 0) {
    return c.json({ error: "Invalid keyword snapshot payload." }, 400);
  }

  const user = c.get("user");
  const analysis = analyzeKeywordSnapshot(body);
  const snapshotId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const capturedAt = body.capturedAt ?? new Date().toISOString();
  let persisted = false;
  let warning: string | null = null;

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO search_snapshots (id, user_id, query_text, page_url, result_count, captured_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      ).bind(snapshotId, user.id, body.query, body.pageUrl, body.results.length, capturedAt),
      ...body.results.map((result) =>
        c.env.DB.prepare(
          `INSERT INTO search_results (snapshot_id, position, title, product_url, shop_name, price_text, snippet)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        ).bind(
          snapshotId,
          result.position,
          result.title,
          result.productUrl ?? null,
          result.shopName ?? null,
          result.priceText ?? null,
          result.snippet ?? null
        )
      ),
      c.env.DB.prepare(
        `INSERT INTO keyword_runs (id, user_id, snapshot_id, query_text, summary_json, keywords_json, opportunities_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(
        runId,
        user.id,
        snapshotId,
        body.query,
        JSON.stringify(analysis.summary),
        JSON.stringify(analysis.keywords),
        JSON.stringify(analysis.opportunities)
      )
    ]);

    persisted = true;
  } catch {
    warning = "Analysis succeeded, but persistence failed. Confirm the D1 binding and migration are applied.";
  }

  return c.json({
    persisted,
    warning,
    analysis
  });
});

app.get("/v1/keyword-finder/runs", async (c) => {
  const user = c.get("user");

  try {
    const result = await c.env.DB.prepare(
      `SELECT id, query_text, summary_json, keywords_json, opportunities_json, created_at
       FROM keyword_runs
       WHERE user_id = ?1
       ORDER BY datetime(created_at) DESC
       LIMIT 8`
    )
      .bind(user.id)
      .all<{
        id: string;
        query_text: string;
        summary_json: string;
        keywords_json: string;
        opportunities_json: string;
        created_at: string;
      }>();

    const runs: StoredKeywordRun[] = (result.results ?? []).map((row) => ({
      id: row.id,
      query_text: row.query_text,
      summary: JSON.parse(row.summary_json),
      keywords: JSON.parse(row.keywords_json),
      opportunities: JSON.parse(row.opportunities_json),
      created_at: row.created_at
    }));

    return c.json({ runs });
  } catch {
    return c.json({
      runs: [],
      warning: "Keyword Finder history is unavailable until the D1 database is bound and migrated."
    });
  }
});

app.post("/v1/product-keywords/analyze", async (c) => {
  const body = (await c.req.json().catch(() => null)) as ProductKeywordSnapshot | null;

  if (!body?.productUrl || !body?.title || !body?.descriptionExcerpt) {
    return c.json({ error: "Invalid product snapshot payload." }, 400);
  }

  const user = c.get("user");
  const productId = body.productId ?? body.productUrl.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
  const recentRun = await findRecentProductRun(c.env.DB, user.id, productId, body.productUrl, 30).catch(() => null);

  if (recentRun) {
    return c.json({
      runId: recentRun.runId,
      persisted: true,
      cached: true,
      cooldownMinutes: recentRun.analysis.summary.cooldownMinutes,
      analysis: recentRun.analysis
    });
  }

  const analysis = await analyzeProductKeywords(body, {
    db: c.env.DB,
    cooldownMinutes: 30,
    cacheHours: 24
  });
  const runId = crypto.randomUUID();
  let persisted = false;
  let warning: string | null = null;

  try {
    await c.env.DB.prepare(
      `INSERT INTO product_keyword_runs (id, user_id, product_id, product_url, title_text, snapshot_json, summary_json, keywords_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        runId,
        user.id,
        analysis.product.id,
        analysis.product.url,
        analysis.product.title,
        JSON.stringify(body),
        JSON.stringify({
          intent: analysis.intent,
          summary: analysis.summary
        }),
        JSON.stringify(analysis.keywords)
      )
      .run();

    persisted = true;
  } catch {
    warning = "Analysis completed, but persistence failed. Confirm the D1 migration is applied.";
  }

  return c.json({
    runId,
    persisted,
    cached: false,
    cooldownMinutes: analysis.summary.cooldownMinutes,
    warning,
    analysis
  });
});

app.get("/v1/product-keywords/runs", async (c) => {
  const user = c.get("user");

  try {
    const result = await c.env.DB.prepare(
      `SELECT id, product_id, product_url, title_text, summary_json, keywords_json, created_at
       FROM product_keyword_runs
       WHERE user_id = ?1
       ORDER BY datetime(created_at) DESC
       LIMIT 10`
    )
      .bind(user.id)
      .all<{
        id: string;
        product_id: string | null;
        product_url: string;
        title_text: string;
        summary_json: string;
        keywords_json: string;
        created_at: string;
      }>();

    const runs: StoredProductKeywordRun[] = (result.results ?? []).map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_url: row.product_url,
      title_text: row.title_text,
      intent: JSON.parse(row.summary_json).intent,
      summary: JSON.parse(row.summary_json).summary,
      keywords: JSON.parse(row.keywords_json),
      created_at: row.created_at
    }));

    return c.json({ runs });
  } catch {
    return c.json({
      runs: [],
      warning: "Product keyword history is unavailable until the D1 migration is applied."
    });
  }
});

app.use("/v1/product-seo-audit/*", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.post("/v1/product-seo-audit/analyze", async (c) => {
  const body = (await c.req.json().catch(() => null)) as ProductSeoAuditSnapshot | null;

  if (!body?.productUrl || !body?.title || !body?.auditKeyword?.trim()) {
    return c.json({ error: "Invalid SEO audit snapshot payload." }, 400);
  }

  const user = c.get("user");

  const analysis = await analyzeProductSeoAudit(body, {
    db: c.env.DB,
    userId: user.id
  });

  const runId = crypto.randomUUID();
  let persisted = false;
  let warning: string | null = null;

  try {
    await c.env.DB.prepare(
      `INSERT INTO product_seo_audits (
         id, user_id, seller_name, product_id, product_url, title_text, primary_keyword, audit_json
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        runId,
        user.id,
        analysis.product.sellerName,
        analysis.product.id,
        analysis.product.url,
        analysis.product.title,
        analysis.audit.keyword,
        JSON.stringify(analysis)
      )
      .run();

    persisted = true;
  } catch {
    warning = "SEO audit completed, but persistence failed. Confirm the D1 migration is applied.";
  }

  return c.json({
    runId,
    persisted,
    cached: false,
    warning,
    analysis
  });
});

app.get("/v1/product-seo-audit/runs", async (c) => {
  const user = c.get("user");

  try {
    const result = await c.env.DB.prepare(
      `SELECT id, product_id, product_url, title_text, primary_keyword, audit_json, created_at
       FROM product_seo_audits
       WHERE user_id = ?1
       ORDER BY datetime(created_at) DESC
       LIMIT 10`
    )
      .bind(user.id)
      .all<{
        id: string;
        product_id: string | null;
        product_url: string;
        title_text: string;
        primary_keyword: string | null;
        audit_json: string;
        created_at: string;
      }>();

    const runs: StoredProductSeoAudit[] = (result.results ?? []).map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_url: row.product_url,
      title_text: row.title_text,
      primary_keyword: row.primary_keyword,
      audit: JSON.parse(row.audit_json).audit,
      created_at: row.created_at
    }));

    return c.json({ runs });
  } catch {
  return c.json({
    runs: [],
    warning: "Product SEO audit history is unavailable until the D1 migration is applied."
  });
  }
});

app.use("/v1/product-seo-health/*", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.post("/v1/product-seo-health/analyze", async (c) => {
  const body = (await c.req.json().catch(() => null)) as ProductSeoAuditSnapshot | null;

  if (!body?.productUrl || !body?.title) {
    return c.json({ error: "Invalid SEO health payload." }, 400);
  }

  const user = c.get("user");
  const analysis = await analyzeProductSeoHealth(body, {
    db: c.env.DB,
    userId: user.id
  });

  return c.json({ analysis });
});

app.use("/v1/rank-tracking/*", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.get("/v1/rank-tracking/targets", async (c) => {
  const user = c.get("user");
  const productId = c.req.query("productId") || null;
  const productUrl = c.req.query("productUrl") || null;
  const activeOnly = c.req.query("activeOnly") !== "false";
  const targets = await listRankTrackingTargets(c.env.DB, user.id, {
    productId,
    productUrl,
    activeOnly
  });

  return c.json({ targets });
});

app.post("/v1/rank-tracking/targets", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | {
        productId?: string | null;
        productUrl?: string;
        productTitle?: string;
        sellerName?: string | null;
        keyword?: string;
        initialCheck?: {
          checkedAt?: string;
          status?: RankTrackingStatus;
          resultPage?: number | null;
          pagePosition?: number | null;
          searchUrl?: string | null;
        };
      }
    | null;

  if (!body?.productUrl || !body?.productTitle || !body?.keyword?.trim() || !body.initialCheck?.status) {
    return c.json({ error: "Invalid rank tracking payload." }, 400);
  }

  const user = c.get("user");
  const target = await createOrUpdateRankTrackingTarget(c.env.DB, {
    userId: user.id,
    productId: body.productId ?? null,
    productUrl: body.productUrl,
    productTitle: body.productTitle,
    sellerName: body.sellerName ?? null,
    keyword: body.keyword,
    initialCheck: {
      checkedAt: body.initialCheck.checkedAt,
      source: "manual",
      status: body.initialCheck.status,
      resultPage: body.initialCheck.resultPage ?? null,
      pagePosition: body.initialCheck.pagePosition ?? null,
      searchUrl: body.initialCheck.searchUrl ?? null
    }
  });

  return c.json({ target });
});

app.delete("/v1/rank-tracking/targets/:targetId", async (c) => {
  const user = c.get("user");
  const targetId = c.req.param("targetId");

  if (!targetId) {
    return c.json({ error: "Missing rank tracking target id." }, 400);
  }

  await deactivateRankTrackingTarget(c.env.DB, user.id, targetId);
  return c.json({ success: true });
});

app.post("/v1/rank-tracking/checks", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | {
        targetId?: string;
        check?: {
          checkedAt?: string;
          status?: RankTrackingStatus;
          resultPage?: number | null;
          pagePosition?: number | null;
          searchUrl?: string | null;
        };
      }
    | null;

  if (!body?.targetId || !body.check?.status) {
    return c.json({ error: "Invalid rank tracking check payload." }, 400);
  }

  const user = c.get("user");

  try {
    const target = await recordRankTrackingCheck(c.env.DB, {
      userId: user.id,
      targetId: body.targetId,
      check: {
        checkedAt: body.check.checkedAt,
        source: "scheduled",
        status: body.check.status,
        resultPage: body.check.resultPage ?? null,
        pagePosition: body.check.pagePosition ?? null,
        searchUrl: body.check.searchUrl ?? null
      }
    });

    return c.json({ target });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to store rank tracking check." }, 404);
  }
});

app.use("/v1/dashboard/*", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.get("/v1/dashboard/metrics", async (c) => {
  const user = c.get("user");
  const billingConfigured = Boolean(c.env.PADDLE_PRICE_ID_MONTHLY && c.env.PADDLE_PRICE_ID_YEARLY);

  try {
    const [keywordRunCountResult, extensionSessionCountResult, billingState] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM keyword_runs WHERE user_id = ?1`).bind(user.id).first<{ total: number | string }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as total
         FROM extension_sessions
         WHERE user_id = ?1
           AND revoked_at IS NULL
           AND datetime(expires_at) > datetime('now')`
      )
        .bind(user.id)
        .first<{ total: number | string }>(),
      readBillingProfile(c.env.DB, user.id)
    ]);

    const runsUsed = Number(keywordRunCountResult?.total ?? 0);
    const runsLimit = 10;
    const extensionActive = Number(extensionSessionCountResult?.total ?? 0) > 0;

    return c.json({
      metrics: {
        websiteSessions: {
          value: 1,
          delta: "+0.43%"
        },
        billing: {
          status: billingState.status,
          planName: billingState.planName,
          trialEligible: billingState.trialEligible,
          trialActive: billingState.trialActive,
          trialDaysRemaining: billingState.trialDaysRemaining,
          readiness:
            billingState.status === "active"
              ? "Premium"
              : billingState.status === "trial"
                ? `${billingState.trialDaysRemaining} day trial`
                : billingConfigured
                  ? "Upgrade"
                  : "Setup",
          ctaLabel:
            billingState.status === "active"
              ? "Manage"
              : billingState.status === "trial"
                ? "Upgrade"
                : billingConfigured
                  ? "Upgrade"
                  : "Configure",
          delta:
            billingState.status === "trial"
              ? `${billingState.trialDaysRemaining} days left`
              : billingConfigured
                ? "+4.35%"
                : "Action needed"
        },
        keywordRuns: {
          used: runsUsed,
          limit: runsLimit,
          remaining: Math.max(runsLimit - runsUsed, 0),
          disabled: runsUsed >= runsLimit,
          delta: "+2.59%"
        },
        extensionStatus: {
          status: extensionActive ? "active" : "alert",
          label: extensionActive ? "Active" : "Alert",
          delta: extensionActive ? "+0.95%" : "Reconnect"
        }
      }
    });
  } catch {
    return c.json({
      ...getDefaultDashboardMetrics(billingConfigured),
      warning: "Dashboard metrics are temporarily unavailable."
    });
  }
});

app.get("/v1/dashboard/extension-status", async (c) => {
  const user = c.get("user");

  try {
    const extensionSessionCountResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total
       FROM extension_sessions
       WHERE user_id = ?1
         AND revoked_at IS NULL
         AND datetime(expires_at) > datetime('now')`
    )
      .bind(user.id)
      .first<{ total: number | string }>();

    const active = Number(extensionSessionCountResult?.total ?? 0) > 0;

    return c.json({
      status: active ? "active" : "alert",
      label: active ? "Active" : "Alert",
      connected: active
    });
  } catch {
    return c.json({
      status: "alert",
      label: "Alert",
      connected: false,
      warning: "Extension status is temporarily unavailable."
    });
  }
});

app.get("/v1/dashboard/rank-tracking", async (c) => {
  const user = c.get("user");
  const range = (c.req.query("range") as "7d" | "30d" | "90d" | "all" | undefined) ?? "30d";
  const targetId = c.req.query("targetId") || null;

  try {
    const rankTracking = await readRankTrackingDashboard(c.env.DB, user.id, {
      range,
      targetId
    });

    return c.json({ rankTracking });
  } catch {
    return c.json({ error: "Rank tracking dashboard data is temporarily unavailable." }, 500);
  }
});

app.get("/v1/dashboard/overview", async (c) => {
  const user = c.get("user");

  try {
    const [latestRunResult, recentRunsResult, extensionSessionCountResult, keywordRunCountResult, billingState] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, query_text, summary_json, created_at
         FROM keyword_runs
         WHERE user_id = ?1
         ORDER BY datetime(created_at) DESC
         LIMIT 1`
      )
        .bind(user.id)
        .first<{ id: string; query_text: string; summary_json: string; created_at: string }>(),
      c.env.DB.prepare(
        `SELECT id, query_text, summary_json, opportunities_json, created_at
         FROM keyword_runs
         WHERE user_id = ?1
         ORDER BY datetime(created_at) DESC
         LIMIT 4`
      )
        .bind(user.id)
        .all<{
          id: string;
          query_text: string;
          summary_json: string;
          opportunities_json: string;
          created_at: string;
        }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as total
         FROM extension_sessions
         WHERE user_id = ?1
           AND revoked_at IS NULL
           AND datetime(expires_at) > datetime('now')`
      )
        .bind(user.id)
        .first<{ total: number | string }>(),
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM keyword_runs WHERE user_id = ?1`).bind(user.id).first<{ total: number | string }>(),
      readBillingProfile(c.env.DB, user.id)
    ]);

    const recentRuns = (recentRunsResult.results ?? []).map((row) => {
      const summary = JSON.parse(row.summary_json ?? "{}") as StoredKeywordRun["summary"];
      const opportunities = JSON.parse(row.opportunities_json ?? "[]") as StoredKeywordRun["opportunities"];

      return {
        id: row.id,
        createdAt: row.created_at,
        query: row.query_text,
        summary,
        opportunities
      };
    });

    const extensionActive = Number(extensionSessionCountResult?.total ?? 0) > 0;
    const runsUsed = Number(keywordRunCountResult?.total ?? 0);
    const runsLimit = 10;
    const latestSummary = latestRunResult ? (JSON.parse(latestRunResult.summary_json ?? "{}") as StoredKeywordRun["summary"]) : null;
    const latestQueryStatus = latestRunResult ? "completed" : "waiting";

    return c.json({
      overview: {
        currentAccount: {
          value: user.email ?? user.id,
          status: "active"
        },
        latestQuery: {
          value: latestSummary?.query ?? "Waiting",
          status: latestQueryStatus,
          updatedAt: latestRunResult?.created_at ?? null
        },
        nextAction: {
          value:
            !extensionActive
              ? "Connect"
              : billingState.status === "free" || billingState.status === "expired"
                ? "Start trial"
                : runsUsed >= runsLimit
                  ? "Upgrade"
                  : recentRuns.length > 0
                    ? "Review runs"
                    : "Analyze first query"
        },
        recentRuns,
        quota: {
          used: runsUsed,
          limit: runsLimit,
          atLimit: runsUsed >= runsLimit
        }
      }
    });
  } catch {
    return c.json({
      ...getDefaultDashboardOverview(user),
      warning: "Dashboard overview is temporarily unavailable."
    });
  }
});

app.post("/v1/dashboard/trial/start", async (c) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  const user = c.get("user");

  try {
    const billingState = await readBillingProfile(c.env.DB, user.id);

    if (billingState.status === "active") {
      return c.json({ error: "Premium is already active for this account." }, 400);
    }

    if (billingState.status === "trial") {
      return c.json({
        trial: {
          status: "trial",
          planName: billingState.planName,
          trialDaysRemaining: billingState.trialDaysRemaining
        }
      });
    }

    const startedAt = new Date().toISOString();
    const endsAt = isoFromNow(60 * 24 * 7);

    await ensureBillingTables(c.env.DB);
    await c.env.DB.prepare(
      `INSERT INTO billing_profiles (user_id, status, plan_name, trial_started_at, trial_ends_at, updated_at)
       VALUES (?1, 'trial', 'Premium Trial', ?2, ?3, ?2)
       ON CONFLICT(user_id) DO UPDATE SET
         status = 'trial',
         plan_name = 'Premium Trial',
         trial_started_at = excluded.trial_started_at,
         trial_ends_at = excluded.trial_ends_at,
         updated_at = excluded.updated_at`
    )
      .bind(user.id, startedAt, endsAt)
      .run();

    return c.json({
      trial: {
        status: "trial",
        planName: "Premium Trial",
        trialDaysRemaining: 7
      }
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to start trial." }, 500);
  }
});

app.post("/v1/billing/checkout", async (c) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  const body = await c.req.json().catch(() => null);
  const interval = body?.interval as "monthly" | "yearly" | undefined;
  const user = c.get("user");

  if (!interval || !["monthly", "yearly"].includes(interval)) {
    return c.json({ error: "Invalid billing interval." }, 400);
  }

  const priceId = interval === "monthly" ? c.env.PADDLE_PRICE_ID_MONTHLY : c.env.PADDLE_PRICE_ID_YEARLY;
  const apiKey = c.env.PADDLE_API_KEY;

  if (!priceId || !apiKey) {
    return c.json({ error: "Paddle checkout is not configured." }, 500);
  }

  const paddleBaseUrl = c.env.PADDLE_ENVIRONMENT === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

  const response = await fetch(`${paddleBaseUrl}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...jsonHeaders()
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: "automatic",
      custom_data: {
        app: "Knowlense",
        plan: interval,
        user_id: user.id,
        user_email: user.email
      }
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        data?: {
          checkout?: {
            url?: string;
          };
        };
        error?: {
          detail?: string;
          message?: string;
        };
      }
    | null;
  const checkoutUrl = payload?.data?.checkout?.url;

  if (!response.ok || !checkoutUrl) {
    return c.json(
      {
        error: payload?.error?.detail ?? payload?.error?.message ?? "Unable to create Paddle checkout."
      },
      502
    );
  }

  return c.json(
    {
      checkoutUrl,
      interval,
      environment: c.env.PADDLE_ENVIRONMENT ?? "sandbox"
    },
    200
  );
});

app.post("/v1/webhooks/paddle", async (c) => {
  const signature = c.req.header("Paddle-Signature");

  return c.json({
    message: "Paddle webhook placeholder received.",
    hasSignature: Boolean(signature),
    secretConfigured: Boolean(c.env.PADDLE_WEBHOOK_SECRET)
  });
});

export default {
  fetch: app.fetch,
  scheduled: async (_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(runScheduledRankTracking(env.DB));
  }
};
