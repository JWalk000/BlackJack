-- Deal project files (Supabase Storage) — team-aware
-- Run in SQL Editor after schema.sql and teams.sql.
-- Path layout: deals/{deal_id}/{file_id}-name
-- Access: anyone who can see the user_deals row (owner or team member).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-files',
  'deal-files',
  false,
  12582912, -- 12 MB
  null
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- True when auth user owns or is on the team for this deal id
create or replace function public.can_access_deal_files(p_deal_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_deals d
    where d.id = p_deal_id
      and (
        d.user_id = auth.uid()
        or (
          d.team_id is not null
          and public.is_team_member(d.team_id)
        )
      )
  );
$$;

grant execute on function public.can_access_deal_files(text) to authenticated;

-- Extract deal id from path: deals/{dealId}/...
-- (foldername index 1 = "deals", index 2 = deal id)

drop policy if exists "deal_files_select_own" on storage.objects;
drop policy if exists "deal_files_insert_own" on storage.objects;
drop policy if exists "deal_files_update_own" on storage.objects;
drop policy if exists "deal_files_delete_own" on storage.objects;
drop policy if exists "deal_files_select_deal" on storage.objects;
drop policy if exists "deal_files_insert_deal" on storage.objects;
drop policy if exists "deal_files_update_deal" on storage.objects;
drop policy if exists "deal_files_delete_deal" on storage.objects;

create policy "deal_files_select_deal"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (
      -- New path: deals/{dealId}/...
      (
        (storage.foldername(name))[1] = 'deals'
        and public.can_access_deal_files((storage.foldername(name))[2])
      )
      -- Legacy path: {userId}/{dealId}/...
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

create policy "deal_files_insert_deal"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = 'deals'
    and public.can_access_deal_files((storage.foldername(name))[2])
  );

create policy "deal_files_update_deal"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (
      (
        (storage.foldername(name))[1] = 'deals'
        and public.can_access_deal_files((storage.foldername(name))[2])
      )
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'deal-files'
    and (
      (
        (storage.foldername(name))[1] = 'deals'
        and public.can_access_deal_files((storage.foldername(name))[2])
      )
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

create policy "deal_files_delete_deal"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (
      (
        (storage.foldername(name))[1] = 'deals'
        and public.can_access_deal_files((storage.foldername(name))[2])
      )
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
