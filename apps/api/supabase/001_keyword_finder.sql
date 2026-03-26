create extension if not exists pgcrypto;

create table if not exists public.search_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  query_text text not null,
  page_url text not null,
  result_count integer not null default 0,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.search_results (
  id bigint generated always as identity primary key,
  snapshot_id uuid not null references public.search_snapshots(id) on delete cascade,
  position integer not null,
  title text not null,
  product_url text,
  shop_name text,
  price_text text,
  snippet text,
  created_at timestamptz not null default now()
);

create table if not exists public.keyword_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  snapshot_id uuid,
  query_text text not null,
  summary jsonb not null,
  keywords jsonb not null,
  opportunities jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.search_snapshots enable row level security;
alter table public.search_results enable row level security;
alter table public.keyword_runs enable row level security;

drop policy if exists "users can read own search snapshots" on public.search_snapshots;
create policy "users can read own search snapshots"
on public.search_snapshots for select
using (auth.uid() = user_id);

drop policy if exists "users can read own keyword runs" on public.keyword_runs;
create policy "users can read own keyword runs"
on public.keyword_runs for select
using (auth.uid() = user_id);
