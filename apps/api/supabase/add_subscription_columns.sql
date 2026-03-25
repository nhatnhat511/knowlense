create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'subscription_plan'
  ) then
    create type public.subscription_plan as enum ('free', 'monthly', 'yearly');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'subscription_status'
  ) then
    create type public.subscription_status as enum (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'paused'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  subscription_plan public.subscription_plan not null default 'free',
  paddle_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  paddle_subscription_id text,
  status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  whitelist jsonb not null default '[]'::jsonb,
  blacklist jsonb not null default '[]'::jsonb,
  preferred_language text not null default 'en-US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whitelist_is_array check (jsonb_typeof(whitelist) = 'array'),
  constraint blacklist_is_array check (jsonb_typeof(blacklist) = 'array')
);

create index if not exists profiles_subscription_plan_idx
  on public.profiles (subscription_plan);

create index if not exists profiles_paddle_customer_id_idx
  on public.profiles (paddle_customer_id);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_paddle_subscription_id_idx
  on public.subscriptions (paddle_subscription_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, subscription_plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    'free'
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "subscriptions_select_own"
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_settings_select_own"
on public.user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own"
on public.user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own"
on public.user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
