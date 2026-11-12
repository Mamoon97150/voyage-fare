-- Voyage Fare — privacy (cahier des charges §9).
-- A trip is visible only to its members. The demo trip is public and read-only.

create schema if not exists private;

create function private.is_trip_member(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_trip_owner(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create function private.can_read_trip(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_trip_member(p_trip_id)
      or exists (select 1 from public.trips t where t.id = p_trip_id and t.is_demo);
$$;

-- Whoever creates a trip becomes its owner.
create function private.add_trip_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.trip_members (trip_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end $$;

create trigger trips_add_owner
  after insert on public.trips
  for each row execute function private.add_trip_owner();

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.trip_settlement(uuid) to anon, authenticated;

-- Trips
alter table public.trips enable row level security;

create policy "trips: read own or demo" on public.trips
  for select to anon, authenticated
  using (is_demo or created_by = (select auth.uid()) or private.is_trip_member(id));

create policy "trips: create own" on public.trips
  for insert to authenticated
  with check (created_by = (select auth.uid()) and not is_demo);

create policy "trips: members edit" on public.trips
  for update to authenticated
  using (private.is_trip_member(id))
  with check (private.is_trip_member(id) and not is_demo);

create policy "trips: owner deletes" on public.trips
  for delete to authenticated
  using (private.is_trip_owner(id));

-- Members
alter table public.trip_members enable row level security;

create policy "members: read own trips" on public.trip_members
  for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "members: owner manages" on public.trip_members
  for all to authenticated
  using (private.is_trip_owner(trip_id))
  with check (private.is_trip_owner(trip_id));

-- Everything inside a trip follows the same two rules.
do $$
declare
  t text;
begin
  foreach t in array array[
    'travellers', 'places', 'items', 'options', 'rooms', 'room_occupants',
    'item_split_travellers', 'day_split_travellers',
    'daily_estimates', 'daily_estimate_travellers', 'repayments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "read: members, or demo trip" on public.%I
         for select to anon, authenticated
         using (private.can_read_trip(trip_id))', t);
    execute format(
      'create policy "write: members only" on public.%I
         for all to authenticated
         using (private.is_trip_member(trip_id))
         with check (private.is_trip_member(trip_id))', t);
  end loop;
end $$;
