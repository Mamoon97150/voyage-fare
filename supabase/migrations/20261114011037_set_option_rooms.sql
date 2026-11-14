-- Build 4 (13 Nov): rooms from the app (SR-4). A stay's option is "one price" (split equally, a flat
-- for everyone) or "by room" (each room its price and who sleeps there, a hotel for 2 couples).
-- p_rooms: [{ "name": "Superior", "amount": 640, "occupants": ["<traveller id>", …] }, …];
-- an empty list or null = one price again. The option's price becomes the rooms added up.
create function public.set_option_rooms(p_option_id uuid, p_rooms jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_room uuid;
  r jsonb;
  i integer := 0;
  v_amount numeric;
  v_wanted integer;
  v_found integer;
begin
  select trip_id into v_trip from public.options where id = p_option_id;
  if v_trip is null then
    raise exception 'Option not found' using errcode = 'P0002';
  end if;

  delete from public.rooms where option_id = p_option_id;
  if p_rooms is null or jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) = 0 then
    return;
  end if;

  for r in select value from jsonb_array_elements(p_rooms) loop
    i := i + 1;
    v_amount := nullif(r ->> 'amount', '')::numeric;
    if v_amount is null or v_amount < 0 then
      raise exception 'Each room needs its price.' using errcode = 'P0001';
    end if;
    insert into public.rooms (trip_id, option_id, name, amount, position)
    values (v_trip, p_option_id, coalesce(nullif(trim(r ->> 'name'), ''), 'Room ' || i), v_amount, i)
    returning id into v_room;

    select count(*) into v_wanted from jsonb_array_elements_text(coalesce(r -> 'occupants', '[]'::jsonb));
    insert into public.room_occupants (room_id, traveller_id, trip_id)
    select v_room, t.id, v_trip
    from public.travellers t
    where t.trip_id = v_trip and t.id::text in (select jsonb_array_elements_text(coalesce(r -> 'occupants', '[]'::jsonb)));
    get diagnostics v_found = row_count;
    if v_found <> v_wanted then
      raise exception 'Someone in that room isn’t on this trip.' using errcode = 'P0001';
    end if;
  end loop;

  update public.options
  set amount = (select sum(amount) from public.rooms where option_id = p_option_id)
  where id = p_option_id;
end $$;

revoke all on function public.set_option_rooms(uuid, jsonb) from public, anon;
grant execute on function public.set_option_rooms(uuid, jsonb) to authenticated;
