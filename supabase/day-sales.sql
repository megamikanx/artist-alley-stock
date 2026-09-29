-- Run once in the Supabase SQL editor.
-- Each sale is tied to one alley and one day. The sell screen reads that pair.

alter table sales
  add column if not exists alley_id bigint references alleys (id);

update sales s
set alley_id = d.alley_id
from days d
where d.id = s.day_id
  and s.alley_id is null;

create index if not exists sales_alley_day_idx on sales (alley_id, day_id);

create or replace function record_sale(
  p_day_id bigint,
  p_item_id bigint,
  p_quantity integer
)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day days;
  v_item items;
  v_sale sales;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into v_day from days where id = p_day_id for update;
  if not found then
    raise exception 'Day not found';
  end if;
  if v_day.status <> 'open' then
    raise exception 'This day is closed';
  end if;

  select * into v_item from items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if v_item.quantity < p_quantity then
    raise exception 'Not enough stock';
  end if;
  if not is_admin() and v_item.artist_id is distinct from auth.uid() then
    raise exception 'This item belongs to another artist';
  end if;
  if not is_admin() and not exists (
    select 1 from alley_artists
    where alley_id = v_day.alley_id
      and artist_id = auth.uid()
  ) then
    raise exception 'You are not on this alley';
  end if;

  update items
  set quantity = quantity - p_quantity,
      updated_at = now()
  where id = p_item_id;

  insert into sales (
    day_id,
    alley_id,
    item_id,
    artist_id,
    quantity,
    unit_retail_price,
    unit_production_cost
  )
  values (
    p_day_id,
    v_day.alley_id,
    p_item_id,
    v_item.artist_id,
    p_quantity,
    v_item.retail_price,
    v_item.production_price
  )
  returning * into v_sale;

  return v_sale;
end;
$$;

drop function if exists day_sales(bigint);

create or replace function day_sales(p_alley_id bigint, p_day_id bigint)
returns table (
  id bigint,
  artist_name text,
  item_name text,
  size text,
  quantity integer,
  unit_retail_price numeric,
  unit_production_cost numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    p.display_name,
    i.name,
    i.size,
    s.quantity,
    s.unit_retail_price,
    s.unit_production_cost
  from sales s
  join days d on d.id = s.day_id
  join items i on i.id = s.item_id
  join profiles p on p.id = s.artist_id
  where d.alley_id = p_alley_id
    and d.id = p_day_id
    and auth.uid() is not null
    and (
      is_admin()
      or exists (
        select 1
        from alley_artists aa
        where aa.alley_id = p_alley_id
          and aa.artist_id = auth.uid()
      )
    )
  order by s.sold_at desc;
$$;

revoke all on function day_sales(bigint, bigint) from public;
grant execute on function day_sales(bigint, bigint) to authenticated;
