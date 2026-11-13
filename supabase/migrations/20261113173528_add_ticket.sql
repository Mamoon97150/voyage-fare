-- Add a ticket in one step (build 2): one transport item, one price, 1 or 2 legs.
-- A round trip is one ticket counted once; its legs only say where it goes and
-- where each sits in the route (after_place_id null = before the first place).
-- Tickets between places are main transport (flights, long trains), on the whole trip.
create function public.add_ticket(
  p_trip_id         uuid,
  p_from            text,
  p_to              text,
  p_mode            text default 'plane',
  p_name            text default null,
  p_via             text default null,
  p_after_place_id  uuid default null,
  p_round_trip      boolean default false,
  p_return_after_place_id uuid default null,
  p_amount          numeric default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_item uuid;
  v_name text;
begin
  if nullif(trim(p_from), '') is null or nullif(trim(p_to), '') is null then
    raise exception 'A ticket goes from somewhere to somewhere' using errcode = '22023';
  end if;

  v_name := coalesce(
    nullif(trim(p_name), ''),
    trim(p_from) || case when p_round_trip then ' ⇄ ' else ' → ' end || trim(p_to)
  );

  -- Same rules as any item: price, chosen option, budget category.
  v_item := public.add_item(p_trip_id => p_trip_id, p_kind => 'transport', p_name => v_name, p_amount => p_amount);

  insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, via, after_place_id, position)
  values (p_trip_id, v_item, 1, coalesce(p_mode, 'plane'), trim(p_from), trim(p_to),
          nullif(trim(p_via), ''), p_after_place_id, 0);

  if p_round_trip then
    insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, via, after_place_id, position)
    values (p_trip_id, v_item, 2, coalesce(p_mode, 'plane'), trim(p_to), trim(p_from),
            nullif(trim(p_via), ''), p_return_after_place_id, 1);
  end if;

  return v_item;
end $$;

revoke all on function public.add_ticket(uuid, text, text, text, text, text, uuid, boolean, uuid, numeric) from public, anon;
grant execute on function public.add_ticket(uuid, text, text, text, text, text, uuid, boolean, uuid, numeric) to authenticated;
