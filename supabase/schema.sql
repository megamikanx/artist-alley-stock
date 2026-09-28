-- Items are the stock rows. A3 and A4 of the same artwork are two items.
-- Sales copy the prices from the moment of the sale.
-- Days belong to an alley. The tabling fee belongs to the alley, once.

create type item_category as enum ('print', 'sticker', 'handmade');
create type day_status as enum ('open', 'closed');

create table items (
  id bigint generated always as identity primary key,
  name text not null,
  category item_category not null,
  size text,
  quantity integer not null default 0 check (quantity >= 0),
  production_price numeric(10,2) not null check (production_price >= 0),
  retail_price numeric(10,2) not null check (retail_price >= 0),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Prints of different sizes are treated as different items
  constraint size_only_on_standard_prints check (
    (category = 'print' and size in ('A3', 'A4', 'A5'))
    or (category <> 'print' and size is null)
  )
);

-- One unique item per name and size combination. 
create unique index items_one_sku
on items (lower(btrim(name)), category, coalesce(size, ''));

create table alleys (
  id bigint generated always as identity primary key,
  name text not null,
  starts_on date,
  ends_on date,
  tabling_fee numeric(10,2) not null default 0 check (tabling_fee >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table days (
  id bigint generated always as identity primary key,
  alley_id bigint not null references alleys (id) on delete cascade,
  label text not null,
  status day_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (alley_id, label)
);

-- Opens one register at a time, day 1 must be closed before day 2
create unique index one_open_day on days (status) where status = 'open';

create table sales (
  id bigint generated always as identity primary key,
  day_id bigint not null references days (id) on delete cascade,
  item_id bigint not null references items (id),
  quantity integer not null check (quantity > 0),
  unit_retail_price numeric(10,2) not null check (unit_retail_price >= 0),
  unit_production_cost numeric(10,2) not null check (unit_production_cost >= 0),
  sold_at timestamptz not null default now()
);

create index days_alley_id_idx on days (alley_id);
create index sales_day_id_idx on sales (day_id);
create index sales_item_id_idx on sales (item_id);

-- Profit for one open or closed day; tabling fee not included.
create view day_profits
with (security_invoker = true) as
select
  d.id as day_id,
  d.alley_id,
  d.label,
  d.status,
  coalesce(sum(s.quantity * s.unit_retail_price), 0) as revenue,
  coalesce(sum(s.quantity * s.unit_production_cost), 0) as production_cost,
  coalesce(sum(s.quantity * (s.unit_retail_price - s.unit_production_cost)), 0) as profit
from days d
left join sales s on s.day_id = d.id
group by d.id;

-- Day profits added together, then the alley fee subtracted once.
create view alley_profits
with (security_invoker = true) as
select
  a.id as alley_id,
  a.name,
  a.tabling_fee,
  coalesce(sum(dp.revenue), 0) as revenue,
  coalesce(sum(dp.production_cost), 0) as production_cost,
  coalesce(sum(dp.profit), 0) as days_profit,
  coalesce(sum(dp.profit), 0) - a.tabling_fee as profit
from alleys a
left join day_profits dp on dp.alley_id = a.id
group by a.id;

create view all_time_profit
with (security_invoker = true) as
select coalesce(sum(profit), 0) as profit
from alley_profits;

-- Sell, undo, and end day each happen as one database change.
create or replace function record_sale(
  p_day_id bigint,
  p_item_id bigint,
  p_quantity integer
)
returns sales
language plpgsql
security invoker
as $$
declare
  v_day days;
  v_item items;
  v_sale sales;
begin
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

  update items
  set quantity = quantity - p_quantity,
      updated_at = now()
  where id = p_item_id;

  insert into sales (
    day_id,
    item_id,
    quantity,
    unit_retail_price,
    unit_production_cost
  )
  values (
    p_day_id,
    p_item_id,
    p_quantity,
    v_item.retail_price,
    v_item.production_price
  )
  returning * into v_sale;

  return v_sale;
end;
$$;

create or replace function void_sale(p_sale_id bigint)
returns void
language plpgsql
security invoker
as $$
declare
  v_sale sales;
  v_day days;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;

  select * into v_day from days where id = v_sale.day_id;
  if v_day.status <> 'open' then
    raise exception 'This day is closed';
  end if;

  update items
  set quantity = quantity + v_sale.quantity,
      updated_at = now()
  where id = v_sale.item_id;

  delete from sales where id = p_sale_id;
end;
$$;

create or replace function end_day(p_day_id bigint)
returns days
language plpgsql
security invoker
as $$
declare
  v_day days;
begin
  update days
  set status = 'closed',
      closed_at = now()
  where id = p_day_id
    and status = 'open'
  returning * into v_day;

  if not found then
    raise exception 'This day is missing or already closed';
  end if;

  return v_day;
end;
$$;

revoke execute on function record_sale(bigint, bigint, integer) from public, anon;
revoke execute on function void_sale(bigint) from public, anon;
revoke execute on function end_day(bigint) from public, anon;

grant execute on function record_sale(bigint, bigint, integer) to authenticated;
grant execute on function void_sale(bigint) to authenticated;
grant execute on function end_day(bigint) to authenticated;

alter table items enable row level security;
alter table alleys enable row level security;
alter table days enable row level security;
alter table sales enable row level security;

create policy "signed in users manage items"
on items for all to authenticated
using (true) with check (true);

create policy "signed in users manage alleys"
on alleys for all to authenticated
using (true) with check (true);

create policy "signed in users manage days"
on days for all to authenticated
using (true) with check (true);

create policy "signed in users manage sales"
on sales for all to authenticated
using (true) with check (true);

grant select on day_profits, alley_profits, all_time_profit to authenticated;