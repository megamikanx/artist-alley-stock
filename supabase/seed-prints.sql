create or replace function pg_temp.artist_id(p_name text)
returns uuid
language plpgsql
as $$
declare
  found uuid;
  matches integer;
begin
  select count(*) into matches
  from profiles
  where lower(display_name) like lower(p_name) || '%';

  if matches = 0 then
    raise exception 'No profile display_name starts with %', p_name;
  end if;
  if matches > 1 then
    raise exception 'More than one profile display_name starts with %', p_name;
  end if;

  select id into found
  from profiles
  where lower(display_name) like lower(p_name) || '%';

  return found;
end;
$$;

create or replace procedure pg_temp.upsert_print(
  p_artist uuid,
  p_name text,
  p_size text,
  p_qty integer
)
language plpgsql
as $$
begin
  update items
  set quantity = p_qty,
      production_price = case p_size
        when 'A3' then 2.47
        when 'A4' then 1.23
        when 'A5' then 0.62
      end,
      updated_at = now()
  where artist_id = p_artist
    and lower(btrim(name)) = lower(btrim(p_name))
    and category = 'print'
    and size = p_size;

  if not found then
    insert into items (
      name,
      category,
      size,
      artist_id,
      quantity,
      production_price,
      retail_price
    )
    values (
      p_name,
      'print',
      p_size,
      p_artist,
      p_qty,
      case p_size
        when 'A3' then 2.47
        when 'A4' then 1.23
        when 'A5' then 0.62
      end,
      0
    );
  end if;
end;
$$;

create or replace procedure pg_temp.upsert_goods(
  p_artist uuid,
  p_name text,
  p_category item_category,
  p_qty integer,
  p_cost numeric,
  p_set_qty boolean
)
language plpgsql
as $$
begin
  if p_set_qty then
    update items
    set quantity = p_qty,
        production_price = p_cost,
        updated_at = now()
    where artist_id = p_artist
      and lower(btrim(name)) = lower(btrim(p_name))
      and category = p_category
      and size is null;
  else
    update items
    set production_price = p_cost,
        updated_at = now()
    where artist_id = p_artist
      and lower(btrim(name)) = lower(btrim(p_name))
      and category = p_category
      and size is null;
  end if;

  if not found then
    insert into items (
      name,
      category,
      size,
      artist_id,
      quantity,
      production_price,
      retail_price
    )
    values (p_name, p_category, null, p_artist, p_qty, p_cost, 0);
  end if;
end;
$$;

do $$
declare
  bruce uuid := pg_temp.artist_id('bruce');
  yeongseo uuid := pg_temp.artist_id('yeongseo');
  steph uuid := pg_temp.artist_id('steph');
begin
  call pg_temp.upsert_print(bruce, 'Double Kris', 'A5', 8);
  call pg_temp.upsert_print(bruce, 'Zato 2', 'A5', 8);
  call pg_temp.upsert_print(bruce, 'Denreze', 'A5', 13);
  call pg_temp.upsert_print(bruce, 'Reze Portrait', 'A5', 12);
  call pg_temp.upsert_print(bruce, 'False Memory Yi', 'A5', 8);
  call pg_temp.upsert_print(bruce, 'Reze Bomb', 'A5', 8);
  call pg_temp.upsert_print(bruce, 'Zato 1', 'A5', 9);
  call pg_temp.upsert_print(bruce, 'Gaster', 'A5', 13);
  call pg_temp.upsert_print(bruce, 'Knight', 'A5', 10);
  call pg_temp.upsert_print(bruce, 'Arsene', 'A5', 12);
  call pg_temp.upsert_print(bruce, 'Thanatos', 'A5', 8);
  call pg_temp.upsert_print(bruce, 'Kris Lake', 'A5', 6);
  call pg_temp.upsert_print(bruce, 'Kris Fridge', 'A5', 7);

  call pg_temp.upsert_print(bruce, 'Arsene', 'A4', 3);
  call pg_temp.upsert_print(bruce, 'Knight', 'A4', 2);
  call pg_temp.upsert_print(bruce, 'Reze Portrait', 'A4', 3);
  call pg_temp.upsert_print(bruce, 'Thanatos', 'A4', 2);
  call pg_temp.upsert_print(bruce, 'Denreze', 'A4', 3);
  call pg_temp.upsert_print(bruce, 'Kris Fridge', 'A4', 3);
  call pg_temp.upsert_print(bruce, 'Zato 1', 'A4', 2);
  call pg_temp.upsert_print(bruce, 'Gaster', 'A4', 2);
  call pg_temp.upsert_print(bruce, 'Kris Lake', 'A4', 3);
  call pg_temp.upsert_print(bruce, 'Reze Bomb', 'A4', 4);
  call pg_temp.upsert_print(bruce, 'Double Kris', 'A4', 4);
  call pg_temp.upsert_print(bruce, 'False Memory Yi', 'A4', 4);
  call pg_temp.upsert_print(bruce, 'Zato 2', 'A4', 4);

  call pg_temp.upsert_print(bruce, 'Reze Bomb', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Zato 2', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'False Memory Yi', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Double Kris', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Zato 1', 'A3', 2);
  call pg_temp.upsert_print(bruce, 'Kris Lake', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Thanatos', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Arsene', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Reze Portrait', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Denreze', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Gaster', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Kris Fridge', 'A3', 1);
  call pg_temp.upsert_print(bruce, 'Knight', 'A3', 2);

  call pg_temp.upsert_print(yeongseo, 'Funkin Pico', 'A5', 4);
  call pg_temp.upsert_print(yeongseo, 'Sonic', 'A5', 8);
  call pg_temp.upsert_print(yeongseo, 'Funkin BFGF', 'A5', 4);
  call pg_temp.upsert_print(yeongseo, 'Funkin Double Sided', 'A5', 4);
  call pg_temp.upsert_print(yeongseo, 'Fun Gang', 'A5', 8);
  call pg_temp.upsert_print(yeongseo, 'Funkin Pico', 'A4', 4);

  call pg_temp.upsert_print(steph, 'Anonsoyo', 'A5', 8);
  call pg_temp.upsert_print(steph, 'Raana', 'A5', 8);
  call pg_temp.upsert_print(steph, 'Hiro', 'A5', 8);

  call pg_temp.upsert_goods(yeongseo, 'Hot Dog Seal', 'sticker', 0, 1.50, false);
  call pg_temp.upsert_goods(yeongseo, 'Burger Seal', 'sticker', 0, 1.50, false);
  call pg_temp.upsert_goods(yeongseo, 'Tempura Seal', 'sticker', 0, 1.50, false);

  call pg_temp.upsert_goods(steph, 'Card Holders', 'handmade', 2, 5.00, true);
  call pg_temp.upsert_goods(steph, 'Neru', 'sticker', 7, 1.50, true);
  call pg_temp.upsert_goods(steph, 'Teto', 'sticker', 3, 1.50, true);
  call pg_temp.upsert_goods(steph, 'Kris', 'sticker', 1, 1.50, true);

  update items
  set production_price = case size
        when 'A3' then 2.47
        when 'A4' then 1.23
        when 'A5' then 0.62
        else production_price
      end,
      updated_at = now()
  where category = 'print'
    and size in ('A3', 'A4', 'A5');

  update items
  set production_price = 1.50,
      updated_at = now()
  where category = 'sticker';
end;
$$;
