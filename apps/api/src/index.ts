import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";

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

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });

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
