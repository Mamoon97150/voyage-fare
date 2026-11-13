-- Statuses (build 3): chosen → booked → paid, set by hand (BR-8: they never go back down on
-- their own). Booked and paid carry what was really paid (BR-2), and that's what makes a line
-- "confirmed" (BR-3). Paid also says who paid and when (SR-6: one payer per item); the balances
-- that follow are build 4. Back to "chosen" clears all of it.
create function public.set_item_status(
  p_item_id       uuid,
  p_status        text,
  p_actual_amount numeric default null,
  p_paid_by       uuid default null,
  p_paid_on       date default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_currency text;
begin
  if p_status not in ('chosen', 'booked', 'paid') then
    raise exception 'A status is chosen, booked or paid.' using errcode = 'P0001';
  end if;

  select i.trip_id, t.currency into v_trip, v_currency
  from public.items i join public.trips t on t.id = i.trip_id
  where i.id = p_item_id;
  if v_trip is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  if p_status <> 'chosen' and not exists (select 1 from public.options where item_id = p_item_id and is_chosen) then
    raise exception 'Choose an option first: that’s what gets booked.' using errcode = 'P0001';
  end if;
  if p_status = 'paid' and (p_actual_amount is null or p_paid_by is null) then
    raise exception 'Paid needs the amount really paid and who paid it.' using errcode = 'P0001';
  end if;
  if p_actual_amount is not null and p_actual_amount < 0 then
    raise exception 'An amount can’t be negative.' using errcode = 'P0001';
  end if;

  update public.items
  set status          = p_status,
      actual_amount   = case when p_status = 'chosen' then null else p_actual_amount end,
      actual_currency = case when p_status = 'chosen' or p_actual_amount is null then null else v_currency end,
      actual_rate     = 1,
      paid_by         = case when p_status = 'paid' then p_paid_by end,
      paid_on         = case when p_status = 'paid' then coalesce(p_paid_on, current_date) end
  where id = p_item_id;
end $$;

revoke all on function public.set_item_status(uuid, text, numeric, uuid, date) from public, anon;
grant execute on function public.set_item_status(uuid, text, numeric, uuid, date) to authenticated;
