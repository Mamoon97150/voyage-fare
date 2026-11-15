-- Changing a pool restaurant (mockup to-try-v5, 15 Nov): its name, place, link, note and price in one
-- step. The price stays an option not chosen yet: it counts once the restaurant is on a day.
create function public.update_to_try(
  p_item_id  uuid,
  p_place_id uuid,
  p_name     text,
  p_link     text default null,
  p_note     text default null,
  p_amount   numeric default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_currency text;
begin
  select i.trip_id, t.currency into v_trip, v_currency
  from public.items i join public.trips t on t.id = i.trip_id
  where i.id = p_item_id and i.kind = 'restaurant' and i.day_number is null;
  if v_trip is null then
    raise exception 'Not in To try' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Give it a name.' using errcode = 'P0001';
  end if;

  update public.items
  set name = trim(p_name), place_id = p_place_id, link = nullif(trim(p_link), ''), note = nullif(trim(p_note), '')
  where id = p_item_id;

  if p_amount is null then
    delete from public.options where item_id = p_item_id;
  elsif exists (select 1 from public.options where item_id = p_item_id) then
    update public.options set amount = p_amount, name = trim(p_name) where item_id = p_item_id;
  else
    insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen)
    values (v_trip, p_item_id, trim(p_name), p_amount, v_currency, 1, false);
  end if;
end $$;

revoke all on function public.update_to_try(uuid, uuid, text, text, text, numeric) from public, anon;
grant execute on function public.update_to_try(uuid, uuid, text, text, text, numeric) to authenticated;
