-- Currencies (build 3). Every price keeps its own currency and the rate saved when it was typed
-- (BR-10: trip currency per 1 unit). Two things here:
-- 1. What was really paid can be in another currency too (set_item_status gets a currency + rate).
-- 2. The main currency can change until the first payment (decision 12 Nov): every saved rate and
--    the target are converted with one rate, so nothing moves except the unit.

drop function public.set_item_status(uuid, text, numeric, uuid, date);

create function public.set_item_status(
  p_item_id         uuid,
  p_status          text,
  p_actual_amount   numeric default null,
  p_paid_by         uuid default null,
  p_paid_on         date default null,
  p_actual_currency text default null,
  p_actual_rate     numeric default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_currency text;
  v_actual_currency text;
  v_rate numeric;
begin
  if p_status not in ('chosen', 'booked', 'paid') then
    raise exception 'A status is chosen, booked or paid.' using errcode = 'P0001';
  end if;

  select i.trip_id, t.currency into v_trip, v_currency
  from public.items i join public.trips t on t.id = i.trip_id
  where i.id = p_item_id;
  if v_trip is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  if p_status <> 'chosen' and not exists (select 1 from public.options where item_id = p_item_id and is_chosen) then
    raise exception 'Choose an option first: that’s what gets booked.' using errcode = 'P0001';
  end if;
  if p_status = 'paid' and (p_actual_amount is null or p_paid_by is null) then
    raise exception 'Paid needs the amount really paid and who paid it.' using errcode = 'P0001';
  end if;
  if p_actual_amount is not null and p_actual_amount < 0 then
    raise exception 'An amount can’t be negative.' using errcode = 'P0001';
  end if;

  v_actual_currency := coalesce(upper(nullif(trim(p_actual_currency), '')), v_currency);
  if v_actual_currency = v_currency then
    v_rate := 1;
  elsif p_actual_rate is null or p_actual_rate <= 0 then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := p_actual_rate;
  end if;

  update public.items
  set status          = p_status,
      actual_amount   = case when p_status = 'chosen' then null else p_actual_amount end,
      actual_currency = case when p_status = 'chosen' or p_actual_amount is null then null else v_actual_currency end,
      actual_rate     = case when p_status = 'chosen' or p_actual_amount is null then 1 else v_rate end,
      paid_by         = case when p_status = 'paid' then p_paid_by end,
      paid_on         = case when p_status = 'paid' then coalesce(p_paid_on, current_date) end
  where id = p_item_id;
end $$;

revoke all on function public.set_item_status(uuid, text, numeric, uuid, date, text, numeric) from public, anon;
grant execute on function public.set_item_status(uuid, text, numeric, uuid, date, text, numeric) to authenticated;

-- p_rate: what 1 unit of the current main currency is worth in the new one (1 EUR = 4 550 COP → 4550).
create function public.change_trip_currency(p_trip_id uuid, p_currency text, p_rate numeric)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_old text;
  v_new text := upper(trim(p_currency));
begin
  select currency into v_old from public.trips where id = p_trip_id;
  if v_old is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if v_new !~ '^[A-Z]{3}$' then
    raise exception 'A currency is a 3-letter code, like EUR.' using errcode = 'P0001';
  end if;
  if v_new = v_old then
    return;
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'Changing the currency needs the rate between the two.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.items where trip_id = p_trip_id and status = 'paid')
     or exists (select 1 from public.repayments where trip_id = p_trip_id) then
    raise exception 'The main currency is fixed since the first payment.' using errcode = 'P0001';
  end if;

  update public.options
  set rate = case when currency = v_new then 1 else rate * p_rate end
  where trip_id = p_trip_id;

  update public.items
  set actual_rate = case when actual_currency is null or actual_currency = v_new then 1 else actual_rate * p_rate end
  where trip_id = p_trip_id;

  update public.daily_estimates
  set rate = case when currency = v_new then 1 else rate * p_rate end
  where trip_id = p_trip_id;

  update public.trips
  set currency = v_new,
      target_amount = round(target_amount * p_rate, 2)
  where id = p_trip_id;
end $$;

revoke all on function public.change_trip_currency(uuid, text, numeric) from public, anon;
grant execute on function public.change_trip_currency(uuid, text, numeric) to authenticated;
