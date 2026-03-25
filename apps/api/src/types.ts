export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  PADDLE_API_KEY?: string;
  PADDLE_ENVIRONMENT?: string;
  PADDLE_PRICE_ID_MONTHLY?: string;
  PADDLE_PRICE_ID_YEARLY?: string;
  CORS_ORIGIN?: string;
  CACHE_KV?: KVNamespace;
};

export type AppVariables = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  };
  accessToken: string;
};

export type SubscriptionState = "free" | "premium" | "trial";
