

drop policy if exists "see own sales" on sales;

create policy "see own sales"
on sales for select to authenticated
using (
  is_admin()
  or exists (
    select 1
    from days d
    join alley_artists aa on aa.alley_id = d.alley_id
    where d.id = sales.day_id
      and aa.artist_id = auth.uid()
  )
);
