-- Create a trip in one step (mockup 7): the trip, "you" as its first traveller,
-- and the other travellers by name. All or nothing: no trip without its travellers.
-- Runs with the caller's rights, so the usual privacy rules apply.
create function public.create_trip(
  p_name           text,
  p_me             text,
  p_travellers     text[] default '{}',
  p_start_date     date default null,
  p_end_date       date default null,
  p_home_city      text default null,
  p_home_latitude  double precision default null,
  p_home_longitude double precision default null,
  p_currency       text default 'EUR',
  p_target_amount  numeric default null,
  p_target_scope   text default 'per_person'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_name text;
  v_position integer := 1;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a trip' using errcode = '42501';
  end if;

  insert into public.trips (
    name, start_date, end_date, home_city, home_latitude, home_longitude,
    currency, target_amount, target_scope
  ) values (
    trim(p_name), p_start_date, p_end_date, nullif(trim(p_home_city), ''), p_home_latitude, p_home_longitude,
    coalesce(p_currency, 'EUR'), p_target_amount, coalesce(p_target_scope, 'per_person')
  ) returning id into v_trip;

  -- "You": linked to the account, so "your share" is yours.
  insert into public.travellers (trip_id, name, user_id, position)
  values (v_trip, coalesce(nullif(trim(p_me), ''), 'Me'), auth.uid(), 0);

  foreach v_name in array coalesce(p_travellers, '{}') loop
    if nullif(trim(v_name), '') is not null then
      insert into public.travellers (trip_id, name, position) values (v_trip, trim(v_name), v_position);
      v_position := v_position + 1;
    end if;
  end loop;

  return v_trip;
end $$;

revoke all on function public.create_trip(text, text, text[], date, date, text, double precision, double precision, text, numeric, text) from public, anon;
grant execute on function public.create_trip(text, text, text[], date, date, text, double precision, double precision, text, numeric, text) to authenticated;
