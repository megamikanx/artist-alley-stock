create or replace function public.alley_artist_count(p_alley_id bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.alley_artists
  where alley_id = p_alley_id;
$$;

create or replace function public.shares_alley(p_alley_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.alley_artists
      where alley_id = p_alley_id
        and artist_id = auth.uid()
    );
$$;

create or replace function public.can_see_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.alley_artists mine
      join public.alley_artists theirs on theirs.alley_id = mine.alley_id
      where mine.artist_id = auth.uid()
        and theirs.artist_id = p_profile_id
    );
$$;

revoke execute on function public.alley_artist_count(bigint) from public, anon;
revoke execute on function public.shares_alley(bigint) from public, anon;
revoke execute on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.alley_artist_count(bigint) to authenticated;
grant execute on function public.shares_alley(bigint) to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;

drop policy if exists "see memberships" on public.alley_artists;
create policy "see memberships"
on public.alley_artists for select to authenticated
using (public.shares_alley(alley_id));

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or public.can_see_profile(id));

drop view if exists public.all_time_profit;
drop view if exists public.alley_profits;

create view public.alley_profits
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
      - coalesce(a.tabling_fee / nullif(public.alley_artist_count(a.id), 0), 0)
  end as profit,
  public.alley_artist_count(a.id) as artist_count,
  coalesce(a.tabling_fee / nullif(public.alley_artist_count(a.id), 0), 0) as fee_share
from public.alleys a
left join public.day_profits dp on dp.alley_id = a.id
group by a.id;

create view public.all_time_profit
with (security_invoker = true) as
select coalesce(sum(profit), 0) as profit
from public.alley_profits;

grant select on public.alley_profits, public.all_time_profit to authenticated;
