-- "Delete my account" (sign-in polish, 15 Nov): the trips only you are on go with you; a shared trip
-- you created is handed over to the next person on it. Where you were a traveller, you become a name
-- again (travellers.user_id → null), so your share and what you paid stay for the others.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_trip uuid;
  v_next uuid;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  for v_trip in select id from public.trips where created_by = v_me loop
    select m.user_id into v_next
    from public.trip_members m
    where m.trip_id = v_trip and m.user_id <> v_me
    order by m.created_at, m.user_id
    limit 1;
    if v_next is null then
      delete from public.trips where id = v_trip;
    else
      update public.trips set created_by = v_next where id = v_trip;
      update public.trip_members set role = 'owner' where trip_id = v_trip and user_id = v_next;
    end if;
  end loop;

  -- Memberships go with the account (on delete cascade); travellers keep their name (set null).
  delete from auth.users where id = v_me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
