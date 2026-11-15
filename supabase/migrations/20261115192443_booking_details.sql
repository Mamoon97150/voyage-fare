-- Booking details on a line (build 8 step 4, mockup booking-details-v5, 15 Nov 2026):
-- a confirmation number, the booking link, and files (tickets, vouchers) private to the trip.

alter table public.items
  add column booking_ref  text check (booking_ref is null or length(booking_ref) <= 80),
  add column booking_link text check (booking_link is null or booking_link ~* '^https?://');

-- The files: one row per file; the file itself is in Storage at <trip>/<item>/<random>-<name>.
create table public.item_files (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  item_id    uuid not null,
  path       text not null unique,
  name       text not null check (length(trim(name)) > 0),
  size       integer not null check (size > 0 and size <= 10485760),
  mime       text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  added_by   uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (item_id, trip_id) references public.items (id, trip_id) on delete cascade,
  check (split_part(path, '/', 1) = trip_id::text and split_part(path, '/', 2) = item_id::text)
);
create index item_files_item on public.item_files (item_id);
create index item_files_trip on public.item_files (trip_id);

alter table public.item_files enable row level security;
create policy "read: members, or demo trip" on public.item_files
  for select to anon, authenticated using (private.can_read_trip(trip_id));
create policy "write: members only" on public.item_files
  for all to authenticated
  using (private.is_trip_member(trip_id))
  with check (private.is_trip_member(trip_id));
grant select on public.item_files to anon, authenticated;
grant insert, update, delete on public.item_files to authenticated;

-- Storage (only where Supabase's storage exists: the tests' Postgres has none).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('trip-files', 'trip-files', false, 10485760,
            array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    on conflict (id) do nothing;

    -- Only the trip's members, read and write, by the trip in the file's first folder.
    execute $p$
      create policy "trip files: members read" on storage.objects
        for select to authenticated
        using (bucket_id = 'trip-files'
               and private.is_trip_member(nullif((storage.foldername(name))[1], '')::uuid))
    $p$;
    execute $p$
      create policy "trip files: members add" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'trip-files'
                    and private.is_trip_member(nullif((storage.foldername(name))[1], '')::uuid))
    $p$;
    execute $p$
      create policy "trip files: members remove" on storage.objects
        for delete to authenticated
        using (bucket_id = 'trip-files'
               and private.is_trip_member(nullif((storage.foldername(name))[1], '')::uuid))
    $p$;
  end if;
end $$;
