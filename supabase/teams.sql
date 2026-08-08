-- =============================================================================
-- Estate teams — run in Supabase SQL Editor (after schema.sql)
--
-- Dashboard steps (fixes: Could not find the function public.create_team(p_name)):
--   1. https://supabase.com/dashboard → project → SQL → New query
--   2. Paste THIS entire file (repo: supabase/teams.sql)
--   3. Run → wait a few seconds → retry Create team in the app
--
-- Or: npm run db:apply-teams  (requires `npx supabase login`, not a public URL)
--
-- Adds: teams, team_members (email and/or phone invites), user_deals.team_id,
--       profiles.plan 'team', claim-on-login by email OR phone, team-deal RLS.
-- Safe to re-run (IF NOT EXISTS / drop policy if exists).
--
-- App RPCs (arg names must match PostgREST):
--   create_team(p_name text)
--   invite_team_member(p_team_id uuid, p_email text, p_phone text)
--   claim_team_invites()
--   remove_team_member(p_member_id uuid)
--
-- Phone auth (Supabase console, separate from this SQL):
--   Authentication → Providers → Phone → enable
--   Configure SMS (Twilio / MessageBird / etc.) under Phone provider settings
-- =============================================================================

-- 1) Profiles: allow 'team' plan (Stripe product later — STRIPE_PRICE_ID_TEAM_MONTHLY)
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'team'));

-- 2) Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists teams_owner_user_id_idx on public.teams (owner_user_id);

alter table public.teams enable row level security;

-- 3) Members — invite by email and/or phone (E.164); user_id filled on claim
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  phone text,
  role text not null check (role in ('owner', 'member')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  constraint team_members_contact_chk check (
    (email is not null and length(trim(email)) > 0)
    or (phone is not null and length(trim(phone)) > 0)
  )
);

-- Migrate older email-only installs
alter table public.team_members add column if not exists phone text;
alter table public.team_members alter column email drop not null;

do $$
begin
  -- Drop legacy unique(team_id, email) if present
  if exists (
    select 1 from pg_constraint
    where conname = 'team_members_team_id_email_key'
  ) then
    alter table public.team_members drop constraint team_members_team_id_email_key;
  end if;
exception when others then
  null;
end $$;

-- At least one contact method
alter table public.team_members drop constraint if exists team_members_contact_chk;
alter table public.team_members
  add constraint team_members_contact_chk check (
    (email is not null and length(trim(email)) > 0)
    or (phone is not null and length(trim(phone)) > 0)
  );

create unique index if not exists team_members_team_email_uidx
  on public.team_members (team_id, email)
  where email is not null;

create unique index if not exists team_members_team_phone_uidx
  on public.team_members (team_id, phone)
  where phone is not null;

create index if not exists team_members_team_id_idx on public.team_members (team_id);
create index if not exists team_members_user_id_idx on public.team_members (user_id)
  where user_id is not null;
create index if not exists team_members_email_idx on public.team_members (email)
  where email is not null;
create index if not exists team_members_phone_idx on public.team_members (phone)
  where phone is not null;

alter table public.team_members enable row level security;

-- 4) Deals: optional team share
alter table public.user_deals
  add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists user_deals_team_id_idx
  on public.user_deals (team_id)
  where team_id is not null;

-- -----------------------------------------------------------------------------
-- Helpers (security definer — RLS uses these; avoid recursion)
-- -----------------------------------------------------------------------------
create or replace function public.normalize_email(p text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(p)), '');
$$;

-- Digits only; 10-digit US → +1…; 11-digit starting with 1 → +…; already +… kept
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
  d text;
begin
  if p is null then
    return null;
  end if;
  v := trim(p);
  if v = '' then
    return null;
  end if;
  d := regexp_replace(v, '[^0-9]', '', 'g');
  if length(d) = 10 then
    return '+1' || d;
  end if;
  if length(d) = 11 and left(d, 1) = '1' then
    return '+' || d;
  end if;
  if left(v, 1) = '+' and length(d) >= 10 then
    return '+' || d;
  end if;
  if length(d) >= 10 then
    return '+' || d;
  end if;
  return null;
end;
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = p_team_id
      and t.owner_user_id = auth.uid()
  );
$$;

grant execute on function public.normalize_email(text) to authenticated, anon;
grant execute on function public.normalize_phone(text) to authenticated, anon;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_owner(uuid) to authenticated;

-- Attach pending invites when email OR phone matches signed-in user
create or replace function public.claim_team_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_phone text;
  v_count integer;
begin
  if v_uid is null then
    return 0;
  end if;

  select
    public.normalize_email(u.email),
    public.normalize_phone(u.phone)
  into v_email, v_phone
  from auth.users u
  where u.id = v_uid;

  if (v_email is null or v_email = '') and (v_phone is null or v_phone = '') then
    return 0;
  end if;

  update public.team_members
  set
    user_id = v_uid,
    joined_at = coalesce(joined_at, now())
  where (user_id is null or user_id = v_uid)
    and (
      (v_email is not null and public.normalize_email(email) = v_email)
      or (v_phone is not null and public.normalize_phone(phone) = v_phone)
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.claim_team_invites() to authenticated;

-- Create team (owner seat) — max one membership per user.
-- Entitlements: Stripe webhooks are the ONLY path that set plan=team + paid status.
-- Creating a team does NOT grant plan/status (old MVP grant removed).
--
-- Free-for-now product: no paid plan=team check on create (app free-mode grants
-- isTeam). When turning billing back on (BILLING_ENFORCED=true), re-add a plan
-- gate here if you need DB-level enforcement — app UI already gates via isTeam.
create or replace function public.create_team(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_phone text;
  v_team_id uuid;
  v_name text := trim(p_name);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'Team name required';
  end if;

  if exists (
    select 1 from public.team_members m where m.user_id = v_uid
  ) then
    raise exception 'You already belong to a team';
  end if;

  select
    public.normalize_email(u.email),
    public.normalize_phone(u.phone)
  into v_email, v_phone
  from auth.users u
  where u.id = v_uid;

  if (v_email is null or v_email = '') and (v_phone is null or v_phone = '') then
    -- Fallback so contact_chk always has something (phone/email auth orphan edge case)
    v_email := v_uid::text || '@users.local';
  end if;

  insert into public.teams (name, owner_user_id)
  values (v_name, v_uid)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, email, phone, role, joined_at)
  values (v_team_id, v_uid, v_email, v_phone, 'owner', now());

  -- Do NOT touch profiles.plan / status — Stripe webhook owns entitlements.

  return v_team_id;
end;
$$;

grant execute on function public.create_team(text) to authenticated;

-- Owner invites by email and/or phone (cap 5 seats including owner)
create or replace function public.invite_team_member(
  p_team_id uuid,
  p_email text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.normalize_email(p_email);
  v_phone text := public.normalize_phone(p_phone);
  v_id uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_team_owner(p_team_id) then
    raise exception 'Only the team creator can invite members';
  end if;
  if (v_email is null or v_email = '') and (v_phone is null or v_phone = '') then
    raise exception 'Email or phone required';
  end if;
  if v_email is not null and position('@' in v_email) = 0 then
    raise exception 'Valid email required';
  end if;
  if p_phone is not null and trim(p_phone) <> '' and v_phone is null then
    raise exception 'Valid phone required (use US 10-digit or E.164 like +15551234567)';
  end if;

  select count(*)::integer into v_count
  from public.team_members
  where team_id = p_team_id;

  if v_count >= 5 then
    raise exception 'Team is full (max 5 seats)';
  end if;

  if v_email is not null and exists (
    select 1 from public.team_members
    where team_id = p_team_id and public.normalize_email(email) = v_email
  ) then
    raise exception 'That email is already on the team';
  end if;

  if v_phone is not null and exists (
    select 1 from public.team_members
    where team_id = p_team_id and public.normalize_phone(phone) = v_phone
  ) then
    raise exception 'That phone is already on the team';
  end if;

  insert into public.team_members (team_id, email, phone, role)
  values (p_team_id, v_email, v_phone, 'member')
  returning id into v_id;

  -- Attach immediately if invitee already has an account matching email or phone
  update public.team_members m
  set
    user_id = u.id,
    joined_at = now()
  from auth.users u
  where m.id = v_id
    and (
      (v_email is not null and public.normalize_email(u.email) = v_email)
      or (v_phone is not null and public.normalize_phone(u.phone) = v_phone)
    );

  return v_id;
end;
$$;

grant execute on function public.invite_team_member(uuid, text, text) to authenticated;

-- Back-compat: 2-arg email-only call
create or replace function public.invite_team_member(p_team_id uuid, p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.invite_team_member(p_team_id, p_email, null::text);
$$;

grant execute on function public.invite_team_member(uuid, text) to authenticated;

-- Owner removes a member (cannot remove self/owner seat via this path)
create or replace function public.remove_team_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_role text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select team_id, role into v_team_id, v_role
  from public.team_members
  where id = p_member_id;

  if v_team_id is null then
    raise exception 'Member not found';
  end if;
  if not public.is_team_owner(v_team_id) then
    raise exception 'Only the team creator can remove members';
  end if;
  if v_role = 'owner' then
    raise exception 'Cannot remove the team owner';
  end if;

  delete from public.team_members where id = p_member_id;
end;
$$;

grant execute on function public.remove_team_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: teams
-- -----------------------------------------------------------------------------
drop policy if exists "Members read own teams" on public.teams;
create policy "Members read own teams"
  on public.teams for select
  using (
    owner_user_id = auth.uid()
    or public.is_team_member(id)
  );

drop policy if exists "Owner updates team" on public.teams;
create policy "Owner updates team"
  on public.teams for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Owner deletes team" on public.teams;
create policy "Owner deletes team"
  on public.teams for delete
  using (owner_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- RLS: team_members
-- -----------------------------------------------------------------------------
drop policy if exists "Members read roster" on public.team_members;
create policy "Members read roster"
  on public.team_members for select
  using (
    public.is_team_member(team_id)
    or public.is_team_owner(team_id)
    or user_id = auth.uid()
  );

-- Mutations via invite_team_member / remove_team_member RPCs (security definer).

-- -----------------------------------------------------------------------------
-- RLS: user_deals — own deals OR team-shared deals
-- -----------------------------------------------------------------------------
drop policy if exists "Users read own deals" on public.user_deals;
drop policy if exists "Users insert own deals" on public.user_deals;
drop policy if exists "Users update own deals" on public.user_deals;
drop policy if exists "Users delete own deals" on public.user_deals;

drop policy if exists "Read own or team deals" on public.user_deals;
create policy "Read own or team deals"
  on public.user_deals for select
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Insert own deals" on public.user_deals;
create policy "Insert own deals"
  on public.user_deals for insert
  with check (
    auth.uid() = user_id
    and (
      team_id is null
      or public.is_team_member(team_id)
    )
  );

drop policy if exists "Update own or team deals" on public.user_deals;
create policy "Update own or team deals"
  on public.user_deals for update
  using (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  )
  with check (
    auth.uid() = user_id
    or (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Delete own deals" on public.user_deals;
create policy "Delete own deals"
  on public.user_deals for delete
  using (auth.uid() = user_id);
