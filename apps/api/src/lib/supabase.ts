import { createClient } from "@supabase/supabase-js";
import type { Bindings } from "../types";

export function getSupabaseAdmin(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
