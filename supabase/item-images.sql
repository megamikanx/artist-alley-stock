insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read item images" on storage.objects;
drop policy if exists "artists write own item images" on storage.objects;
drop policy if exists "artists update own item images" on storage.objects;
drop policy if exists "artists delete own item images" on storage.objects;

create policy "public read item images"
on storage.objects for select
to public
using (bucket_id = 'item-images');

create policy "artists write own item images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'item-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "artists update own item images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'item-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "artists delete own item images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'item-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);
