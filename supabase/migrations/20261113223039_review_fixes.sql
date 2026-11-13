-- Review of build 3 (13 Nov), the database side.
-- 1. A price typed on the trip page is in the main currency: when it lands in an option that was
--    in dollars or pesos, the option switches to the main currency (else 169 € became 169 COP).
-- 2. Tickets keep their options' prices too (p_keep_price, like update_item).
-- 3. Dropped: a line you decided against stays for the record, out of the budget and the
--    "to decide" dots. Nothing is chosen; choosing an option again brings it back.

create or replace function private.set_item_price(p_item_id uuid, p_amount numeric) returns void
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
      update public.options set amount = p_amount, currency = v_currency, rate = 1 where id = v_chosen;
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

drop function public.update_ticket(uuid, text, text, text, text, uuid, boolean, uuid, numeric);

create function public.update_ticket(
  p_item_id        uuid,
  p_from           text,
  p_to             text,
  p_mode           text default 'plane',
  p_via            text default null,
  p_after_place_id uuid default null,
  p_round_trip     boolean default false,
  p_return_after_place_id uuid default null,
  p_amount         numeric default null,
  p_keep_price     boolean default false
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

  if not p_keep_price then
    perform private.set_item_price(p_item_id, p_amount);
  end if;
end $$;

revoke all on function public.update_ticket(uuid, text, text, text, text, uuid, boolean, uuid, numeric, boolean) from public, anon;
grant execute on function public.update_ticket(uuid, text, text, text, text, uuid, boolean, uuid, numeric, boolean) to authenticated;

-- ── Dropped ──────────────────────────────────────────────────────────────────
alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check
  check (status in ('idea', 'chosen', 'booked', 'paid', 'dropped'));

-- The status rule (BR-8) learns one thing: choosing an option on a dropped line brings it back.
create or replace function public.items_sync_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('idea', 'chosen', 'dropped') then
    if exists (select 1 from public.options o where o.item_id = new.id and o.is_chosen) then
      new.status := 'chosen';
    elsif new.status <> 'dropped' then
      new.status := 'idea';
    end if;
  end if;
  return new;
end $$;

create function public.set_item_dropped(p_item_id uuid, p_dropped boolean) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status from public.items where id = p_item_id;
  if v_status is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  if p_dropped then
    if v_status in ('booked', 'paid') then
      raise exception 'It’s booked: set it back to Chosen first.' using errcode = 'P0001';
    end if;
    -- Unchoose first (the status rule would bring it back), then drop.
    update public.options set is_chosen = false where item_id = p_item_id and is_chosen;
    update public.items set status = 'dropped' where id = p_item_id;
  elsif v_status = 'dropped' then
    update public.items set status = 'idea' where id = p_item_id;
    -- One option only: it's the one (the first option is chosen, 13 Nov).
    select count(*) into v_count from public.options where item_id = p_item_id;
    if v_count = 1 then
      update public.options set is_chosen = true where item_id = p_item_id;
    end if;
  end if;
end $$;

revoke all on function public.set_item_dropped(uuid, boolean) from public, anon;
grant execute on function public.set_item_dropped(uuid, boolean) to authenticated;
