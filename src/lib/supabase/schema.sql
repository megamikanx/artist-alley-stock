-- From-scratch copy of the database.
-- The live project already has these objects. Do not run this file there.
-- Use artist-access.sql for an existing database.

create type item_category as enum ('print', 'sticker', 'handmade');
create type day_status as enum ('open', 'closed');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'artist' check (role in ('admin', 'artist')),
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

create or replace function alley_artist_count(p_alley_id bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from alley_artists
  where alley_id = p_alley_id;
$$;

create or replace function shares_alley(p_alley_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin()
    or exists (
      select 1
      from alley_artists
      where alley_id = p_alley_id
        and artist_id = auth.uid()
    );
$$;

create or replace function can_see_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id = auth.uid()
    or is_admin()
    or exists (
      select 1
      from alley_artists mine
      join alley_artists theirs on theirs.alley_id = mine.alley_id
      where mine.artist_id = auth.uid()
        and theirs.artist_id = p_profile_id
    );
$$;

revoke execute on function alley_artist_count(bigint) from public, anon;
revoke execute on function shares_alley(bigint) from public, anon;
revoke execute on function can_see_profile(uuid) from public, anon;
grant execute on function alley_artist_count(bigint) to authenticated;
grant execute on function shares_alley(bigint) to authenticated;
grant execute on function can_see_profile(uuid) to authenticated;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'artist')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Items are the stock rows. A3 and A4 of the same artwork are two items.
-- Each row belongs to one artist. Sales copy the prices and the artist.
-- Days belong to an alley. The tabling fee belongs to the alley, once.

create table items (
  id bigint generated always as identity primary key,
  name text not null,
  category item_category not null,
  size text,
  artist_id uuid not null references profiles (id),
  quantity integer not null default 0 check (quantity >= 0),
  production_price numeric(10,2) not null check (production_price >= 0),
  retail_price numeric(10,2) not null check (retail_price >= 0),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint size_only_on_standard_prints check (
    (category = 'print' and size in ('A3', 'A4', 'A5'))
    or (category <> 'print' and size is null)
  )
);

-- Two artists may both sell an A3 with the same name.
create unique index items_one_sku
on items (artist_id, lower(btrim(name)), category, coalesce(size, ''));

create index items_artist_id_idx on items (artist_id);

create table alleys (
  id bigint generated always as identity primary key,
  name text not null,
  starts_on date,
  ends_on date,
  tabling_fee numeric(10,2) not null default 0 check (tabling_fee >= 0),
  notes text,
  created_at timestamptz not null default now()
);

-- Who tabled at which alley.
create table alley_artists (
  alley_id bigint not null references alleys (id) on delete cascade,
  artist_id uuid not null references profiles (id) on delete cascade,
  primary key (alley_id, artist_id)
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

-- Each alley can have one open day. Two alleys can be open on the same weekend.
create unique index one_open_day_per_alley
on days (alley_id) where status = 'open';

create table sales (
  id bigint generated always as identity primary key,
  day_id bigint not null references days (id) on delete cascade,
  alley_id bigint not null references alleys (id),
  item_id bigint not null references items (id),
  artist_id uuid not null references profiles (id),
  quantity integer not null check (quantity > 0),
  unit_retail_price numeric(10,2) not null check (unit_retail_price >= 0),
  unit_production_cost numeric(10,2) not null check (unit_production_cost >= 0),
  sold_at timestamptz not null default now()
);

create index days_alley_id_idx on days (alley_id);
create index sales_day_id_idx on sales (day_id);
create index sales_item_id_idx on sales (item_id);
create index sales_artist_id_idx on sales (artist_id);

-- Profit for one open or closed day. The tabling fee is not included here.
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

-- The booth fee is split across the artists on the alley.
-- Admin profit subtracts the full fee. An artist's profit subtracts fee / n.
create view alley_profits
with (security_invoker = true) as
select
  a.id as alley_id,
  a.name,
  a.tabling_fee,
  coalesce(sum(dp.revenue), 0) as revenue,
  coalesce(sum(dp.production_cost), 0) as production_cost,
  coalesce(sum(dp.profit), 0) as days_profit,
  case
    when is_admin() then coalesce(sum(dp.profit), 0) - a.tabling_fee
    else coalesce(sum(dp.profit), 0)
      - coalesce(a.tabling_fee / nullif(alley_artist_count(a.id), 0), 0)
  end as profit,
  alley_artist_count(a.id) as artist_count,
  coalesce(a.tabling_fee / nullif(alley_artist_count(a.id), 0), 0) as fee_share
from alleys a
left join day_profits dp on dp.alley_id = a.id
group by a.id;

create view all_time_profit
with (security_invoker = true) as
select coalesce(sum(profit), 0) as profit
from alley_profits;

create function record_sale(
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

create function void_sale(p_sale_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales;
  v_day days;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_sale from sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;

  select * into v_day from days where id = v_sale.day_id;
  if v_day.status <> 'open' then
    raise exception 'This day is closed';
  end if;
  if not is_admin() and v_sale.artist_id is distinct from auth.uid() then
    raise exception 'This sale belongs to another artist';
  end if;

  update items
  set quantity = quantity + v_sale.quantity,
      updated_at = now()
  where id = v_sale.item_id;

  delete from sales where id = p_sale_id;
end;
$$;

create function end_day(p_day_id bigint)
returns days
language plpgsql
security invoker
set search_path = public
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

revoke insert, update, delete on sales from public, anon, authenticated;
grant select on sales to authenticated;

alter table profiles enable row level security;
alter table items enable row level security;
alter table alleys enable row level security;
alter table alley_artists enable row level security;
alter table days enable row level security;
alter table sales enable row level security;

create policy "read own profile"
on profiles for select to authenticated
using (id = auth.uid() or is_admin() or can_see_profile(id));

create policy "admin updates profiles"
on profiles for update to authenticated
using (is_admin())
with check (is_admin());

create policy "see memberships"
on alley_artists for select to authenticated
using (shares_alley(alley_id));

create policy "admin manages memberships"
on alley_artists for all to authenticated
using (is_admin())
with check (is_admin());

create policy "artists manage own items"
on items for all to authenticated
using (artist_id = auth.uid() or is_admin())
with check (artist_id = auth.uid() or is_admin());

create policy "see participating alleys"
on alleys for select to authenticated
using (
  is_admin()
  or exists (
    select 1 from alley_artists aa
    where aa.alley_id = alleys.id
      and aa.artist_id = auth.uid()
  )
);

create policy "admin inserts alleys"
on alleys for insert to authenticated
with check (is_admin());

create policy "admin updates alleys"
on alleys for update to authenticated
using (is_admin())
with check (is_admin());

create policy "admin deletes alleys"
on alleys for delete to authenticated
using (is_admin());

create policy "see days for participating alleys"
on days for select to authenticated
using (
  is_admin()
  or exists (
    select 1 from alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
);

create policy "participants insert days"
on days for insert to authenticated
with check (
  is_admin()
  or exists (
    select 1 from alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
);

create policy "participants update days"
on days for update to authenticated
using (
  is_admin()
  or exists (
    select 1 from alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
)
with check (
  is_admin()
  or exists (
    select 1 from alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
);

create policy "admin deletes days"
on days for delete to authenticated
using (is_admin());

create policy "see own sales"
on sales for select to authenticated
using (
  is_admin()
  or exists (
    select 1
    from days d
    join alley_artists aa on aa.alley_id = d.alley_id
    where d.id = sales.day_id
      and d.alley_id = aa.alley_id
      and aa.artist_id = auth.uid()
  )
);

grant select on day_profits, alley_profits, all_time_profit to authenticated;

create table restocks (
  id bigint generated always as identity primary key,
  item_id bigint not null references items (id) on delete cascade,
  artist_id uuid not null references profiles (id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(10, 2) not null check (unit_cost >= 0),
  restocked_at timestamptz not null default now()
);

alter table restocks enable row level security;

create policy "see own restocks"
on restocks for select to authenticated
using (artist_id = auth.uid() or is_admin());

create or replace function restock_item(
  p_item_id bigint,
  p_quantity integer,
  p_unit_cost numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Add at least one copy.';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Cost cannot be negative.';
  end if;

  select artist_id into v_artist from items where id = p_item_id;
  if v_artist is null then
    raise exception 'Item not found.';
  end if;
  if v_artist <> auth.uid() and not is_admin() then
    raise exception 'You can only restock your own items.';
  end if;

  insert into restocks (item_id, artist_id, quantity, unit_cost)
  values (p_item_id, v_artist, p_quantity, p_unit_cost);

  update items
  set quantity = quantity + p_quantity,
      updated_at = now()
  where id = p_item_id;
end;
$$;

revoke all on function restock_item(bigint, integer, numeric) from public;
grant execute on function restock_item(bigint, integer, numeric) to authenticated;
