-- =============================================================================
-- SAFE entitlement cleanup for MVP free Team grants
-- Review SELECTs first. Do NOT run blind mass resets of all pro/team profiles.
--
-- Root cause (fixed in app + create_team RPC): public.create_team used to set
-- profiles.plan = 'team' and status = 'active' with no Stripe payment.
-- Paid users always get stripe_customer_id from Checkout / webhook.
-- =============================================================================

-- 1) Review candidates: unpaid-looking paid plans (no Stripe customer)
select
  user_id,
  plan,
  status,
  stripe_customer_id,
  free_deals_created,
  updated_at
from public.profiles
where plan in ('pro', 'team')
  and stripe_customer_id is null
order by updated_at desc;

-- 2) Review team owners without a paid Team profile (MVP residue)
select
  t.id as team_id,
  t.name,
  t.owner_user_id,
  p.plan,
  p.status,
  p.stripe_customer_id
from public.teams t
left join public.profiles p on p.user_id = t.owner_user_id
order by t.created_at desc;

-- 3) RESET only profiles that were never attached to Stripe
--    (typical MVP create_team victims and manual test upgrades).
--    Keeps anyone who completed Checkout (stripe_customer_id set).
-- UPDATE public.profiles
-- SET
--   plan = 'free',
--   status = 'inactive',
--   updated_at = now()
-- WHERE plan in ('pro', 'team')
--   AND stripe_customer_id is null;

-- 4) Optional: single account by email (replace YOUR@EMAIL)
-- UPDATE public.profiles p
-- SET plan = 'free', status = 'inactive', updated_at = now()
-- FROM auth.users u
-- WHERE u.id = p.user_id
--   AND lower(u.email) = lower('YOUR@EMAIL');

-- After reset, user is Free: 1 lifetime personal deal, no Pro UI, no create_team
-- until Team Checkout webhook sets plan=team + status=active.
