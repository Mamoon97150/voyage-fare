-- Build 6 (14 Nov 2026): daily estimates from the app (mockup daily-estimates-v4).
-- "Food ~30 € a day each × 4 days": what isn't planned line by line, always estimated (BR-7).
-- The table and its budget views exist since build 1; this saves one in a single step,
-- with who it's for: everyone (no rows, so a traveller added later is on it) or some of them.
create function public.save_daily_estimate(
  p_id          uuid,
  p_trip_id     uuid,
  p_place_id    uuid,
  p_category    text,
  p_label       text,
  p_amount      numeric,
  p_currency    text,
  p_rate        numeric,
  p_days        integer,
  p_travellers  uuid[] default '{}'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_trip_currency text;
  v_rate numeric;
  v_all integer;
  v_picked integer;
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  if p_label is null or length(trim(p_label)) = 0 then
    raise exception 'Give it a name, like “Food”.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter an amount a day, like 30.' using errcode = 'P0001';
  end if;
  if p_days is null or p_days < 1 then
    raise exception 'It lasts at least one day.' using errcode = 'P0001';
  end if;
  if p_place_id is not null and not exists (select 1 from public.places where id = p_place_id and trip_id = p_trip_id) then
    raise exception 'That place isn’t on this trip.' using errcode = 'P0001';
  end if;

  select currency into v_trip_currency from public.trips where id = p_trip_id;
  if p_currency is null or p_currency = v_trip_currency then
    v_rate := 1;
  elsif p_rate is null or p_rate <= 0 then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := p_rate;
  end if;

  select count(*) into v_all from public.travellers where trip_id = p_trip_id;
  select count(distinct t.id) into v_picked
  from public.travellers t where t.trip_id = p_trip_id and t.id = any (coalesce(p_travellers, '{}'));
  if coalesce(array_length(p_travellers, 1), 0) > 0 and v_picked <> (select count(distinct x) from unnest(p_travellers) x) then
    raise exception 'Someone on that list isn’t on this trip.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.daily_estimates (trip_id, place_id, category, label, amount, currency, rate, days)
    values (p_trip_id, p_place_id, p_category, trim(p_label), p_amount, coalesce(p_currency, v_trip_currency), v_rate, p_days)
    returning id into v_id;
  else
    update public.daily_estimates
    set place_id = p_place_id, category = p_category, label = trim(p_label), amount = p_amount,
        currency = coalesce(p_currency, v_trip_currency), rate = v_rate, days = p_days
    where id = v_id and trip_id = p_trip_id;
    if not found then
      raise exception 'Daily estimate not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.daily_estimate_travellers where daily_estimate_id = v_id;
  if v_picked > 0 and v_picked < v_all then
    insert into public.daily_estimate_travellers (daily_estimate_id, traveller_id, trip_id)
    select v_id, t.id, p_trip_id from public.travellers t where t.trip_id = p_trip_id and t.id = any (p_travellers);
  end if;
  return v_id;
end $$;

revoke all on function public.save_daily_estimate(uuid, uuid, uuid, text, text, numeric, text, numeric, integer, uuid[]) from public, anon;
grant execute on function public.save_daily_estimate(uuid, uuid, uuid, text, text, numeric, text, numeric, integer, uuid[]) to authenticated;
