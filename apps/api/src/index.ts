import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";
import { analyzeKeywordSnapshot, type SearchSnapshot } from "./lib/keywordFinder";

type Bindings = {
  CORS_ORIGIN?: string;
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

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function createAdminClient(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
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
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: "Missing bearer token." }, 401);
  }

  const supabase = createAdminClient(c.env);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return c.json({ error: "Invalid session." }, 401);
  }

  c.set("user", {
    email: data.user.email ?? null,
    id: data.user.id
  });

  await next();
});

app.get("/v1/me", (c) =>
  c.json({
    user: c.get("user")
  })
);

app.use("/v1/keyword-finder/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: "Missing bearer token." }, 401);
  }

  const supabase = createAdminClient(c.env);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return c.json({ error: "Invalid session." }, 401);
  }

  c.set("user", {
    email: data.user.email ?? null,
    id: data.user.id
  });

  await next();
});

app.post("/v1/keyword-finder/analyze", async (c) => {
  const body = (await c.req.json().catch(() => null)) as SearchSnapshot | null;

  if (!body?.query || !body?.pageUrl || !Array.isArray(body.results) || body.results.length === 0) {
    return c.json({ error: "Invalid keyword snapshot payload." }, 400);
  }

  const user = c.get("user");
  const analysis = analyzeKeywordSnapshot(body);
  const supabase = createAdminClient(c.env);
  let persisted = false;
  let warning: string | null = null;

  const snapshotInsert = await supabase
    .from("search_snapshots")
    .insert({
      user_id: user.id,
      query_text: body.query,
      page_url: body.pageUrl,
      result_count: body.results.length,
      captured_at: body.capturedAt ?? new Date().toISOString()
    })
    .select("id")
    .maybeSingle();

  if (snapshotInsert.error || !snapshotInsert.data?.id) {
    warning = "Analysis succeeded, but search snapshot could not be stored. Apply the SQL schema first.";
  } else {
    const snapshotId = snapshotInsert.data.id;

    const resultsInsert = await supabase.from("search_results").insert(
      body.results.map((result) => ({
        snapshot_id: snapshotId,
        position: result.position,
        title: result.title,
        product_url: result.productUrl ?? null,
        shop_name: result.shopName ?? null,
        price_text: result.priceText ?? null,
        snippet: result.snippet ?? null
      }))
    );

    const runInsert = await supabase.from("keyword_runs").insert({
      user_id: user.id,
      snapshot_id: snapshotId,
      query_text: body.query,
      summary: analysis.summary,
      keywords: analysis.keywords,
      opportunities: analysis.opportunities
    });

    if (resultsInsert.error || runInsert.error) {
      warning = "Analysis succeeded, but persistence is incomplete. Confirm the SQL schema exists in Supabase.";
    } else {
      persisted = true;
    }
  }

  return c.json({
    persisted,
    warning,
    analysis
  });
});

app.get("/v1/keyword-finder/runs", async (c) => {
  const user = c.get("user");
  const supabase = createAdminClient(c.env);
  const { data, error } = await supabase
    .from("keyword_runs")
    .select("id, query_text, summary, keywords, opportunities, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return c.json({
      runs: [],
      warning: "Keyword Finder history is unavailable until the SQL schema is applied."
    });
  }

  return c.json({
    runs: data ?? []
  });
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
