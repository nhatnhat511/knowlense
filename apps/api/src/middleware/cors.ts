import { cors } from "hono/cors";
export const corsMiddleware = cors({
  origin: (origin, c) => c.env.CORS_ORIGIN || origin || "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  maxAge: 86400
});
