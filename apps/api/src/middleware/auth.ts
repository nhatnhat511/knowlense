import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getSupabaseAdmin } from "../lib/supabase";
import type { AppVariables, Bindings } from "../types";

export const requireAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const authorization = c.req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Missing Authorization: Bearer <token> header."
    });
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  const supabase = getSupabaseAdmin(c.env);
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new HTTPException(401, {
      message: "Invalid or expired Supabase token."
    });
  }

  c.set("accessToken", accessToken);
  c.set("user", {
    id: user.id,
    email: user.email ?? null,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null
  });

  await next();
});
