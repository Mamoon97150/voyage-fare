-- Import from my AI (build 8 step 2, mockup import-ai-v5, 15 Nov 2026).
-- The app reads the AI's answer, shows a preview, and sends only what's new: new places, lines
-- with their options, tickets. Written here in one go (all or nothing), with the same rules as
-- adding by hand. Nothing arrives booked: one option is chosen (estimated), several wait for a
-- choice, a restaurant with no day goes to To try (not counted).

-- One line: the item, then its options in order.
create function private.import_item(p_trip_id uuid, p_place_id uuid, p_line jsonb, p_currency text)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_item uuid;
  v_kind text := coalesce(nullif(p_line->>'kind', ''), 'other');
  v_day integer := nullif(p_line->>'day', '')::integer;
  v_to_try boolean;
  v_options integer := jsonb_array_length(coalesce(p_line->'options', '[]'::jsonb));
  v_option jsonb;
  v_position integer;
  v_option_position integer := 0;
begin
  if v_kind not in ('transport', 'housing', 'activity', 'restaurant', 'car_rental', 'insurance', 'other') then
    raise exception 'Unknown kind: %', v_kind using errcode = '22023';
  end if;
  if nullif(trim(p_line->>'name'), '') is null then
    raise exception 'A line needs a name' using errcode = '22023';
  end if;
  v_to_try := v_kind = 'restaurant' and p_place_id is not null and v_day is null;

  select coalesce(max(position), 0) + 1 into v_position
  from public.items where trip_id = p_trip_id and place_id is not distinct from p_place_id;

  insert into public.items (trip_id, place_id, kind, category, name, day_number, end_day_number, note, link, position)
  values (p_trip_id, p_place_id, v_kind, public.item_category(v_kind, p_place_id), trim(p_line->>'name'),
          v_day, nullif(p_line->>'end_day', '')::integer,
          nullif(trim(p_line->>'note'), ''), nullif(trim(p_line->>'link'), ''), v_position)
  returning id into v_item;

  for v_option in select * from jsonb_array_elements(coalesce(p_line->'options', '[]'::jsonb)) loop
    v_option_position := v_option_position + 1;
    insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen, link, note, position)
    values (
      p_trip_id, v_item,
      coalesce(nullif(trim(v_option->>'name'), ''), trim(p_line->>'name')),
      nullif(v_option->>'amount', '')::numeric,
      coalesce(nullif(v_option->>'currency', ''), p_currency),
      coalesce(nullif(v_option->>'rate', '')::numeric, 1),
      -- A single option counts (chosen, still estimated); several wait for a choice; To try never counts.
      v_options = 1 and not v_to_try,
      nullif(trim(v_option->>'link'), ''),
      nullif(trim(v_option->>'note'), ''),
      v_option_position
    );
  end loop;
  return v_item;
end $$;

-- p_payload = {
--   places:  [{ id: existing place or null, name, nights, lines: [line] }],
--   tickets: [{ from, to, mode, day, after_place: existing place id | null,
--               after_new: index in places (0-based) | null, name, options: [option] }]
-- }
-- line = { kind, name, day, end_day, note, link, options: [{ name, amount, currency, rate, link, note }] }
create function public.import_lines(p_trip_id uuid, p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_currency text;
  v_place jsonb;
  v_line jsonb;
  v_ticket jsonb;
  v_place_id uuid;
  v_item uuid;
  v_after uuid;
  v_ids uuid[] := '{}';
  v_place_position integer;
  v_leg_position integer;
  v_places integer := 0;
  v_lines integer := 0;
begin
  select currency into v_currency from public.trips where id = p_trip_id;
  if v_currency is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;

  select coalesce(max(position), 0) into v_place_position from public.places where trip_id = p_trip_id;

  for v_place in select * from jsonb_array_elements(coalesce(p_payload->'places', '[]'::jsonb)) loop
    v_place_id := nullif(v_place->>'id', '')::uuid;
    if v_place_id is null then
      if nullif(trim(v_place->>'name'), '') is null then
        raise exception 'A place needs a name' using errcode = '22023';
      end if;
      -- A new place goes at the end of the route.
      v_place_position := v_place_position + 1;
      insert into public.places (trip_id, name, nights, position)
      values (p_trip_id, trim(v_place->>'name'), greatest(coalesce(nullif(v_place->>'nights', '')::integer, 0), 0),
              v_place_position)
      returning id into v_place_id;
      v_places := v_places + 1;
    elsif not exists (select 1 from public.places where id = v_place_id and trip_id = p_trip_id) then
      raise exception 'This place isn’t in the trip' using errcode = 'P0002';
    end if;
    v_ids := v_ids || v_place_id;

    for v_line in select * from jsonb_array_elements(coalesce(v_place->'lines', '[]'::jsonb)) loop
      perform private.import_item(p_trip_id, v_place_id, v_line, v_currency);
      v_lines := v_lines + 1;
    end loop;
  end loop;

  for v_ticket in select * from jsonb_array_elements(coalesce(p_payload->'tickets', '[]'::jsonb)) loop
    if nullif(trim(v_ticket->>'from'), '') is null or nullif(trim(v_ticket->>'to'), '') is null then
      raise exception 'A ticket goes from somewhere to somewhere' using errcode = '22023';
    end if;
    v_after := coalesce(
      nullif(v_ticket->>'after_place', '')::uuid,
      v_ids[nullif(v_ticket->>'after_new', '')::integer + 1]
    );
    if v_after is not null and not exists (select 1 from public.places where id = v_after and trip_id = p_trip_id) then
      raise exception 'This place isn’t in the trip' using errcode = 'P0002';
    end if;
    v_item := private.import_item(
      p_trip_id, null,
      jsonb_build_object(
        'kind', 'transport',
        'name', coalesce(nullif(trim(v_ticket->>'name'), ''), trim(v_ticket->>'from') || ' → ' || trim(v_ticket->>'to')),
        'note', v_ticket->>'note',
        'options', coalesce(v_ticket->'options', '[]'::jsonb)
      ),
      v_currency
    );
    select coalesce(max(position), -1) + 1 into v_leg_position
    from public.item_legs where trip_id = p_trip_id and after_place_id is not distinct from v_after;
    insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, after_place_id, day_number, position)
    values (p_trip_id, v_item, 1,
            case when v_ticket->>'mode' in ('plane', 'train', 'bus', 'car', 'boat') then v_ticket->>'mode' else 'other' end,
            trim(v_ticket->>'from'), trim(v_ticket->>'to'), v_after,
            nullif(v_ticket->>'day', '')::integer, v_leg_position);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object('places', v_places, 'lines', v_lines);
end $$;

revoke all on function private.import_item(uuid, uuid, jsonb, text) from public, anon;
grant execute on function private.import_item(uuid, uuid, jsonb, text) to authenticated;
revoke all on function public.import_lines(uuid, jsonb) from public, anon;
grant execute on function public.import_lines(uuid, jsonb) to authenticated;
