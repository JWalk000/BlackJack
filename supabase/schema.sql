-- Estate cloud schema — run once in Supabase SQL Editor
-- https://supabase.com/dashboard → SQL → New query
--
-- Teams (shared deals, invites, 5 seats): also run supabase/teams.sql after this file
-- (or re-run teams.sql alone on an existing project).

-- Billing / subscription entitlements (updated by Stripe webhooks via service role)
-- plan: free | pro | team  (team = $35/mo owner plan; Stripe Team price TBD)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status text not null default 'inactive',
  -- Lifetime free deal creates (never decremented on delete). Clients may raise; never lower plan/status.
  free_deals_created integer not null default 0 check (free_deals_created >= 0),
  updated_at timestamptz not null default now()
);

-- Existing projects: add column if table already exists without it
alter table public.profiles
  add column if not exists free_deals_created integer not null default 0;

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Clients may seed a free row (e.g. first checkout without service role).
-- Plan upgrades still go through the service-role webhook path in production.
drop policy if exists "Users insert own free profile" on public.profiles;
create policy "Users insert own free profile"
  on public.profiles for insert
  with check (
    auth.uid() = user_id
    and plan = 'free'
  );

drop policy if exists "Users update own stripe customer id" on public.profiles;
create policy "Users update own stripe customer id"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and plan = (select p.plan from public.profiles p where p.user_id = auth.uid())
    and status = (select p.status from public.profiles p where p.user_id = auth.uid())
  );

-- User deals (cloud sync). team_id optional — see teams.sql for shared-deal RLS.
create table if not exists public.user_deals (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  team_id uuid
);

create index if not exists user_deals_user_id_idx on public.user_deals (user_id);
create index if not exists user_deals_updated_at_idx on public.user_deals (updated_at desc);

alter table public.user_deals enable row level security;

-- Baseline policies (own deals only). teams.sql replaces these with team-aware policies.
drop policy if exists "Users read own deals" on public.user_deals;
create policy "Users read own deals"
  on public.user_deals for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own deals" on public.user_deals;
create policy "Users insert own deals"
  on public.user_deals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own deals" on public.user_deals;
create policy "Users update own deals"
  on public.user_deals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own deals" on public.user_deals;
create policy "Users delete own deals"
  on public.user_deals for delete
  using (auth.uid() = user_id);

-- After running this file on a new project, run teams.sql for full team collaboration.

-- Public bank packages (share-by-link, no login required to view)
create table if not exists public.shared_packages (
  token text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists shared_packages_created_at_idx
  on public.shared_packages (created_at desc);

alter table public.shared_packages enable row level security;

drop policy if exists "Public read shared packages" on public.shared_packages;
create policy "Public read shared packages"
  on public.shared_packages for select
  using (
    expires_at is null
    or expires_at > now()
  );

drop policy if exists "Anyone can create shared packages" on public.shared_packages;
create policy "Anyone can create shared packages"
  on public.shared_packages for insert
  with check (true);
