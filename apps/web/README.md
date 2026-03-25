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
- Cloudflare Pages-ready static export

## Local setup

1. Copy `.env.example` to `.env.local`
2. Add your Supabase project values
3. Run `npm install`
4. Run `npm run dev`

## Cloudflare Pages

Pages settings:

- Framework preset: `None`
- Build command: `npm run pages:build`
- Build output directory: `out`
- Node.js version: `22`
