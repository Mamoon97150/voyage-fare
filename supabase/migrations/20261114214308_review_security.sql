-- Code review (14 Nov 2026), point 6: security tidy-up before going online.
-- Nothing anyone can do today changes: these rights were never usable, they shouldn't exist.

-- 1. Views are read-only by construction; nobody gets write rights on them.
do $$
declare
  v text;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', v);
  end loop;
end $$;

-- 2. Trigger functions run on their own when data changes: nobody calls them.
revoke execute on function public.items_sync_status() from public, anon, authenticated;
revoke execute on function public.options_keep_one_chosen() from public, anon, authenticated;
revoke execute on function public.options_touch_item() from public, anon, authenticated;
revoke execute on function public.item_legs_need_transport() from public, anon, authenticated;
revoke execute on function private.add_trip_owner() from public, anon, authenticated;
revoke execute on function private.trips_lock_creator() from public, anon, authenticated;
revoke execute on function private.items_guard_payments() from public, anon, authenticated;

-- 3. From now on, new tables and functions start closed: visitors never write, and functions
-- are only callable once a migration grants it (as every migration here already does).
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
