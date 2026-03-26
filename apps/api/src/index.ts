import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";
import { analyzeKeywordSnapshot, type SearchSnapshot } from "./lib/keywordFinder";

type Bindings = {
  CORS_ORIGIN?: string;
  DB: D1Database;
  PADDLE_ENVIRONMENT?: "sandbox" | "production";
  PADDLE_API_KEY?: string;
  PADDLE_PRICE_ID_MONTHLY?: string;
  PADDLE_PRICE_ID_YEARLY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type Variables = {
  user: {
    email: string | null;
    id: string;
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

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function createAdminClient(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
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

  const supabase = createAdminClient(c.env);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: "Invalid session.", status: 401 as const };
  }

  c.set("user", {
    email: data.user.email ?? null,
    id: data.user.id
  });

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

app.get("/", (c) =>
  c.json({
    name: "knowlense-api",
    status: "ok"
  })
);

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

app.use("/v1/me", async (c, next) => {
  const authResult = await authenticateRequest(c);
  if (authResult) {
    return c.json({ error: authResult.error }, authResult.status);
  }

  await next();
});

app.get("/v1/me", (c) =>
  c.json({
    user: c.get("user")
  })
);

app.use("/v1/keyword-finder/*", async (c, next) => {
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

app.post("/v1/billing/checkout", async (c) => {
  const body = await c.req.json().catch(() => null);

  return c.json(
    {
      message: "Checkout endpoint scaffolded. Wire this to Paddle transaction creation next.",
      received: body ?? {},
      environment: c.env.PADDLE_ENVIRONMENT ?? "sandbox",
      pricesConfigured: Boolean(c.env.PADDLE_PRICE_ID_MONTHLY && c.env.PADDLE_PRICE_ID_YEARLY)
    },
    501
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

export default app;
