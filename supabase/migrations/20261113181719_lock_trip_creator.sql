-- Who created a trip, and whether it's the public demo, can't be changed from the app
-- (project review, 13 Nov 2026). Read access follows created_by, and "only the creator
-- deletes the trip" relies on it. Server-side steps (handing a trip over when its creator
-- deletes their account) run as the database owner and are not blocked.
create function private.trips_lock_creator() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.created_by is distinct from old.created_by or new.is_demo is distinct from old.is_demo) then
    raise exception 'Who created a trip can''t be changed' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trips_lock_creator
  before update on public.trips
  for each row execute function private.trips_lock_creator();
