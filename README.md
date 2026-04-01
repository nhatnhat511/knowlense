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

Create and bind a D1 database for app data, then apply the Keyword Finder migration:

- `apps/api/d1/001_keyword_finder.sql`
- `apps/api/d1/002_extension_auth.sql`

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
- Keyword Finder works without AI: it extracts a live TPT search page, sends the snapshot to the Worker, scores keyword opportunities with rule-based logic, and stores the run in Cloudflare D1.
