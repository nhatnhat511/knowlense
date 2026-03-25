alter table public.users
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_subscription_id text,
  add column if not exists trial_ends_at timestamptz;

create index if not exists users_paddle_customer_id_idx on public.users (paddle_customer_id);
create index if not exists users_paddle_subscription_id_idx on public.users (paddle_subscription_id);
