-- The restaurant pool "To try" (mockup to-try-v5, 15 Nov): restaurants found on social media, kept
-- with a place but not a day, put on a day later. A pool restaurant is a restaurant line in a place
-- with no day; its price, if any, is an option not chosen yet, so it doesn't count in the budget.
alter table public.items
  add column link    text check (link is null or link ~* '^https?://'),
  add column meal    text check (meal is null or meal in ('breakfast', 'lunch', 'dinner')),
  add column verdict text check (verdict is null or verdict in ('loved', 'fine', 'skip'));

-- Add one to a place's pool: the name, where it was found, a note, and a price if known.
create function public.add_to_try(
  p_place_id uuid,
  p_name     text,
  p_link     text default null,
  p_note     text default null,
  p_amount   numeric default null
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

  select coalesce(max(position), 0) + 1 into v_position
  from public.items where trip_id = v_trip and place_id = p_place_id;

  insert into public.items (trip_id, place_id, kind, category, name, link, note, position)
  values (v_trip, p_place_id, 'restaurant', public.item_category('restaurant', p_place_id), trim(p_name),
          nullif(trim(p_link), ''), nullif(trim(p_note), ''), v_position)
  returning id into v_item;

  if p_amount is not null then
    insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen)
    values (v_trip, v_item, trim(p_name), p_amount, v_currency, 1, false);
  end if;
  return v_item;
end $$;

-- Put a pool restaurant on a day (and a meal), or back in the pool (day null). On a day its price
-- counts: a single option is chosen. Back in the pool it stops counting: nothing is chosen.
create function public.set_restaurant_day(p_item_id uuid, p_day integer, p_meal text default null)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_item public.items;
begin
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if v_item.status in ('booked', 'paid') then
    raise exception 'It’s booked: change its day in the line itself.' using errcode = 'P0001';
  end if;

  if p_day is null then
    update public.options set is_chosen = false where item_id = p_item_id and is_chosen;
    update public.items set day_number = null, end_day_number = null, meal = null, verdict = null,
                            status = case when status = 'dropped' then 'dropped' else 'idea' end
    where id = p_item_id;
  else
    update public.items set day_number = p_day, end_day_number = null, meal = p_meal where id = p_item_id;
    if (select count(*) from public.options where item_id = p_item_id) = 1 then
      update public.options set is_chosen = true where item_id = p_item_id;
    end if;
  end if;
end $$;

revoke all on function public.add_to_try(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.add_to_try(uuid, text, text, text, numeric) to authenticated;
revoke all on function public.set_restaurant_day(uuid, integer, text) from public, anon;
grant execute on function public.set_restaurant_day(uuid, integer, text) to authenticated;
