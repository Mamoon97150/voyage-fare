-- Code review (14 Nov 2026), point 5: database speed, from Supabase's advisor.
-- Nothing changes in what anyone can see or do.

-- 1. An index under every link between tables (25 were missing): joins and deletes stay fast.
create index on public.daily_estimate_travellers (daily_estimate_id, trip_id);
create index on public.daily_estimate_travellers (traveller_id, trip_id);
create index on public.daily_estimates (place_id, trip_id);
create index on public.daily_estimates (trip_id);
create index on public.day_split_travellers (traveller_id, trip_id);
create index on public.invitations (accepted_by);
create index on public.invitations (invited_by);
create index on public.invitations (traveller_id, trip_id);
create index on public.item_legs (after_place_id, trip_id);
create index on public.item_legs (item_id, trip_id);
create index on public.item_split_travellers (item_id, trip_id);
create index on public.item_split_travellers (traveller_id, trip_id);
create index on public.items (package_id, trip_id);
create index on public.items (paid_by, trip_id);
create index on public.items (place_id, trip_id);
create index on public.options (item_id, trip_id);
create index on public.payments (item_id, trip_id);
create index on public.payments (paid_by, trip_id);
create index on public.repayments (from_traveller, trip_id);
create index on public.repayments (to_traveller, trip_id);
create index on public.room_occupants (room_id, trip_id);
create index on public.room_occupants (traveller_id, trip_id);
create index on public.rooms (option_id, trip_id);
create index on public.travellers (user_id);
create index on public.trips (created_by);

-- The single-column ones these replace.
drop index if exists public.items_package_id_idx;
drop index if exists public.payments_item_id_idx;
drop index if exists public.invitations_traveller_id_idx;

-- 2. One rule per action. "write: members only" was FOR ALL, so every read checked two rules
-- (it and "read: members, or demo trip"). Same rights, split into insert / update / delete.
do $$
declare
  t text;
begin
  foreach t in array array[
    'travellers', 'places', 'items', 'options', 'rooms', 'room_occupants',
    'item_split_travellers', 'day_split_travellers', 'daily_estimates', 'daily_estimate_travellers',
    'repayments', 'item_legs', 'payments'
  ] loop
    execute format('drop policy "write: members only" on public.%I', t);
    execute format(
      'create policy "insert: members only" on public.%I for insert to authenticated
         with check (private.is_trip_member(trip_id))', t);
    execute format(
      'create policy "update: members only" on public.%I for update to authenticated
         using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id))', t);
    execute format(
      'create policy "delete: members only" on public.%I for delete to authenticated
         using (private.is_trip_member(trip_id))', t);
  end loop;
end $$;

-- Members: the owner's rule was FOR ALL too.
drop policy "members: owner manages" on public.trip_members;
create policy "members: owner adds" on public.trip_members
  for insert to authenticated with check (private.is_trip_owner(trip_id));
create policy "members: owner changes" on public.trip_members
  for update to authenticated using (private.is_trip_owner(trip_id)) with check (private.is_trip_owner(trip_id));
create policy "members: owner removes" on public.trip_members
  for delete to authenticated using (private.is_trip_owner(trip_id));
