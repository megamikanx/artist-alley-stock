-- Run once in the Supabase SQL editor.
-- Admin alley pages use this to total each artist's sales at one alley.

create or replace function alley_artist_sales(p_alley_id bigint)
returns table (
  artist_id uuid,
  artist_name text,
  units integer,
  revenue numeric,
  profit numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.artist_id,
    p.display_name,
    coalesce(sum(s.quantity), 0)::integer,
    coalesce(sum(s.quantity * s.unit_retail_price), 0),
    coalesce(sum(s.quantity * (s.unit_retail_price - s.unit_production_cost)), 0)
  from sales s
  join days d on d.id = s.day_id
  join profiles p on p.id = s.artist_id
  where coalesce(s.alley_id, d.alley_id) = p_alley_id
    and auth.uid() is not null
    and is_admin()
  group by s.artist_id, p.display_name
  order by p.display_name;
$$;

revoke all on function alley_artist_sales(bigint) from public;
grant execute on function alley_artist_sales(bigint) to authenticated;
