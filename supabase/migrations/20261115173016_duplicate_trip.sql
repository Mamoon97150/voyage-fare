-- Start a new trip from this one (build 8 step 3, mockup duplicate-v5, 15 Nov 2026).
-- Comes along: places, nights, the route, lines and their days, prices, notes, links, To try,
-- daily estimates, rooms, who each line is for. Starts fresh: dates, bookings and payments (all
-- back to estimated), who paid, verdicts, invitations. Dropped lines stay behind. The original
-- trip doesn't change. All in one go.
create function public.duplicate_trip(
  p_trip_id     uuid,
  p_name        text,
  p_travellers  uuid[] default '{}',   -- the others who come (you always do)
  p_all_options boolean default true   -- false: only what was chosen
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_source public.trips;
  v_new uuid;
  v_me_old uuid;
  v_me_name text;
  v_id uuid;
  v_position integer := 1;
  r record;
  v_travellers jsonb := '{}';
  v_places jsonb := '{}';
  v_items jsonb := '{}';
  v_options jsonb := '{}';
  v_rooms jsonb := '{}';
  v_estimates jsonb := '{}';
begin
  if auth.uid() is null then
    raise exception 'Sign in to start a trip' using errcode = '42501';
  end if;
  select * into v_source from public.trips where id = p_trip_id;
  if v_source.id is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Give the new trip a name.' using errcode = 'P0001';
  end if;

  insert into public.trips (name, currency, target_amount, target_scope, home_city, home_latitude, home_longitude)
  values (trim(p_name), v_source.currency, v_source.target_amount, v_source.target_scope,
          v_source.home_city, v_source.home_latitude, v_source.home_longitude)
  returning id into v_new;

  -- You, then the others who come, in their order.
  select id, name into v_me_old, v_me_name
  from public.travellers where trip_id = p_trip_id and user_id = auth.uid();
  insert into public.travellers (trip_id, name, user_id, position)
  values (v_new, coalesce(v_me_name, 'Me'), auth.uid(), 0)
  returning id into v_id;
  if v_me_old is not null then
    v_travellers := v_travellers || jsonb_build_object(v_me_old, v_id);
  end if;
  for r in
    select id, name from public.travellers
    where trip_id = p_trip_id and id = any(coalesce(p_travellers, '{}')) and id is distinct from v_me_old
    order by position
  loop
    insert into public.travellers (trip_id, name, position) values (v_new, r.name, v_position) returning id into v_id;
    v_travellers := v_travellers || jsonb_build_object(r.id, v_id);
    v_position := v_position + 1;
  end loop;

  for r in select * from public.places where trip_id = p_trip_id order by position loop
    insert into public.places (trip_id, name, country, latitude, longitude, nights, position)
    values (v_new, r.name, r.country, r.latitude, r.longitude, r.nights, r.position)
    returning id into v_id;
    v_places := v_places || jsonb_build_object(r.id, v_id);
  end loop;

  for r in select * from public.items where trip_id = p_trip_id and status <> 'dropped' order by position loop
    insert into public.items (trip_id, place_id, kind, category, name, day_number, end_day_number, note,
                              location_name, latitude, longitude, position, link, meal)
    values (v_new, (v_places->>r.place_id::text)::uuid, r.kind, r.category, r.name, r.day_number,
            r.end_day_number, r.note, r.location_name, r.latitude, r.longitude, r.position, r.link, r.meal)
    returning id into v_id;
    v_items := v_items || jsonb_build_object(r.id, v_id);
  end loop;

  -- A package's lines still point to their package.
  update public.items n set package_id = (v_items->>o.package_id::text)::uuid
  from public.items o
  where o.trip_id = p_trip_id and o.package_id is not null and n.id = (v_items->>o.id::text)::uuid
    and v_items ? o.package_id::text;

  -- Options: all of them, or only the chosen one (a line with nothing chosen keeps its options).
  for r in
    select o.* from public.options o
    where o.trip_id = p_trip_id and v_items ? o.item_id::text
      and (p_all_options or o.is_chosen
           or not exists (select 1 from public.options c where c.item_id = o.item_id and c.is_chosen))
    order by o.item_id, o.position
  loop
    insert into public.options (trip_id, item_id, name, amount, currency, rate, rate_is_manual, is_chosen,
                                is_favourite, details, link, note, location_name, latitude, longitude, position)
    values (v_new, (v_items->>r.item_id::text)::uuid, r.name, r.amount, r.currency, r.rate, r.rate_is_manual,
            r.is_chosen, r.is_favourite, r.details, r.link, r.note, r.location_name, r.latitude, r.longitude, r.position)
    returning id into v_id;
    v_options := v_options || jsonb_build_object(r.id, v_id);
  end loop;

  for r in select * from public.rooms where trip_id = p_trip_id and v_options ? option_id::text order by position loop
    insert into public.rooms (trip_id, option_id, name, amount, position)
    values (v_new, (v_options->>r.option_id::text)::uuid, r.name, r.amount, r.position)
    returning id into v_id;
    v_rooms := v_rooms || jsonb_build_object(r.id, v_id);
  end loop;
  insert into public.room_occupants (trip_id, room_id, traveller_id)
  select v_new, (v_rooms->>o.room_id::text)::uuid, (v_travellers->>o.traveller_id::text)::uuid
  from public.room_occupants o
  where o.trip_id = p_trip_id and v_rooms ? o.room_id::text and v_travellers ? o.traveller_id::text;

  insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, via, day_number,
                                after_place_id, position)
  select v_new, (v_items->>l.item_id::text)::uuid, l.leg_number, l.mode, l.from_name, l.to_name, l.via,
         l.day_number, (v_places->>l.after_place_id::text)::uuid, l.position
  from public.item_legs l
  where l.trip_id = p_trip_id and v_items ? l.item_id::text;

  -- Who each line is for, and who's in each day, among those who come.
  insert into public.item_split_travellers (trip_id, item_id, traveller_id)
  select v_new, (v_items->>s.item_id::text)::uuid, (v_travellers->>s.traveller_id::text)::uuid
  from public.item_split_travellers s
  where s.trip_id = p_trip_id and v_items ? s.item_id::text and v_travellers ? s.traveller_id::text;
  insert into public.day_split_travellers (trip_id, day_number, traveller_id)
  select v_new, d.day_number, (v_travellers->>d.traveller_id::text)::uuid
  from public.day_split_travellers d
  where d.trip_id = p_trip_id and v_travellers ? d.traveller_id::text;

  for r in select * from public.daily_estimates where trip_id = p_trip_id loop
    insert into public.daily_estimates (trip_id, place_id, category, label, amount, currency, rate, days)
    values (v_new, (v_places->>r.place_id::text)::uuid, r.category, r.label, r.amount, r.currency, r.rate, r.days)
    returning id into v_id;
    v_estimates := v_estimates || jsonb_build_object(r.id, v_id);
  end loop;
  insert into public.daily_estimate_travellers (trip_id, daily_estimate_id, traveller_id)
  select v_new, (v_estimates->>e.daily_estimate_id::text)::uuid, (v_travellers->>e.traveller_id::text)::uuid
  from public.daily_estimate_travellers e
  where e.trip_id = p_trip_id and v_estimates ? e.daily_estimate_id::text and v_travellers ? e.traveller_id::text;

  return v_new;
end $$;

revoke all on function public.duplicate_trip(uuid, text, uuid[], boolean) from public, anon;
grant execute on function public.duplicate_trip(uuid, text, uuid[], boolean) to authenticated;
