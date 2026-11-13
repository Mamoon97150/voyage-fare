-- Voyage Fare — what build 2's screens need from the database.
--   1. Where the trip starts from (the route map draws the line from there).
--   2. The legs of a ticket: one item, one price, 1 or 2 legs shown at their place in the route.
--   3. Each traveller's own share by category and by place (the Budget screen shows "your share").

-- ── 1. Home city ──────────────────────────────────────────────────────────────
alter table public.trips
  add column home_city      text check (home_city is null or length(trim(home_city)) > 0),
  add column home_latitude  double precision,
  add column home_longitude double precision;

-- ── 2. Ticket legs ────────────────────────────────────────────────────────────
-- A ticket is one transport item with one price. Its legs only say where it goes:
-- a round trip has 2 legs and is counted once (the outbound leg carries the price,
-- the return leg shows "included"). Cities are free text: a change of plane in
-- Paris does not have to be a place of the trip.
-- after_place_id says where the leg sits in the route: null = before the first place.
create table public.item_legs (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null,
  item_id        uuid not null,
  leg_number     integer not null check (leg_number in (1, 2)),
  mode           text not null default 'plane' check (mode in
                   ('plane', 'train', 'bus', 'car', 'boat', 'other')),
  from_name      text not null check (length(trim(from_name)) > 0),
  to_name        text not null check (length(trim(to_name)) > 0),
  via            text,                                 -- "via Paris", a change of plane
  travel_date    date,
  day_number     integer check (day_number >= 1),
  after_place_id uuid,
  position       integer not null default 0,           -- order between two places
  unique (item_id, leg_number),
  foreign key (item_id, trip_id) references public.items (id, trip_id) on delete cascade,
  foreign key (after_place_id, trip_id) references public.places (id, trip_id)
    on delete set null (after_place_id)
);

create index on public.item_legs (item_id);
create index on public.item_legs (trip_id);

-- Legs belong to tickets only.
create function public.item_legs_need_transport() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.items i where i.id = new.item_id and i.kind = 'transport') then
    raise exception 'Only a transport item can have legs';
  end if;
  return new;
end $$;

create trigger item_legs_need_transport
  before insert or update of item_id on public.item_legs
  for each row execute function public.item_legs_need_transport();

alter table public.item_legs enable row level security;
create policy "read: members, or demo trip" on public.item_legs
  for select to anon, authenticated
  using (private.can_read_trip(trip_id));
create policy "write: members only" on public.item_legs
  for all to authenticated
  using (private.is_trip_member(trip_id))
  with check (private.is_trip_member(trip_id));

-- ── 3. Each traveller's share, line by line ──────────────────────────────────
-- The same lines as v_traveller_shares, kept with their place and category,
-- so the Budget screen can show "your share" everywhere.
create view public.v_traveller_lines with (security_invoker = true) as
select s.trip_id, s.traveller_id, a.place_id, a.category,
       s.fraction * a.current as amount, a.is_confirmed
from public.v_item_shares s
join public.v_item_amounts a on a.item_id = s.item_id
union all
select d.trip_id, p.traveller_id, d.place_id, d.category,
       round(d.amount * d.rate, 2) * d.days, false
from public.v_daily_estimate_people p
join public.daily_estimates d on d.id = p.daily_estimate_id;

create view public.v_traveller_by_category with (security_invoker = true) as
select trip_id, traveller_id, category,
       round(sum(amount), 2) as current,
       round(sum(amount) filter (where is_confirmed), 2)     as confirmed,
       round(sum(amount) filter (where not is_confirmed), 2) as estimated
from public.v_traveller_lines
group by trip_id, traveller_id, category;

-- Whole-trip lines are left out, as in v_budget_by_place (BR-9).
create view public.v_traveller_by_place with (security_invoker = true) as
select trip_id, traveller_id, place_id,
       round(sum(amount), 2) as current,
       round(sum(amount) filter (where is_confirmed), 2)     as confirmed,
       round(sum(amount) filter (where not is_confirmed), 2) as estimated
from public.v_traveller_lines
where place_id is not null
group by trip_id, traveller_id, place_id;

-- ── Rights: same as everything else ──────────────────────────────────────────
revoke all on public.item_legs, public.v_traveller_lines,
              public.v_traveller_by_category, public.v_traveller_by_place
  from anon, authenticated;
grant select on public.item_legs, public.v_traveller_lines,
               public.v_traveller_by_category, public.v_traveller_by_place
  to anon;
grant select, insert, update, delete on public.item_legs to authenticated;
grant select on public.v_traveller_lines, public.v_traveller_by_category,
               public.v_traveller_by_place
  to authenticated;
