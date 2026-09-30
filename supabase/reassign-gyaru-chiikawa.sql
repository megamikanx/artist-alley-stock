-- Run once in the Supabase SQL editor.
-- Gyaru Chiikawa was saved under Steph. It belongs to Yeongseo.

update items
set
  artist_id = (
    select id
    from profiles
    where lower(display_name) like 'yeongseo%'
    order by id
    limit 1
  ),
  updated_at = now()
where lower(btrim(name)) = 'gyaru chiikawa'
  and artist_id in (
    select id
    from profiles
    where lower(display_name) like 'steph%'
  );

update sales
set artist_id = items.artist_id
from items
where sales.item_id = items.id
  and lower(btrim(items.name)) = 'gyaru chiikawa';
