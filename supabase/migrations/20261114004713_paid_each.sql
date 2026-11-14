-- Build 4 (13 Nov): "each paid their own share". A line can be paid by one traveller (SR-6) or
-- by everyone on it, each their own part (Colombia's package, everyone's own flight). It counts as
-- paid, and each traveller has paid exactly their share of it: it creates no debts.

alter table public.items add column paid_each boolean not null default false;

alter table public.items drop constraint items_check2;
alter table public.items add constraint items_paid_by_someone
  check ((status = 'paid') = (paid_by is not null or paid_each));
alter table public.items add constraint items_one_kind_of_payer
  check (not (paid_each and paid_by is not null));

-- Balances (SR-7): what each paid now includes their share of the lines everyone paid for themselves.
create or replace view public.v_traveller_balances with (security_invoker = true) as
select
  t.trip_id,
  t.id as traveller_id,
  round(coalesce(paid.amount, 0) + coalesce(own.amount, 0), 2) as paid,
  round(coalesce(owed.amount, 0), 2)       as share_of_paid,
  coalesce(sent.amount, 0)                 as repaid,
  coalesce(got.amount, 0)                  as received,
  round(coalesce(paid.amount, 0) + coalesce(own.amount, 0) - coalesce(owed.amount, 0)
        + coalesce(sent.amount, 0) - coalesce(got.amount, 0), 2) as balance
from public.travellers t
left join lateral (
  select sum(a.actual) as amount
  from public.items i join public.v_item_amounts a on a.item_id = i.id
  where i.paid_by = t.id
) paid on true
left join lateral (
  select sum(s.fraction * a.actual) as amount
  from public.v_item_shares s
  join public.v_item_amounts a on a.item_id = s.item_id
  join public.items i on i.id = s.item_id
  where s.traveller_id = t.id and i.paid_each and a.status = 'paid'
) own on true
left join lateral (
  select sum(s.fraction * a.actual) as amount
  from public.v_item_shares s join public.v_item_amounts a on a.item_id = s.item_id
  where s.traveller_id = t.id and a.status = 'paid'
) owed on true
left join lateral (
  select sum(r.amount) as amount from public.repayments r where r.from_traveller = t.id
) sent on true
left join lateral (
  select sum(r.amount) as amount from public.repayments r where r.to_traveller = t.id
) got on true;

drop function public.set_item_status(uuid, text, numeric, uuid, date, text, numeric);

create function public.set_item_status(
  p_item_id         uuid,
  p_status          text,
  p_actual_amount   numeric default null,
  p_paid_by         uuid default null,
  p_paid_on         date default null,
  p_actual_currency text default null,
  p_actual_rate     numeric default null,
  p_paid_each       boolean default false
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_currency text;
  v_actual_currency text;
  v_rate numeric;
  v_each boolean := coalesce(p_paid_each, false);
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
  if p_status = 'paid' and (p_actual_amount is null or (p_paid_by is null and not v_each)) then
    raise exception 'Paid needs the amount really paid and who paid it.' using errcode = 'P0001';
  end if;
  if p_actual_amount is not null and p_actual_amount < 0 then
    raise exception 'An amount can’t be negative.' using errcode = 'P0001';
  end if;

  v_actual_currency := coalesce(upper(nullif(trim(p_actual_currency), '')), v_currency);
  if v_actual_currency = v_currency then
    v_rate := 1;
  elsif p_actual_rate is null or p_actual_rate <= 0 then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := p_actual_rate;
  end if;

  update public.items
  set status          = p_status,
      actual_amount   = case when p_status = 'chosen' then null else p_actual_amount end,
      actual_currency = case when p_status = 'chosen' or p_actual_amount is null then null else v_actual_currency end,
      actual_rate     = case when p_status = 'chosen' or p_actual_amount is null then 1 else v_rate end,
      paid_by         = case when p_status = 'paid' and not v_each then p_paid_by end,
      paid_each       = p_status = 'paid' and v_each,
      paid_on         = case when p_status = 'paid' then coalesce(p_paid_on, current_date) end
  where id = p_item_id;
end $$;

revoke all on function public.set_item_status(uuid, text, numeric, uuid, date, text, numeric, boolean) from public, anon;
grant execute on function public.set_item_status(uuid, text, numeric, uuid, date, text, numeric, boolean) to authenticated;
