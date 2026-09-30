-- Run once in the Supabase SQL editor.
-- Day 1 sales were stored on alley 1 and alley 2. This puts every Day 1
-- sale from those alleys onto Unimanga's Day 1, then makes each sale's
-- alley match the day it belongs to.

update sales s
set
  day_id = keeper.day_id,
  alley_id = keeper.alley_id
from days d,
(
  select a.id as alley_id, d.id as day_id
  from alleys a
  join days d on d.alley_id = a.id
  where a.name ilike 'unimanga%'
    and d.label = 'Day 1'
  order by a.id, d.id
  limit 1
) keeper
where d.id = s.day_id
  and d.label = 'Day 1'
  and (s.alley_id in (1, 2) or d.alley_id in (1, 2));

update sales s
set alley_id = d.alley_id
from days d
where d.id = s.day_id
  and s.alley_id is distinct from d.alley_id;
