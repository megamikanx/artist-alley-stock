-- Accounts. The role decides who can oversee the whole app.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'artist' check (role in ('admin', 'artist')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- New dashboard users become artists. They cannot choose admin themselves.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'artist')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that already exist are the admin. Later accounts stay artists.
insert into public.profiles (id, display_name, role)
select id, coalesce(split_part(email, '@', 1), 'admin'), 'admin'
from auth.users
on conflict (id) do update set role = 'admin';

-- Who tabled at which alley.
create table public.alley_artists (
  alley_id bigint not null references public.alleys (id) on delete cascade,
  artist_id uuid not null references public.profiles (id) on delete cascade,
  primary key (alley_id, artist_id)
);

alter table public.items
  add column artist_id uuid references public.profiles (id);

update public.items
set artist_id = (select id from public.profiles where role = 'admin' limit 1);

alter table public.items
  alter column artist_id set not null;

alter table public.sales
  add column artist_id uuid references public.profiles (id);

update public.sales
set artist_id = (select id from public.profiles where role = 'admin' limit 1);

alter table public.sales
  alter column artist_id set not null;

-- Two artists may both sell an A3 with the same name.
drop index if exists items_one_sku;
create unique index items_one_sku
  on public.items (artist_id, lower(btrim(name)), category, coalesce(size, ''));

-- Each alley can have one open day. Two alleys can be open on the same weekend.
drop index if exists one_open_day;
create unique index one_open_day_per_alley
  on public.days (alley_id) where status = 'open';

create index items_artist_id_idx on public.items (artist_id);
create index sales_artist_id_idx on public.sales (artist_id);

-- Sales go through these functions, so a sale and the stock change stay together.
drop function if exists public.record_sale(bigint, bigint, integer);
drop function if exists public.void_sale(bigint);

create function public.record_sale(
  p_day_id bigint,
  p_item_id bigint,
  p_quantity integer
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day public.days;
  v_item public.items;
  v_sale public.sales;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into v_day from public.days where id = p_day_id for update;
  if not found then
    raise exception 'Day not found';
  end if;
  if v_day.status <> 'open' then
    raise exception 'This day is closed';
  end if;

  select * into v_item from public.items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if v_item.quantity < p_quantity then
    raise exception 'Not enough stock';
  end if;
  if not public.is_admin() and v_item.artist_id is distinct from auth.uid() then
    raise exception 'This item belongs to another artist';
  end if;
  if not public.is_admin() and not exists (
    select 1 from public.alley_artists
    where alley_id = v_day.alley_id
      and artist_id = auth.uid()
  ) then
    raise exception 'You are not on this alley';
  end if;

  update public.items
  set quantity = quantity - p_quantity,
      updated_at = now()
  where id = p_item_id;

  insert into public.sales (
    day_id,
    item_id,
    artist_id,
    quantity,
    unit_retail_price,
    unit_production_cost
  )
  values (
    p_day_id,
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

create function public.void_sale(p_sale_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_day public.days;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;

  select * into v_day from public.days where id = v_sale.day_id;
  if v_day.status <> 'open' then
    raise exception 'This day is closed';
  end if;
  if not public.is_admin() and v_sale.artist_id is distinct from auth.uid() then
    raise exception 'This sale belongs to another artist';
  end if;

  update public.items
  set quantity = quantity + v_sale.quantity,
      updated_at = now()
  where id = v_sale.item_id;

  delete from public.sales where id = p_sale_id;
end;
$$;

revoke execute on function public.record_sale(bigint, bigint, integer) from public, anon;
revoke execute on function public.void_sale(bigint) from public, anon;
grant execute on function public.record_sale(bigint, bigint, integer) to authenticated;
grant execute on function public.void_sale(bigint) to authenticated;

revoke insert, update, delete on public.sales from public, anon, authenticated;
grant select on public.sales to authenticated;

drop policy if exists "signed in users manage items" on public.items;
drop policy if exists "signed in users manage alleys" on public.alleys;
drop policy if exists "signed in users manage days" on public.days;
drop policy if exists "signed in users manage sales" on public.sales;

alter table public.profiles enable row level security;
alter table public.alley_artists enable row level security;

create policy "read own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "admin updates profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "see memberships"
on public.alley_artists for select to authenticated
using (artist_id = auth.uid() or public.is_admin());

create policy "admin manages memberships"
on public.alley_artists for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "artists manage own items"
on public.items for all to authenticated
using (artist_id = auth.uid() or public.is_admin())
with check (artist_id = auth.uid() or public.is_admin());

create policy "see participating alleys"
on public.alleys for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.alley_artists aa
    where aa.alley_id = alleys.id
      and aa.artist_id = auth.uid()
  )
);

create policy "admin inserts alleys"
on public.alleys for insert to authenticated
with check (public.is_admin());

create policy "admin updates alleys"
on public.alleys for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admin deletes alleys"
on public.alleys for delete to authenticated
using (public.is_admin());

create policy "see days for participating alleys"
on public.days for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
);

create policy "participants insert days"
on public.days for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
);

create policy "participants update days"
on public.days for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.alley_artists aa
    where aa.alley_id = days.alley_id
      and aa.artist_id = auth.uid()
  )
);

create policy "admin deletes days"
on public.days for delete to authenticated
using (public.is_admin());

create policy "see own sales"
on public.sales for select to authenticated
using (
  public.is_admin()
  or (
    artist_id = auth.uid()
    and exists (
      select 1
      from public.days d
      join public.alley_artists aa on aa.alley_id = d.alley_id
      where d.id = sales.day_id
        and aa.artist_id = auth.uid()
    )
  )
);

-- Admin profit subtracts the booth fee. An artist's profit does not.
create or replace view public.alley_profits
with (security_invoker = true) as
select
  a.id as alley_id,
  a.name,
  a.tabling_fee,
  coalesce(sum(dp.revenue), 0) as revenue,
  coalesce(sum(dp.production_cost), 0) as production_cost,
  coalesce(sum(dp.profit), 0) as days_profit,
  case
    when public.is_admin() then coalesce(sum(dp.profit), 0) - a.tabling_fee
    else coalesce(sum(dp.profit), 0)
  end as profit
from public.alleys a
left join public.day_profits dp on dp.alley_id = a.id
group by a.id;