-- Remove a traveller from a trip, safely (decided 13 Nov 2026, mockup 8).
-- Refused, with a reason the app shows, when:
--  - it's you (you can rename yourself; leaving a trip comes with invitations);
--  - it's the last traveller;
--  - they paid something, owe something or were paid back: settle up first (SR-7);
--  - they're the only person on an item: once removed, that item would quietly be split
--    between everyone, so the organizer changes it first.
-- Otherwise their share is spread over the others by the usual split rules.
create function public.remove_traveller(p_traveller_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_user uuid;
  v_name text;
  v_item text;
  v_money boolean;
begin
  select trip_id, user_id, name into v_trip, v_user, v_name from public.travellers where id = p_traveller_id;
  if v_trip is null then
    raise exception 'Traveller not found' using errcode = 'P0002';
  end if;
  if not private.is_trip_member(v_trip) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  if v_user is not null and v_user = auth.uid() then
    raise exception 'You can''t remove yourself from the trip.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.travellers where trip_id = v_trip) <= 1 then
    raise exception 'A trip needs at least one traveller.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.items where paid_by = p_traveller_id)
      or exists (select 1 from public.repayments where from_traveller = p_traveller_id or to_traveller = p_traveller_id)
      or exists (select 1 from public.v_traveller_balances b
                 where b.traveller_id = p_traveller_id and (b.share_of_paid <> 0 or b.balance <> 0))
    into v_money;
  if v_money then
    raise exception '% has paid or owes money on this trip: settle up first.', v_name using errcode = 'P0001';
  end if;

  select i.name into v_item
  from public.item_split_travellers s
  join public.items i on i.id = s.item_id
  where s.traveller_id = p_traveller_id
    and not exists (select 1 from public.item_split_travellers o where o.item_id = s.item_id and o.traveller_id <> p_traveller_id)
  limit 1;
  if v_item is not null then
    raise exception '% is the only one on “%”: change that first.', v_name, v_item using errcode = 'P0001';
  end if;

  delete from public.travellers where id = p_traveller_id;
end $$;

revoke all on function public.remove_traveller(uuid) from public, anon;
grant execute on function public.remove_traveller(uuid) to authenticated;
