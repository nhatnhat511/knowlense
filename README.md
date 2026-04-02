# Knowlense

Knowlense is a fresh monorepo for:

- `apps/web`: Next.js frontend intended for Cloudflare Pages (`knowlense-web`)
- `apps/api`: Hono API intended for Cloudflare Workers (`knowlense-api`)
- `extension`: Chrome extension MVP with popup, settings panel, and Supabase email/password sign-in

## Setup

### Web

Set these variables in Cloudflare Pages and local `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

### API

Set these variables in Workers:

- `CORS_ORIGIN`
- `VERTEX_SERVICE_ACCOUNT_JSON`
- `VERTEX_AI_LOCATION` (optional, defaults to `us-central1`)
- `VERTEX_AI_MODEL` (optional, defaults to `gemini-2.5-flash`)
- `PADDLE_ENVIRONMENT`
- `PADDLE_API_KEY`
- `PADDLE_CLIENT_SIDE_TOKEN`
- `PADDLE_ENDPOINT_SECRET_KEY`
- `PADDLE_PRICE_ID_MONTHLY`
- `PADDLE_PRICE_ID_YEARLY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These names follow Paddle's official terminology:

- `PADDLE_API_KEY`: server-side API key for Paddle API requests
- `PADDLE_CLIENT_SIDE_TOKEN`: client-side token used to initialize Paddle.js
- `PADDLE_ENDPOINT_SECRET_KEY`: endpoint secret key used to verify Paddle webhooks
- `PADDLE_PRICE_ID_MONTHLY` / `PADDLE_PRICE_ID_YEARLY`: Knowlense price IDs from the Paddle catalog
- `PADDLE_ENVIRONMENT`: `sandbox` for Paddle Sandbox, `production` for live Paddle

For the current Knowlense setup, all Paddle variables must come from the same Paddle account and environment. Do not mix:

- API keys from one account with client-side tokens from another
- Sandbox IDs or tokens with production IDs or tokens

Create and bind a D1 database for app data, then apply the active Knowlense migrations:

- `apps/api/d1/002_extension_auth.sql`
- `apps/api/d1/007_extension_session_management.sql`
- `apps/api/d1/008_extension_device_identity.sql`
- `apps/api/d1/009_auth_rate_limits.sql`

If you are upgrading an older environment that previously used Keyword Finder, Product Keywords, Product SEO Audit, or Rank Tracking tables, also apply:

- `apps/api/d1/010_remove_legacy_feature_tables.sql`

### Extension

Copy `extension/config.example.js` to `extension/config.js` and fill:

- `websiteUrl`
- `dashboardUrl`
- `connectUrl`
- `apiUrl`

## Notes

- The frontend is static-export friendly for Cloudflare Pages.
- The API includes health, public config, auth, billing, Paddle webhook handling, and extension flows.
- The website owns sign up and sign in.
- The extension does not collect credentials. It connects through a website approval flow and stores a Worker-issued session token in `chrome.storage.local`.
- Supabase is used for authentication only.
- Supabase is the source of truth for billing data:
  - `billing_profiles`
  - `paddle_webhook_events`
  - `billing_events`
- The current product workflow is centered on SEO Health, website-managed authentication, extension sessions, and billing.
