-- Forms by kind (build 8¾, mockup kinds-v6, 16 Nov 2026). Each kind asks its own questions:
-- an activity its time, how long and whether it needs booking; a restaurant its meal, the kind of
-- food and whether it needs a reservation; a car rental where it's picked up and dropped off, the
-- insurance and the deposit (held and given back: never in the budget); getting around from → to
-- and how. A price can be typed per person: the line keeps the total (the budget doesn't change)
-- and remembers it was per person, to show it that way again.
-- The details are plain columns: members already write their trip's lines (RLS).
alter table public.items
  add column start_time         time,
  add column price_per_person   boolean not null default false,
  add column needs_booking      boolean,
  add column duration           text check (duration is null or length(duration) <= 40),
  add column food_kind          text check (food_kind is null or length(food_kind) <= 60),
  add column from_place         text check (from_place is null or length(from_place) <= 80),
  add column to_place           text check (to_place is null or length(to_place) <= 80),
  add column local_mode         text check (local_mode is null or local_mode in
                                  ('taxi', 'bus', 'ferry', 'train', 'metro', 'walk', 'other')),
  add column insurance_included boolean,
  add column deposit            numeric(14,2) check (deposit is null or deposit >= 0);

-- To try holds activities too now (kinds-v6): the same pool, a kind to say which.
drop function public.add_to_try(uuid, text, text, text, numeric);
create function public.add_to_try(
  p_place_id uuid,
  p_name     text,
  p_link     text default null,
  p_note     text default null,
  p_amount   numeric default null,
  p_kind     text default 'restaurant'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_currency text;
  v_item uuid;
  v_position integer;
begin
  select p.trip_id, t.currency into v_trip, v_currency
  from public.places p join public.trips t on t.id = p.trip_id
  where p.id = p_place_id;
  if v_trip is null then
    raise exception 'Place not found' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Give it a name.' using errcode = 'P0001';
  end if;
  if p_kind not in ('restaurant', 'activity') then
    raise exception 'To try is for restaurants and activities.' using errcode = 'P0001';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.items where trip_id = v_trip and place_id = p_place_id;

  insert into public.items (trip_id, place_id, kind, category, name, link, note, position)
  values (v_trip, p_place_id, p_kind, public.item_category(p_kind, p_place_id), trim(p_name),
          nullif(trim(p_link), ''), nullif(trim(p_note), ''), v_position)
  returning id into v_item;

  if p_amount is not null then
    insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen)
    values (v_trip, v_item, trim(p_name), p_amount, v_currency, 1, false);
  end if;
  return v_item;
end $$;

revoke all on function public.add_to_try(uuid, text, text, text, numeric, text) from public, anon;
grant execute on function public.add_to_try(uuid, text, text, text, numeric, text) to authenticated;

-- A duplicated trip keeps the details too.
create or replace function public.duplicate_trip(
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
                              location_name, latitude, longitude, position, link, meal,
                              start_time, price_per_person, needs_booking, duration, food_kind,
                              from_place, to_place, local_mode, insurance_included, deposit)
    values (v_new, (v_places->>r.place_id::text)::uuid, r.kind, r.category, r.name, r.day_number,
            r.end_day_number, r.note, r.location_name, r.latitude, r.longitude, r.position, r.link, r.meal,
            r.start_time, r.price_per_person, r.needs_booking, r.duration, r.food_kind,
            r.from_place, r.to_place, r.local_mode, r.insurance_included, r.deposit)
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

