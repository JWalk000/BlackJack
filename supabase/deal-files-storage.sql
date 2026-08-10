-- Deal project files (Supabase Storage)
-- Run in SQL Editor after schema.sql (and teams.sql if you use teams).
-- Bucket is private; app uses signed URLs.

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

-- Path layout: {user_id}/{deal_id}/{file_id}-name
-- First folder segment must match auth.uid() for write/read/delete.

drop policy if exists "deal_files_select_own" on storage.objects;
create policy "deal_files_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "deal_files_insert_own" on storage.objects;
create policy "deal_files_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "deal_files_update_own" on storage.objects;
create policy "deal_files_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "deal_files_delete_own" on storage.objects;
create policy "deal_files_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
