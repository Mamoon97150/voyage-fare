-- Build 4 (13 Nov): "split between…" from the app (SR-3). Who shares a line, in one step:
-- everyone (no rows, the default), or some of them (a gift: everyone but Peggy; just me: the jet-ski).
create function public.set_item_split(p_item_id uuid, p_travellers uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_all integer;
  v_picked integer;
begin
  select trip_id into v_trip from public.items where id = p_item_id;
  if v_trip is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  select count(*) into v_all from public.travellers where trip_id = v_trip;
  select count(distinct t.id) into v_picked
  from public.travellers t where t.trip_id = v_trip and t.id = any (coalesce(p_travellers, '{}'));

  if coalesce(array_length(p_travellers, 1), 0) > 0 and v_picked <> (select count(distinct x) from unnest(p_travellers) x) then
    raise exception 'Someone on that list isn’t on this trip.' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_travellers, 1), 0) > 0 and v_picked = 0 then
    raise exception 'A line is for at least one person.' using errcode = 'P0001';
  end if;

  delete from public.item_split_travellers where item_id = p_item_id;
  -- Everyone picked = the default: no rows, so a traveller added later is on it too.
  if v_picked > 0 and v_picked < v_all then
    insert into public.item_split_travellers (item_id, traveller_id, trip_id)
    select p_item_id, t.id, v_trip from public.travellers t where t.trip_id = v_trip and t.id = any (p_travellers);
  end if;
end $$;

revoke all on function public.set_item_split(uuid, uuid[]) from public, anon;
grant execute on function public.set_item_split(uuid, uuid[]) to authenticated;
