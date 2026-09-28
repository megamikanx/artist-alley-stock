create table if not exists restocks (
  id bigint generated always as identity primary key,
  item_id bigint not null references items (id) on delete cascade,
  artist_id uuid not null references profiles (id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(10, 2) not null check (unit_cost >= 0),
  restocked_at timestamptz not null default now()
);

alter table restocks enable row level security;

drop policy if exists "see own restocks" on restocks;
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
