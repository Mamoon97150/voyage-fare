-- Build 6 (14 Nov 2026): agency packages (mockup package-v4, option B).
-- A package is one line (kind and category "package") with its own price, paid like any line.
-- It lists what it covers: those lines point at it (items.package_id). A covered line has no price
-- of its own: it counts 0 in the budget, confirmed once the package is booked or paid.
-- No invented split of the package's price over its hotels and flights.

alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check check (kind in
  ('transport', 'housing', 'activity', 'restaurant', 'car_rental', 'insurance', 'package', 'other'));
alter table public.items drop constraint items_category_check;
alter table public.items add constraint items_category_check check (category in
  ('main_transport', 'local_transport', 'accommodation', 'activities', 'food', 'insurance', 'package', 'buffer'));

alter table public.items add column package_id uuid;
alter table public.items add constraint items_package_fk
  foreign key (package_id, trip_id) references public.items (id, trip_id) on delete set null (package_id);
alter table public.items add constraint items_package_not_self check (package_id is null or package_id <> id);
create index on public.items (package_id);

-- The category follows the kind, in one place (add_item had its own copy).
create or replace function public.item_category(p_kind text, p_place_id uuid) returns text
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'transport'  then case when p_place_id is null then 'main_transport' else 'local_transport' end
    when 'housing'    then 'accommodation'
    when 'activity'   then 'activities'
    when 'restaurant' then 'food'
    when 'car_rental' then 'local_transport'
    when 'insurance'  then 'insurance'
    when 'package'    then 'package'
    else 'buffer'
  end
$$;

create or replace function public.add_item(
  p_trip_id        uuid,
  p_kind           text,
  p_name           text,
  p_place_id       uuid default null,
  p_day_number     integer default null,
  p_end_day_number integer default null,
  p_amount         numeric default null,
  p_note           text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_item uuid;
  v_currency text;
  v_position integer;
begin
  select currency into v_currency from public.trips where id = p_trip_id;
  if v_currency is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if p_kind = 'package' and p_place_id is not null then
    raise exception 'A package belongs to the whole trip.' using errcode = 'P0001';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.items
  where trip_id = p_trip_id and place_id is not distinct from p_place_id;

  insert into public.items (trip_id, place_id, kind, category, name, day_number, end_day_number, note, position)
  values (p_trip_id, p_place_id, p_kind, public.item_category(p_kind, p_place_id), trim(p_name),
          p_day_number, p_end_day_number, nullif(trim(p_note), ''), v_position)
  returning id into v_item;

  if p_amount is not null then
    insert into public.options (trip_id, item_id, name, amount, currency, rate, is_chosen)
    values (p_trip_id, v_item, trim(p_name), p_amount, v_currency, 1, true);
  end if;

  return v_item;
end $$;

-- A covered line counts 0, confirmed when its package is booked or paid (same columns as before).
create or replace view public.v_item_amounts with (security_invoker = true) as
select
  i.id       as item_id,
  i.trip_id,
  i.place_id,
  i.category,
  i.status,
  o.id       as chosen_option_id,
  case when p.id is not null then 0 else amounts.planned end as planned,
  case when p.id is not null then null else amounts.actual end as actual,
  case when p.id is not null then 0 else coalesce(amounts.actual, amounts.planned) end as current,   -- BR-2
  case when p.id is not null then p.status in ('booked', 'paid')
       else (i.status in ('booked', 'paid') and i.actual_amount is not null) end as is_confirmed    -- BR-3
from public.items i
left join public.items p on p.id = i.package_id
left join public.options o on o.item_id = i.id and o.is_chosen   -- BR-1
left join lateral (
  select count(*) as room_count, sum(r.amount) as rooms_amount
  from public.rooms r where r.option_id = o.id
) rooms on true
cross join lateral (
  select
    round(case when rooms.room_count > 0 then rooms.rooms_amount else o.amount end * o.rate, 2) as planned,
    round(i.actual_amount * i.actual_rate, 2) as actual           -- BR-10
) amounts;

-- What a package covers, in one step: these lines, and no others.
create function public.set_package_cover(p_package_id uuid, p_items uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_kind text;
  v_bad integer;
begin
  select trip_id, kind into v_trip, v_kind from public.items where id = p_package_id;
  if v_trip is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if v_kind <> 'package' then
    raise exception 'Only a package covers other lines.' using errcode = 'P0001';
  end if;
  select count(*) into v_bad
  from unnest(coalesce(p_items, '{}')) x
  where not exists (select 1 from public.items i where i.id = x and i.trip_id = v_trip and i.kind <> 'package');
  if v_bad > 0 then
    raise exception 'A package covers lines of its own trip, not another package.' using errcode = 'P0001';
  end if;

  update public.items set package_id = null
  where package_id = p_package_id and not (id = any (coalesce(p_items, '{}')));
  update public.items set package_id = p_package_id
  where trip_id = v_trip and id = any (coalesce(p_items, '{}'));
end $$;

-- One line in or out of a package (from the line itself: "Part of a package").
create function public.set_item_package(p_item_id uuid, p_package_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_kind text;
begin
  select trip_id, kind into v_trip, v_kind from public.items where id = p_item_id;
  if v_trip is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if v_kind = 'package' and p_package_id is not null then
    raise exception 'A package can’t be in another package.' using errcode = 'P0001';
  end if;
  if p_package_id is not null and not exists (
    select 1 from public.items where id = p_package_id and trip_id = v_trip and kind = 'package'
  ) then
    raise exception 'That package isn’t on this trip.' using errcode = 'P0001';
  end if;
  update public.items set package_id = p_package_id where id = p_item_id;
end $$;

revoke all on function public.set_package_cover(uuid, uuid[]) from public, anon;
revoke all on function public.set_item_package(uuid, uuid) from public, anon;
grant execute on function public.set_package_cover(uuid, uuid[]) to authenticated;
grant execute on function public.set_item_package(uuid, uuid) to authenticated;
