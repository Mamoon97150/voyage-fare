-- A daily estimate keeps its own number of days, because a trip does not always have dates.
-- When dates (or a place's nights) are known and do not match, flag it: the person decides.
create view public.v_daily_estimate_checks with (security_invoker = true) as
select
  d.id as daily_estimate_id,
  d.trip_id,
  d.days,
  expected.days as expected_days,
  coalesce(
    case
      when d.place_id is null then d.days <> expected.days
      -- N nights in a place is N or N + 1 days there: both are fine.
      else d.days not between expected.days and expected.days + 1
    end,
    false
  ) as days_mismatch
from public.daily_estimates d
join public.trips t on t.id = d.trip_id
left join public.places p on p.id = d.place_id
cross join lateral (
  select case
    when d.place_id is null then t.end_date - t.start_date + 1
    else nullif(p.nights, 0)
  end as days
) expected;

revoke all on public.v_daily_estimate_checks from anon, authenticated;
grant select on public.v_daily_estimate_checks to anon, authenticated;
