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
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  PADDLE_ENVIRONMENT?: "sandbox" | "production";
  PADDLE_API_KEY?: string;
  PADDLE_CLIENT_SIDE_TOKEN?: string;
  PADDLE_CLIENT_TOKEN?: string;
  PADDLE_PRICE_ID_MONTHLY?: string;
  PADDLE_PRICE_ID_YEARLY?: string;
  PADDLE_ENDPOINT_SECRET_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type PaddleBillingInterval = "monthly" | "yearly";

type PaddleWebhookEvent = {
  event_id?: string;
  notification_id?: string;
  id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: Record<string, unknown> | null;
};

type Variables = {
  user: {
    email: string | null;
    id: string;
    name: string | null;
    avatarUrl: string | null;
    emailConfirmed: boolean;
    authType: "supabase" | "extension";
    signInMethod: "email" | "google" | "github" | "unknown";
  };
};

type CachedAuthUser = {
  user: Variables["user"];
  expiresAt: number;
};

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const authUserCache = new Map<string, CachedAuthUser>();

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseJwtExpiry(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function readCachedAuthUser(token: string) {
  const cached = authUserCache.get(token);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    authUserCache.delete(token);
    return null;
  }

  return cached.user;
}

function persistCachedAuthUser(token: string, user: Variables["user"]) {
  const jwtExpiry = parseJwtExpiry(token);
  const expiresAt = Math.min(jwtExpiry ?? (Date.now() + AUTH_CACHE_TTL_MS), Date.now() + AUTH_CACHE_TTL_MS);

  if (expiresAt <= Date.now()) {
    return;
  }

  if (authUserCache.size >= 500) {
    for (const [cachedToken, cachedEntry] of authUserCache.entries()) {
      if (cachedEntry.expiresAt <= Date.now()) {
        authUserCache.delete(cachedToken);
      }
    }

    if (authUserCache.size >= 500) {
      const oldestKey = authUserCache.keys().next().value;
      if (oldestKey) {
        authUserCache.delete(oldestKey);
      }
    }
  }

  authUserCache.set(token, {
    user,
    expiresAt
  });
}

function readPaddleEnvironment(env: Bindings) {
  return env.PADDLE_ENVIRONMENT ?? "sandbox";
}

function readPaddleClientSideToken(env: Bindings) {
  return env.PADDLE_CLIENT_SIDE_TOKEN ?? env.PADDLE_CLIENT_TOKEN ?? null;
}

function readPaddleEndpointSecretKey(env: Bindings) {
  return env.PADDLE_ENDPOINT_SECRET_KEY ?? env.PADDLE_WEBHOOK_SECRET ?? null;
}

function paddleBaseUrl(environment: Bindings["PADDLE_ENVIRONMENT"]) {
  return environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function parsePaddleSignature(header: string | undefined) {
  if (!header) {
    return null;
  }

  const entries = header.split(";").map((segment) => segment.trim()).filter(Boolean);
  const timestamp = entries.find((entry) => entry.startsWith("ts="))?.slice(3) ?? "";
  const signatures = entries.filter((entry) => entry.startsWith("h1=")).map((entry) => entry.slice(3));

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return {
    timestamp,
    signatures
  };
}

function hexEncode(input: ArrayBuffer) {
  return [...new Uint8Array(input)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifyPaddleWebhookSignature(secretKey: string, signatureHeader: string | undefined, rawBody: string) {
  const parsed = parsePaddleSignature(signatureHeader);

  if (!parsed) {
    return false;
  }

  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > 300) {
    return false;
  }

  const signedPayload = `${parsed.timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const digest = hexEncode(signature);

  return parsed.signatures.some((candidate) => candidate.toLowerCase() === digest.toLowerCase());
}

function getPaddleEventId(payload: PaddleWebhookEvent) {
  return payload.event_id ?? payload.notification_id ?? payload.id ?? null;
}

function getPaddleString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPaddleCustomData(data: Record<string, unknown> | null | undefined) {
  const customData = data?.custom_data;
  return customData && typeof customData === "object" && !Array.isArray(customData) ? (customData as Record<string, unknown>) : null;
}

function readPaddlePriceId(data: Record<string, unknown> | null | undefined) {
  const items = Array.isArray(data?.items) ? data.items : [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;
    const directPriceId = getPaddleString(row.price_id);
    if (directPriceId) {
      return directPriceId;
    }

    const price = row.price;
    if (price && typeof price === "object") {
      const nestedPriceId = getPaddleString((price as Record<string, unknown>).id);
      if (nestedPriceId) {
        return nestedPriceId;
      }
    }
  }

  return null;
}

function resolveBillingIntervalFromPaddle(data: Record<string, unknown> | null | undefined, env: Bindings) {
  const customPlan = getPaddleString(getPaddleCustomData(data)?.plan)?.toLowerCase();
  if (customPlan === "monthly" || customPlan === "yearly") {
    return customPlan as PaddleBillingInterval;
  }

  const priceId = readPaddlePriceId(data);
  if (priceId && env.PADDLE_PRICE_ID_YEARLY && priceId === env.PADDLE_PRICE_ID_YEARLY) {
    return "yearly";
  }
  if (priceId && env.PADDLE_PRICE_ID_MONTHLY && priceId === env.PADDLE_PRICE_ID_MONTHLY) {
    return "monthly";
  }

  return null;
}

function getPremiumPlanName(interval: PaddleBillingInterval | null) {
  return interval === "yearly" ? "Premium Yearly" : "Premium Monthly";
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

function deriveExtensionDeviceLabel(userAgent: string | null) {
  const ua = (userAgent ?? "").toLowerCase();
  const browser =
    ua.includes("edg/") ? "Edge" :
    ua.includes("chrome/") && !ua.includes("edg/") ? "Chrome" :
    ua.includes("firefox/") ? "Firefox" :
    ua.includes("safari/") && !ua.includes("chrome/") ? "Safari" :
    "Browser";
  const os =
    ua.includes("windows") ? "Windows" :
    ua.includes("mac os x") ? "macOS" :
    ua.includes("android") ? "Android" :
    ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios") ? "iOS" :
    ua.includes("linux") ? "Linux" :
    "Unknown OS";

  return `${browser} on ${os}`;
}

function mergeExtensionDevices<T extends { id: string; label: string; createdAt: string; lastSeenAt: string; status: "active" | "revoked" | "expired"; userAgent?: string | null }>(devices: T[]) {
  const groups = new Map<string, T[]>();

  for (const device of devices) {
    const key = (device.userAgent ?? "").trim().toLowerCase() || device.label.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), device]);
  }

  const merged = Array.from(groups.values()).map((group) => {
    const sorted = [...group].sort((left, right) => {
      const leftRank = left.status === "active" ? 0 : left.status === "expired" ? 1 : 2;
      const rightRank = right.status === "active" ? 0 : right.status === "expired" ? 1 : 2;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
    });

    const representative = sorted[0];
    const oldestCreatedAt = group.reduce((oldest, device) =>
      new Date(device.createdAt).getTime() < new Date(oldest).getTime() ? device.createdAt : oldest,
      representative.createdAt
    );
    const latestSeenAt = group.reduce((latest, device) =>
      new Date(device.lastSeenAt).getTime() > new Date(latest).getTime() ? device.lastSeenAt : latest,
      representative.lastSeenAt
    );

    return {
      ...representative,
      createdAt: oldestCreatedAt,
      lastSeenAt: latestSeenAt
    };
  });

  const mostRecentActiveDeviceId = merged
    .filter((device) => device.status === "active")
    .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime())[0]?.id ?? null;

  return merged
    .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime())
    .map((device) => ({
      ...device,
      label: device.id === mostRecentActiveDeviceId ? `${device.label} (Most recent)` : device.label
    }));
}

async function ensureExtensionSessionSupport(db: D1Database) {
  await db.prepare("ALTER TABLE extension_sessions ADD COLUMN device_label TEXT").run().catch(() => null);
  await db.prepare("ALTER TABLE extension_sessions ADD COLUMN user_agent TEXT").run().catch(() => null);
  await db.prepare("ALTER TABLE extension_sessions ADD COLUMN last_seen_at TEXT").run().catch(() => null);
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS extension_connection_attempts (
      id TEXT PRIMARY KEY,
      fingerprint_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    )`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_extension_connection_attempts_fingerprint_expires
     ON extension_connection_attempts(fingerprint_hash, expires_at DESC)`
  ).run();
}

function isoFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getCurrentAuthMethod(user: {
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{
    provider?: string | null;
  }> | null;
}): "email" | "google" | "github" | null {
  const appMetadata = user.app_metadata ?? {};
  const appProvider = typeof appMetadata.provider === "string" ? appMetadata.provider.toLowerCase() : null;

  if (appProvider === "google" || appProvider === "github" || appProvider === "email") {
    return appProvider;
  }

  const identityProviders = Array.isArray(user.identities)
    ? user.identities
        .map((identity) => typeof identity?.provider === "string" ? identity.provider.toLowerCase() : null)
        .filter((provider): provider is string => Boolean(provider))
    : [];

  if (identityProviders.includes("google")) {
    return "google";
  }

  if (identityProviders.includes("github")) {
    return "github";
  }

  if (identityProviders.includes("email")) {
    return "email";
  }

  return null;
}

function normalizeSupabaseUser(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{
    provider?: string | null;
    last_sign_in_at?: string | null;
    created_at?: string | null;
  }> | null;
}): Variables["user"] {
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
  const signInMethod = getCurrentAuthMethod(user) ?? "unknown";

  return {
    id: user.id,
    email: user.email ?? null,
    name: displayName,
    avatarUrl,
    emailConfirmed: Boolean(user.email_confirmed_at),
    authType: "supabase" as const,
    signInMethod
  };
}

function normalizeSupabaseClaims(claims: Record<string, unknown>): Variables["user"] | null {
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  if (!userId) {
    return null;
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  const appMetadata =
    claims.app_metadata && typeof claims.app_metadata === "object" && !Array.isArray(claims.app_metadata)
      ? (claims.app_metadata as Record<string, unknown>)
      : null;
  const userMetadata =
    claims.user_metadata && typeof claims.user_metadata === "object" && !Array.isArray(claims.user_metadata)
      ? (claims.user_metadata as Record<string, unknown>)
      : null;

  const displayName =
    typeof userMetadata?.display_name === "string"
      ? userMetadata.display_name
      : typeof userMetadata?.full_name === "string"
        ? userMetadata.full_name
        : email?.split("@")[0] ?? null;
  const avatarUrl = typeof userMetadata?.avatar_url === "string" ? userMetadata.avatar_url : null;
  const provider = typeof appMetadata?.provider === "string" ? appMetadata.provider.toLowerCase() : null;
  const signInMethod =
    provider === "google" || provider === "github" || provider === "email" ? provider : "unknown";

  return {
    id: userId,
    email,
    name: displayName,
    avatarUrl,
    emailConfirmed: Boolean(email),
    authType: "supabase",
    signInMethod
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
      billing_interval TEXT,
      paddle_customer_id TEXT,
      paddle_subscription_id TEXT,
      paddle_transaction_id TEXT,
      paddle_price_id TEXT,
      last_event_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paddle_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );
  `);

  await db.prepare(`ALTER TABLE billing_profiles ADD COLUMN billing_interval TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE billing_profiles ADD COLUMN paddle_customer_id TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE billing_profiles ADD COLUMN paddle_subscription_id TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE billing_profiles ADD COLUMN paddle_transaction_id TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE billing_profiles ADD COLUMN paddle_price_id TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE billing_profiles ADD COLUMN last_event_at TEXT`).run().catch(() => null);
}

async function upsertPremiumBillingProfile(
  db: D1Database,
  userId: string,
  options: {
    interval: PaddleBillingInterval | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    transactionId?: string | null;
    priceId?: string | null;
    occurredAt?: string | null;
  }
) {
  await ensureBillingTables(db);

  await db.prepare(
    `INSERT INTO billing_profiles (
       user_id,
       status,
       plan_name,
       trial_started_at,
       trial_ends_at,
       billing_interval,
       paddle_customer_id,
       paddle_subscription_id,
       paddle_transaction_id,
       paddle_price_id,
       last_event_at,
       updated_at
     )
     VALUES (?1, 'active', ?2, NULL, NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(user_id) DO UPDATE SET
       status = 'active',
       plan_name = excluded.plan_name,
       trial_started_at = NULL,
       trial_ends_at = NULL,
       billing_interval = excluded.billing_interval,
       paddle_customer_id = COALESCE(excluded.paddle_customer_id, billing_profiles.paddle_customer_id),
       paddle_subscription_id = COALESCE(excluded.paddle_subscription_id, billing_profiles.paddle_subscription_id),
       paddle_transaction_id = COALESCE(excluded.paddle_transaction_id, billing_profiles.paddle_transaction_id),
       paddle_price_id = COALESCE(excluded.paddle_price_id, billing_profiles.paddle_price_id),
       last_event_at = COALESCE(excluded.last_event_at, billing_profiles.last_event_at),
       updated_at = excluded.updated_at`
  )
    .bind(
      userId,
      getPremiumPlanName(options.interval),
      options.interval,
      options.customerId ?? null,
      options.subscriptionId ?? null,
      options.transactionId ?? null,
      options.priceId ?? null,
      options.occurredAt ?? null,
      new Date().toISOString()
    )
    .run();
}

async function markBillingProfileFree(
  db: D1Database,
  userId: string,
  options: {
    customerId?: string | null;
    subscriptionId?: string | null;
    occurredAt?: string | null;
  }
) {
  await ensureBillingTables(db);

  await db.prepare(
    `INSERT INTO billing_profiles (
       user_id,
       status,
       plan_name,
       trial_started_at,
       trial_ends_at,
       billing_interval,
       paddle_customer_id,
       paddle_subscription_id,
       paddle_transaction_id,
       paddle_price_id,
       last_event_at,
       updated_at
     )
     VALUES (?1, 'free', 'Free', NULL, NULL, NULL, ?2, ?3, NULL, NULL, ?4, ?5)
     ON CONFLICT(user_id) DO UPDATE SET
       status = 'free',
       plan_name = 'Free',
       trial_started_at = NULL,
       trial_ends_at = NULL,
       billing_interval = NULL,
       paddle_customer_id = COALESCE(excluded.paddle_customer_id, billing_profiles.paddle_customer_id),
       paddle_subscription_id = COALESCE(excluded.paddle_subscription_id, billing_profiles.paddle_subscription_id),
       paddle_transaction_id = NULL,
       paddle_price_id = NULL,
       last_event_at = COALESCE(excluded.last_event_at, billing_profiles.last_event_at),
       updated_at = excluded.updated_at`
  )
    .bind(userId, options.customerId ?? null, options.subscriptionId ?? null, options.occurredAt ?? null, new Date().toISOString())
    .run();
}

async function resolveBillingUserId(
  db: D1Database,
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
    const row = await db.prepare(
      `SELECT user_id
       FROM billing_profiles
       WHERE paddle_subscription_id = ?1
       LIMIT 1`
    )
      .bind(options.subscriptionId)
      .first<{ user_id: string }>();

    if (row?.user_id) {
      return row.user_id;
    }
  }

  if (options.customerId) {
    const row = await db.prepare(
      `SELECT user_id
       FROM billing_profiles
       WHERE paddle_customer_id = ?1
       LIMIT 1`
    )
      .bind(options.customerId)
      .first<{ user_id: string }>();

    if (row?.user_id) {
      return row.user_id;
    }
  }

  return null;
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

async function ensureSeoHealthUsageTable(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS seo_health_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_seo_health_usage_user_created
      ON seo_health_usage (user_id, created_at DESC);
  `);
}

async function countSeoHealthUsageLast24Hours(db: D1Database, userId: string) {
  await ensureSeoHealthUsageTable(db);
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM seo_health_usage
     WHERE user_id = ?1
       AND datetime(created_at) >= datetime(?2)`
  ).bind(userId, sinceIso).first<{ total: number | string }>();

  return Number(row?.total ?? 0);
}

async function recordSeoHealthUsage(db: D1Database, userId: string) {
  await ensureSeoHealthUsageTable(db);
  await db.prepare(
    `INSERT INTO seo_health_usage (id, user_id, created_at)
     VALUES (?1, ?2, ?3)`
  ).bind(crypto.randomUUID(), userId, new Date().toISOString()).run();
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
  const cached = readCachedAuthUser(token);
  if (cached) {
    return cached;
  }

  try {
    const authClient = createAuthClient(env);
    const claimsResult = await authClient.auth.getClaims(token);
    if (claimsResult.error) {
      authUserCache.delete(token);
    } else if (claimsResult.data?.claims && typeof claimsResult.data.claims === "object") {
      const userFromClaims = normalizeSupabaseClaims(claimsResult.data.claims as Record<string, unknown>);
      if (userFromClaims) {
        persistCachedAuthUser(token, userFromClaims);
        return userFromClaims;
      }
    }
  } catch {
    // Fall back to getUser() below if local/JWKS-based verification is unavailable.
  }

  const supabase = createAdminClient(env);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    authUserCache.delete(token);
    return null;
  }

  const user = normalizeSupabaseUser(data.user);
  persistCachedAuthUser(token, user);
  return user;
}

async function authenticateExtensionToken(env: Bindings, token: string) {
  const tokenHash = await hashToken(token);
  const session = await env.DB.prepare(
    `SELECT id, user_id, user_email
     FROM extension_sessions
     WHERE token_hash = ?1
       AND revoked_at IS NULL
       AND datetime(expires_at) > datetime('now')
     LIMIT 1`
  )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; user_email: string | null }>();

  if (!session) {
    return null;
  }

  await env.DB.prepare(
    `UPDATE extension_sessions
     SET last_seen_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  )
    .bind(session.id)
    .run()
    .catch(() => null);

  return {
    id: session.user_id,
    email: session.user_email,
    name: session.user_email?.split("@")[0] ?? null,
    avatarUrl: null,
    emailConfirmed: true,
    authType: "extension" as const,
    signInMethod: "unknown" as const
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
    paddleEnvironment: readPaddleEnvironment(c.env),
    paddleClientSideTokenConfigured: Boolean(readPaddleClientSideToken(c.env))
  })
);

app.post("/v1/contact", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!name) {
      return c.json({ error: "Please enter your name." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: "Please enter a valid email address." }, 400);
    }

    if (message.length < 20) {
      return c.json({ error: "Please share at least 20 characters so we have enough context." }, 400);
    }

    if (!c.env.RESEND_API_KEY || !c.env.RESEND_FROM_EMAIL) {
      return c.json({ error: "Contact email is not configured yet." }, 503);
    }

    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");
    const submittedAt = new Date().toISOString();
    const textMessage = [
      "Knowlense Contact Request",
      "",
      `Source: Knowlense website`,
      `Submitted: ${submittedAt}`,
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      "Message:",
      message
    ].join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: c.env.RESEND_FROM_EMAIL,
        to: ["support@knowlense.com"],
        reply_to: email,
        subject: `Knowlense contact request from ${name}`,
        text: textMessage,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a;">
            <div style="padding: 18px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
              <h2 style="margin: 0 0 16px; font-size: 18px; line-height: 1.4;">Knowlense Contact Request</h2>
              <p style="margin: 0 0 8px;"><strong>Source:</strong> Knowlense website</p>
              <p style="margin: 0 0 8px;"><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
              <p style="margin: 0 0 8px;"><strong>Name:</strong> ${escapedName}</p>
              <p style="margin: 0 0 18px;"><strong>Email:</strong> ${escapedEmail}</p>
            </div>
            <div style="margin-top: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 16px; background: #f8fafc;">
              <p style="margin: 0 0 8px;"><strong>Message</strong></p>
              ${escapedMessage}
            </div>
          </div>
        `
      })
    });

    if (!resendResponse.ok) {
      const resendPayload = (await resendResponse.json().catch(() => null)) as { message?: string } | null;
      const fallbackText = resendPayload ? null : await resendResponse.text().catch(() => "");
      return c.json({ error: resendPayload?.message ?? fallbackText ?? "Unable to send your message right now." }, 502);
    }

    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send your message right now.";
    return c.json({ error: message }, 500);
  }
});

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

  try {
    const billing = await readBillingProfile(c.env.DB, user.id);

    return c.json({
      user,
      billing
    });
  } catch {
    return c.json({
      user,
      billing: {
        status: "free" as const,
        planName: "Free",
        trialEligible: true,
        trialActive: false,
        trialDaysRemaining: 0
      },
      warning: "Billing status is temporarily unavailable."
    });
  }
});

app.post("/v1/auth/sign-out", async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ ok: true });
  }

  const user = await (token.startsWith("knlx_")
    ? authenticateExtensionToken(c.env, token)
    : authenticateSupabaseToken(c.env, token));

  if (!user || user.authType !== "supabase") {
    return c.json({ ok: true });
  }

  await c.env.DB.prepare(
    `UPDATE extension_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE user_id = ?1
       AND revoked_at IS NULL`
  )
    .bind(user.id)
    .run()
    .catch(() => null);

  return c.json({ ok: true });
});

app.post("/v1/extension/session/start", async (c) => {
  await ensureExtensionSessionSupport(c.env.DB);

  const userAgent = c.req.header("User-Agent") ?? "";
  const connectingIp =
    c.req.header("CF-Connecting-IP")
    ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
    ?? "unknown";
  const fingerprintHash = await hashToken(`${connectingIp}|${userAgent}`);
  const recentAttemptCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as total
     FROM extension_connection_attempts
     WHERE fingerprint_hash = ?1
       AND datetime(expires_at) > datetime('now')`
  )
    .bind(fingerprintHash)
    .first<{ total: number | string }>();

  if (Number(recentAttemptCount?.total ?? 0) >= 5) {
    return c.json({ error: "Too many extension connection attempts were started from this browser. Wait a few minutes and try again." }, 429);
  }

  const requestId = crypto.randomUUID();
  const expiresAt = isoFromNow(10);
  const attemptId = crypto.randomUUID();

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO extension_connection_requests (id, status, expires_at)
         VALUES (?1, 'pending', ?2)`
      ).bind(requestId, expiresAt),
      c.env.DB.prepare(
        `INSERT INTO extension_connection_attempts (id, fingerprint_hash, expires_at)
         VALUES (?1, ?2, ?3)`
      ).bind(attemptId, fingerprintHash, expiresAt)
    ]);
  } catch {
    return c.json({ error: "Unable to start extension connection flow." }, 500);
  }

  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  c.header("Pragma", "no-cache");
  return c.json({
    requestId,
    expiresAt
  });
});

app.get("/v1/extension/session/poll", async (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  c.header("Pragma", "no-cache");
  const requestId = c.req.query("requestId");

  if (!requestId) {
    return c.json({ error: "Missing requestId." }, 400);
  }

  const request = await c.env.DB.prepare(
    `SELECT id, status, user_id, user_email, session_id, expires_at, claimed_at, token_plaintext
     FROM extension_connection_requests
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(requestId)
    .first<{
      id: string;
      status: string;
      user_id: string | null;
      user_email: string | null;
      session_id: string | null;
      expires_at: string;
      claimed_at: string | null;
      token_plaintext: string | null;
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

  if (!request.token_plaintext || !request.user_id) {
    return c.json({ status: "authorized" });
  }

  const session = await c.env.DB.prepare(
    `SELECT user_id, user_email, expires_at
     FROM extension_sessions
     WHERE id = ?1
       AND revoked_at IS NULL
     LIMIT 1`
  )
    .bind(request.session_id)
    .first<{ user_id: string; user_email: string | null; expires_at: string }>()
    .catch(() => null);

  await c.env.DB.prepare(
    `UPDATE extension_connection_requests
     SET claimed_at = COALESCE(claimed_at, CURRENT_TIMESTAMP)
     WHERE id = ?1`
  )
    .bind(requestId)
    .run();

  const billing = await readBillingProfile(c.env.DB, request.user_id).catch(() => null);

  return c.json({
    status: "connected",
    sessionToken: request.token_plaintext,
    user: {
      id: request.user_id,
      email: request.user_email ?? session?.user_email ?? null
    },
    billing,
    expiresAt: session?.expires_at ?? isoFromNow(60 * 24 * 365)
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
  await ensureExtensionSessionSupport(c.env.DB);

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
  const sessionToken = createExtensionToken();
  const tokenHash = await hashToken(sessionToken);
  const sessionExpiresAt = isoFromNow(60 * 24 * 365);
  const userAgent = c.req.header("User-Agent") ?? null;
  const deviceLabel = deriveExtensionDeviceLabel(userAgent);
  const existingSession = await c.env.DB.prepare(
    `SELECT id
     FROM extension_sessions
     WHERE user_id = ?1
       AND COALESCE(user_agent, '') = ?2
     ORDER BY datetime(COALESCE(last_seen_at, created_at)) DESC
     LIMIT 1`
  )
    .bind(user.id, userAgent ?? "")
    .first<{ id: string }>();
  const sessionId = existingSession?.id ?? crypto.randomUUID();

  try {
    const statements = [
      existingSession
        ? c.env.DB.prepare(
            `UPDATE extension_sessions
             SET user_email = ?2,
                 token_hash = ?3,
                 expires_at = ?4,
                 revoked_at = NULL,
                 device_label = ?5,
                 user_agent = ?6,
                 last_seen_at = CURRENT_TIMESTAMP
             WHERE id = ?1`
          ).bind(sessionId, user.email, tokenHash, sessionExpiresAt, deviceLabel, userAgent)
        : c.env.DB.prepare(
            `INSERT INTO extension_sessions (id, user_id, user_email, token_hash, expires_at, device_label, user_agent, last_seen_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)`
          ).bind(sessionId, user.id, user.email, tokenHash, sessionExpiresAt, deviceLabel, userAgent),
      c.env.DB.prepare(
        `UPDATE extension_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ?1
           AND COALESCE(user_agent, '') = ?2
           AND id <> ?3
           AND revoked_at IS NULL`
      ).bind(user.id, userAgent ?? "", sessionId),
      c.env.DB.prepare(
        `UPDATE extension_connection_requests
         SET status = 'authorized',
             user_id = ?2,
             user_email = ?3,
             session_id = ?4,
             token_plaintext = ?5
         WHERE id = ?1`
      ).bind(requestId, user.id, user.email, sessionId, sessionToken)
    ];

    await c.env.DB.batch(statements);
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

app.post("/v1/extension/session/revoke", async (c) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  const user = c.get("user");
  if (user.authType !== "extension") {
    return c.json({ error: "Extension revoke requires an active extension session." }, 403);
  }

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token?.startsWith("knlx_")) {
    return c.json({ error: "Missing extension session token." }, 401);
  }

  const tokenHash = await hashToken(token);
  const result = await c.env.DB.prepare(
    `UPDATE extension_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE token_hash = ?1
       AND revoked_at IS NULL`
  )
    .bind(tokenHash)
    .run();

  return c.json({
    revoked: Number(result.meta.changes ?? 0) > 0
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
  const billing = await readBillingProfile(c.env.DB, user.id);
  const isPremium = billing.status === "active" || billing.status === "trial";

  if (!isPremium) {
    const usageCount = await countSeoHealthUsageLast24Hours(c.env.DB, user.id);
    if (usageCount >= 10) {
      return c.json(
        {
          error: "Free plan limit reached. SEO Health is available for up to 10 runs in a rolling 24-hour period. Upgrade to Premium for unlimited access."
        },
        403
      );
    }
  }

  const analysis = await analyzeProductSeoHealth(body, {
    db: c.env.DB,
    userId: user.id
  });

  if (!isPremium) {
    await recordSeoHealthUsage(c.env.DB, user.id);
  }

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
  const billing = await readBillingProfile(c.env.DB, user.id);
  const isPremium = billing.status === "active" || billing.status === "trial";

  if (!isPremium) {
    return c.json(
      {
        error: "Keyword tracking is available on Premium. Upgrade to Premium to track rankings over time."
      },
      403
    );
  }

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
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  c.header("Pragma", "no-cache");
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

app.get("/v1/dashboard/extension-devices", async (c) => {
  const user = c.get("user");
  if (user.authType !== "supabase") {
    return c.json({ error: "Extension device management requires a website session." }, 403);
  }

  await ensureExtensionSessionSupport(c.env.DB);

  try {
    const rows = await c.env.DB.prepare(
      `SELECT id, created_at, expires_at, revoked_at, device_label, user_agent, COALESCE(last_seen_at, created_at) as last_seen_at
       FROM extension_sessions
       WHERE user_id = ?1
       ORDER BY datetime(created_at) DESC`
    )
      .bind(user.id)
      .all<{
        id: string;
        created_at: string;
        expires_at: string;
        revoked_at: string | null;
        device_label: string | null;
        user_agent: string | null;
        last_seen_at: string | null;
      }>();

    const devices = (rows.results ?? []).map((row) => {
      const revoked = Boolean(row.revoked_at);
      const expired = !revoked && new Date(row.expires_at).getTime() <= Date.now();
      const status: "active" | "revoked" | "expired" = revoked ? "revoked" : expired ? "expired" : "active";
      return {
        id: row.id,
        label: row.device_label ?? deriveExtensionDeviceLabel(row.user_agent),
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at ?? row.created_at,
        expiresAt: row.expires_at,
        status,
        userAgent: row.user_agent
      };
    });

    return c.json({ devices: mergeExtensionDevices(devices) });
  } catch {
    return c.json({ error: "Unable to load extension devices." }, 500);
  }
});

app.post("/v1/dashboard/extension-devices/:sessionId/revoke", async (c) => {
  const user = c.get("user");
  if (user.authType !== "supabase") {
    return c.json({ error: "Extension device management requires a website session." }, 403);
  }

  const sessionId = c.req.param("sessionId");
  if (!sessionId) {
    return c.json({ error: "Missing sessionId." }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      `UPDATE extension_sessions
       SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
       WHERE id = ?1
         AND user_id = ?2
         AND revoked_at IS NULL`
    )
      .bind(sessionId, user.id)
      .run();

    return c.json({
      revoked: Number(result.meta.changes ?? 0) > 0
    });
  } catch {
    return c.json({ error: "Unable to revoke the selected extension device." }, 500);
  }
});

app.post("/v1/dashboard/extension-devices/revoke-others", async (c) => {
  const user = c.get("user");
  if (user.authType !== "supabase") {
    return c.json({ error: "Extension device management requires a website session." }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const keepSessionId = typeof body?.keepSessionId === "string" ? body.keepSessionId : "";
  if (!keepSessionId) {
    return c.json({ error: "Missing keepSessionId." }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      `UPDATE extension_sessions
       SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
       WHERE user_id = ?1
         AND id != ?2
         AND revoked_at IS NULL
         AND datetime(expires_at) > datetime('now')`
    )
      .bind(user.id, keepSessionId)
      .run();

    return c.json({
      revokedCount: Number(result.meta.changes ?? 0)
    });
  } catch {
    return c.json({ error: "Unable to revoke the other extension browsers." }, 500);
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
  try {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    c.header("Pragma", "no-cache");
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
    const checkoutOrigin =
      c.env.CORS_ORIGIN && c.env.CORS_ORIGIN !== "*"
        ? c.env.CORS_ORIGIN.replace(/\/$/, "")
        : "https://knowlense.com";
    const checkoutOverrideUrl = `${checkoutOrigin}/pay`;

    if (!priceId || !apiKey) {
      return c.json({ error: "Paddle checkout is not configured." }, 500);
    }

    const baseUrl = paddleBaseUrl(readPaddleEnvironment(c.env));

    const response = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...jsonHeaders()
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        collection_mode: "automatic",
        enable_checkout: true,
        checkout: {
          url: checkoutOverrideUrl
        },
        currency_code: "USD",
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
          errors?: Array<{
            code?: string;
            detail?: string;
            message?: string;
          }>;
          error?: {
            detail?: string;
            message?: string;
          };
        }
      | null;
      const checkoutUrl = payload?.data?.checkout?.url;
      const paddleError =
        payload?.errors?.[0]?.detail
        ?? payload?.errors?.[0]?.message
        ?? payload?.error?.detail
        ?? payload?.error?.message
        ?? null;

      if (!response.ok || !checkoutUrl) {
        const retryAfter = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
        const normalizedError =
          response.status === 429
            ? Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? `Paddle checkout is temporarily busy. Please wait ${retryAfterSeconds} seconds and try again.`
              : "Paddle checkout is temporarily busy. Please wait a moment and try again."
          : paddleError === "Cannot create a transaction or open a checkout as no default payment link has been set for this account. Set in the Paddle dashboard, then try again."
            ? "Paddle sandbox checkout is not ready yet. Set a default payment link in your Paddle dashboard and try again."
            : paddleError ?? "Unable to create Paddle checkout.";

        return c.json(
          {
            error: normalizedError
          },
        502
      );
    }

    return c.json(
      {
        checkoutUrl,
        interval,
        environment: readPaddleEnvironment(c.env)
      },
      200
    );
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unable to create Paddle checkout."
      },
      500
    );
  }
});

app.post("/v1/billing/confirm", async (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  c.header("Pragma", "no-cache");

  try {
    const authResult = await authenticateRequest(c);
    if (authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const body = await c.req.json().catch(() => null);
    const transactionId = getPaddleString(body?.transactionId);
    const user = c.get("user");

    if (!transactionId) {
      return c.json({ error: "Missing Paddle transaction reference." }, 400);
    }

    if (!c.env.PADDLE_API_KEY) {
      return c.json({ error: "Paddle checkout is not configured." }, 500);
    }

    const response = await fetch(`${paddleBaseUrl(readPaddleEnvironment(c.env))}/transactions/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${c.env.PADDLE_API_KEY}`,
        Accept: "application/json"
      }
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: Record<string, unknown>;
          error?: { detail?: string; message?: string };
          errors?: Array<{ detail?: string; message?: string }>;
        }
      | null;

    if (!response.ok || !payload?.data) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
      return c.json(
        {
          error:
            response.status === 429
              ? Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? `Paddle confirmation is temporarily busy. Please wait ${retryAfterSeconds} seconds and try again.`
                : "Paddle confirmation is temporarily busy. Please wait a moment and try again."
              : payload?.errors?.[0]?.detail
                ?? payload?.errors?.[0]?.message
                ?? payload?.error?.detail
                ?? payload?.error?.message
                ?? "Unable to confirm the Paddle transaction."
        },
        502
      );
    }

    const transaction = payload.data;
    const customData = getPaddleCustomData(transaction);
    const ownerUserId = getPaddleString(customData?.user_id);
    const transactionStatus = getPaddleString(transaction.status)?.toLowerCase();
    const interval = resolveBillingIntervalFromPaddle(transaction, c.env);
    const subscriptionId = getPaddleString(transaction.subscription_id);
    const customerId = getPaddleString(transaction.customer_id);
    const priceId = readPaddlePriceId(transaction);

    if (ownerUserId && ownerUserId !== user.id) {
      return c.json({ error: "This Paddle transaction belongs to a different account." }, 403);
    }

    if (transactionStatus !== "completed" && transactionStatus !== "paid") {
      return c.json({
        confirmed: false,
        ready: false,
        status: transactionStatus ?? "unknown"
      });
    }

    await upsertPremiumBillingProfile(c.env.DB, user.id, {
      interval,
      customerId,
      subscriptionId,
      transactionId,
      priceId,
      occurredAt: new Date().toISOString()
    });

    const billing = await readBillingProfile(c.env.DB, user.id);

    return c.json({
      confirmed: true,
      ready: true,
      billing
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unable to confirm the Paddle transaction."
      },
      500
    );
  }
});

app.post("/v1/webhooks/paddle", async (c) => {
  const secretKey = readPaddleEndpointSecretKey(c.env);
  const signature = c.req.header("Paddle-Signature");
  const rawBody = await c.req.text();

  if (!secretKey) {
    return c.json({ error: "Paddle webhook signing secret is not configured." }, 500);
  }

  const signatureValid = await verifyPaddleWebhookSignature(secretKey, signature, rawBody);
  if (!signatureValid) {
    return c.json({ error: "Invalid Paddle webhook signature." }, 401);
  }

  const payload = JSON.parse(rawBody) as PaddleWebhookEvent;
  const eventType = payload.event_type ?? "unknown";
  const eventId = getPaddleEventId(payload);

  await ensureBillingTables(c.env.DB);

  if (eventId) {
    const existing = await c.env.DB.prepare(
      `SELECT event_id
       FROM paddle_webhook_events
       WHERE event_id = ?1
       LIMIT 1`
    )
      .bind(eventId)
      .first<{ event_id: string }>();

    if (existing) {
      return c.json({ ok: true, duplicate: true });
    }
  }

  const data = payload.data ?? null;
  const customData = getPaddleCustomData(data);
  const interval = resolveBillingIntervalFromPaddle(data, c.env);
  const priceId = readPaddlePriceId(data);
  const customerId = getPaddleString(data?.customer_id);
  const resourceId = getPaddleString(data?.id);
  const subscriptionId = eventType.startsWith("subscription.") ? resourceId : getPaddleString(data?.subscription_id);
  const transactionId = eventType.startsWith("transaction.") ? resourceId : null;
  const occurredAt = getPaddleString(payload.occurred_at) ?? new Date().toISOString();
  const subscriptionStatus = getPaddleString(data?.status)?.toLowerCase();
  const userId = await resolveBillingUserId(c.env.DB, {
    userId: getPaddleString(customData?.user_id),
    subscriptionId,
    customerId
  });

  if (eventType === "transaction.completed" && userId) {
    await upsertPremiumBillingProfile(c.env.DB, userId, {
      interval,
      customerId,
      subscriptionId: getPaddleString(data?.subscription_id),
      transactionId,
      priceId,
      occurredAt
    });
  }

  if ((eventType === "subscription.created" || eventType === "subscription.updated") && userId) {
    if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
      await upsertPremiumBillingProfile(c.env.DB, userId, {
        interval,
        customerId,
        subscriptionId,
        transactionId: null,
        priceId,
        occurredAt
      });
    } else if (subscriptionStatus === "canceled" || subscriptionStatus === "paused" || subscriptionStatus === "past_due") {
      await markBillingProfileFree(c.env.DB, userId, {
        customerId,
        subscriptionId,
        occurredAt
      });
    }
  }

  if (eventType === "subscription.canceled" && userId) {
    await markBillingProfileFree(c.env.DB, userId, {
      customerId,
      subscriptionId,
      occurredAt
    });
  }

  if (eventId) {
    await c.env.DB.prepare(
      `INSERT INTO paddle_webhook_events (event_id, event_type, processed_at)
       VALUES (?1, ?2, ?3)`
    )
      .bind(eventId, eventType, new Date().toISOString())
      .run();
  }

  return c.json({ ok: true });
});

export default {
  fetch: app.fetch,
  scheduled: async (_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(runScheduledRankTracking(env.DB));
  }
};
