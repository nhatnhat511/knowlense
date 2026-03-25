# Knowlense API

Cloudflare Worker API for Knowlense using Hono + TypeScript + Supabase.

## Features

- Hono on Cloudflare Workers
- CORS enabled for Chrome extension and web app calls
- Supabase Bearer token verification
- User sync endpoint
- Subscription status endpoint
- Wikipedia search endpoint with 24-hour KV cache support
- User settings sync endpoint
- Paddle checkout endpoint
- Paddle webhook endpoint with `Paddle-Signature` verification

## Routes

- `GET /api/health`
- `POST /api/auth/sync`
- `GET /api/subscription/status`
- `GET /api/wiki/search`
- `POST /api/user/settings`
- `POST /api/subscription/checkout`
- `POST /api/webhooks/paddle`

## Required secrets

Set these in your Cloudflare Worker project:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_API_KEY`
- `PADDLE_PRICE_ID_MONTHLY`
- `PADDLE_PRICE_ID_YEARLY`

Optional:

- `SUPABASE_ANON_KEY`
- `CORS_ORIGIN`
- `PADDLE_ENVIRONMENT`
- `CACHE_KV`

## Local development

Create `.dev.vars` from `.dev.vars.example`, then run:

```bash
npm install
npm run dev
```

## Deploy

This worker is prepared for the Cloudflare Worker project named `knowlense-api`:

```bash
npm run deploy
```

## Auth model

User-facing routes require:

```http
Authorization: Bearer <supabase_access_token>
```

The API validates the token with `supabase.auth.getUser(token)` using the service role client, then uses the verified user id for DB queries.

## DB note

The API now expects a unified schema based on `profiles`, `subscriptions`, and `user_settings`. Run:

- [add_subscription_columns.sql](/C:/Users/Administrator/Desktop/Knowlense/apps/api/supabase/add_subscription_columns.sql)

## Example requests

### Sync user from extension

```bash
curl -X POST "http://127.0.0.1:8787/api/auth/sync" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Knowlense User"}'
```

### Get subscription status

```bash
curl "http://127.0.0.1:8787/api/subscription/status" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

### Search Wikipedia

```bash
curl "http://127.0.0.1:8787/api/wiki/search?term=artificial%20intelligence" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

### Update user settings

```bash
curl -X POST "http://127.0.0.1:8787/api/user/settings" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"whitelist":["wikipedia.org"],"blacklist":[],"preferredLanguage":"en-US"}'
```

## Paddle webhook mapping

The webhook handler currently maps Paddle events to `free`, `premium`, or `trial` using:

- `payload.event_type`
- `payload.data.status`
- `payload.data.custom_data.user_id`
- `payload.data.custom_data.email`

For best reliability, pass your Supabase user id into Paddle `custom_data.user_id` when creating checkout/subscription sessions.
