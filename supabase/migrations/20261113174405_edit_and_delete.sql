-- Change or remove what was added (build 2). Each change is one step: all or nothing.
-- All run with the caller's rights, so only members of the trip can change it.

-- The budget category of an item, from its kind and where it is (same rule as add_item).
create function public.item_category(p_kind text, p_place_id uuid) returns text
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'transport'  then case when p_place_id is null then 'main_transport' else 'local_transport' end
    when 'housing'    then 'accommodation'
    when 'activity'   then 'activities'
    when 'restaurant' then 'food'
    when 'car_rental' then 'local_transport'
    when 'insurance'  then 'insurance'
    else 'buffer'
  end
$$;

-- The single price of an item (build 2: one option). A price sets or creates the chosen option;
-- no price removes a lone option, so the item goes back to being an idea (BR-8).
create function private.set_item_price(p_item_id uuid, p_amount numeric) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_name text;
  v_currency text;
  v_chosen uuid;
  v_count integer;
begin
  select i.trip_id, i.name, t.currency into v_trip, v_name, v_currency
  from public.items i join public.trips t on t.id = i.trip_id where i.id = p_item_id;

  select id into v_chosen from public.options where item_id = p_item_id and is_chosen;
  select count(*) into v_count from public.options where item_id = p_item_id;

  if p_amount is not null then
    if v_chosen is not null then
      update public.options set amount = p_amount where id = v_chosen;
    else
      insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen)
      values (v_trip, p_item_id, v_name, p_amount, v_currency, 1, true);
    end if;
  elsif v_chosen is not null and v_count = 1 then
    delete from public.options where id = v_chosen;
  elsif v_chosen is not null then
    update public.options set amount = null where id = v_chosen;
  end if;
end $$;

grant execute on function private.set_item_price(uuid, numeric) to authenticated;

create function public.update_item(
  p_item_id        uuid,
  p_kind           text,
  p_name           text,
  p_day_number     integer default null,
  p_end_day_number integer default null,
  p_amount         numeric default null
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.items
  set kind = p_kind,
      category = public.item_category(p_kind, place_id),
      name = trim(p_name),
      day_number = p_day_number,
      end_day_number = p_end_day_number
  where id = p_item_id;
  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  perform private.set_item_price(p_item_id, p_amount);
end $$;

-- A ticket's route and price. Its legs are redrawn; its name follows the route.
create function public.update_ticket(
  p_item_id        uuid,
  p_from           text,
  p_to             text,
  p_mode           text default 'plane',
  p_via            text default null,
  p_after_place_id uuid default null,
  p_round_trip     boolean default false,
  p_return_after_place_id uuid default null,
  p_amount         numeric default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
begin
  if nullif(trim(p_from), '') is null or nullif(trim(p_to), '') is null then
    raise exception 'A ticket goes from somewhere to somewhere' using errcode = '22023';
  end if;

  update public.items
  set name = trim(p_from) || case when p_round_trip then ' ⇄ ' else ' → ' end || trim(p_to)
  where id = p_item_id and kind = 'transport'
  returning trip_id into v_trip;
  if v_trip is null then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  delete from public.item_legs where item_id = p_item_id;
  insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, via, after_place_id, position)
  values (v_trip, p_item_id, 1, coalesce(p_mode, 'plane'), trim(p_from), trim(p_to), nullif(trim(p_via), ''), p_after_place_id, 0);
  if p_round_trip then
    insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, via, after_place_id, position)
    values (v_trip, p_item_id, 2, coalesce(p_mode, 'plane'), trim(p_to), trim(p_from), nullif(trim(p_via), ''), p_return_after_place_id, 1);
  end if;

  perform private.set_item_price(p_item_id, p_amount);
end $$;

-- Remove a place with what's in it. Tickets placed after it move up to the previous place
-- (or the start), so the route stays whole instead of losing a flight.
create function public.delete_place(p_place_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_position integer;
  v_previous uuid;
begin
  select trip_id, position into v_trip, v_position from public.places where id = p_place_id;
  if v_trip is null then
    raise exception 'Place not found' using errcode = 'P0002';
  end if;

  select id into v_previous from public.places
  where trip_id = v_trip and id <> p_place_id and position < v_position
  order by position desc limit 1;

  update public.item_legs set after_place_id = v_previous where after_place_id = p_place_id;
  delete from public.items where place_id = p_place_id;
  delete from public.places where id = p_place_id;
end $$;

revoke all on function public.update_item(uuid, text, text, integer, integer, numeric) from public, anon;
revoke all on function public.update_ticket(uuid, text, text, text, text, uuid, boolean, uuid, numeric) from public, anon;
revoke all on function public.delete_place(uuid) from public, anon;
grant execute on function public.update_item(uuid, text, text, integer, integer, numeric) to authenticated;
grant execute on function public.update_ticket(uuid, text, text, text, text, uuid, boolean, uuid, numeric) to authenticated;
grant execute on function public.delete_place(uuid) to authenticated;
