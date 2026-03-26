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
- `PADDLE_PRICE_ID_MONTHLY`
- `PADDLE_PRICE_ID_YEARLY`
- `PADDLE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Extension

Copy `extension/config.example.js` to `extension/config.js` and fill:

- `websiteUrl`
- `dashboardUrl`
- `apiUrl`
- `supabaseUrl`
- `supabaseAnonKey`

## Notes

- The frontend is static-export friendly for Cloudflare Pages.
- The API currently includes health, public config, auth check, and billing/webhook placeholders.
- The extension currently stores session data in `chrome.storage.local` for the first MVP loop.
