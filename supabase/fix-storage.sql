-- Quick fix: make chroma-media uploads work for logged-in users
-- Run once in Supabase SQL Editor if publish upload still fails

insert into storage.buckets (id, name, public)
values ('chroma-media', 'chroma-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read chroma-media" on storage.objects;
drop policy if exists "Auth upload chroma-media" on storage.objects;
drop policy if exists "Owner update chroma-media" on storage.objects;
drop policy if exists "Owner delete chroma-media" on storage.objects;
drop policy if exists "Authenticated upload any chroma-media" on storage.objects;

create policy "Public read chroma-media"
  on storage.objects for select
  using (bucket_id = 'chroma-media');

-- Allow any authenticated user to upload into the bucket
create policy "Authenticated upload any chroma-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chroma-media');

create policy "Owner update chroma-media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chroma-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner delete chroma-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chroma-media' and auth.uid()::text = (storage.foldername(name))[1]);
