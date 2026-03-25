export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  CORS_ORIGIN?: string;
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
