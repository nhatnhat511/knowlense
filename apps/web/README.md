# Knowlense Web

Next.js App Router project for the Knowlense website.

## Included

- Landing page at `/`
- Pricing page at `/pricing`
- Auth page at `/auth`
- Dashboard page at `/dashboard`
- Tailwind CSS
- shadcn/ui-style local components
- Supabase client-side auth provider
- Cloudflare Pages build script with `@cloudflare/next-on-pages`

## Local setup

1. Copy `.env.example` to `.env.local`
2. Add your Supabase project values
3. Run `npm install`
4. Run `npm run dev`

## Cloudflare Pages

Pages settings:

- Framework preset: `None`
- Build command: `npm run pages:build`
- Build output directory: `.vercel/output/static`
- Node.js version: `22`

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
