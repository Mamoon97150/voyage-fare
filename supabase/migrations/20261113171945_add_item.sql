-- Add an item in one step (build 2). With a price, the item gets one option, chosen:
-- it's decided and counts in the budget as an estimate (BR-1, BR-3, BR-8).
-- Without a price, it's an idea: nothing counts until a price is chosen.
-- Comparing several options comes in build 3; this is the single-option case.
create function public.add_item(
  p_trip_id        uuid,
  p_kind           text,
  p_name           text,
  p_place_id       uuid default null,
  p_day_number     integer default null,
  p_end_day_number integer default null,
  p_amount         numeric default null,
  p_note           text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_item uuid;
  v_currency text;
  v_category text;
  v_position integer;
begin
  select currency into v_currency from public.trips where id = p_trip_id;
  if v_currency is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;

  -- The budget category follows the kind; a ticket on the whole trip is main transport,
  -- one inside a place (a train, a ferry) is local transport.
  v_category := case p_kind
    when 'transport'  then case when p_place_id is null then 'main_transport' else 'local_transport' end
    when 'housing'    then 'accommodation'
    when 'activity'   then 'activities'
    when 'restaurant' then 'food'
    when 'car_rental' then 'local_transport'
    when 'insurance'  then 'insurance'
    else 'buffer'
  end;

  select coalesce(max(position), 0) + 1 into v_position
  from public.items
  where trip_id = p_trip_id and place_id is not distinct from p_place_id;

  insert into public.items (trip_id, place_id, kind, category, name, day_number, end_day_number, note, position)
  values (p_trip_id, p_place_id, p_kind, v_category, trim(p_name), p_day_number, p_end_day_number,
          nullif(trim(p_note), ''), v_position)
  returning id into v_item;

  if p_amount is not null then
    insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen)
    values (p_trip_id, v_item, trim(p_name), p_amount, v_currency, 1, true);
  end if;

  return v_item;
end $$;

revoke all on function public.add_item(uuid, text, text, uuid, integer, integer, numeric, text) from public, anon;
grant execute on function public.add_item(uuid, text, text, uuid, integer, integer, numeric, text) to authenticated;
