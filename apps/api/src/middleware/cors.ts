import { cors } from "hono/cors";
import type { Bindings } from "../types";

export const corsMiddleware = cors<{
  Bindings: Bindings;
}>({
  origin: (origin, c) => c.env.CORS_ORIGIN || origin || "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  maxAge: 86400
});
