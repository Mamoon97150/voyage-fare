-- Build 6 (14 Nov 2026): what's left to pay (mockup left-to-pay-v4).
-- A booked line can be paid in parts: a deposit, the balance, instalments, each with its own payer
-- (or "each their own share"), date, currency and saved rate. The budget doesn't move (a booked line
-- at its real price is confirmed in full, decided 13 Nov): payments change paid / left to pay.
-- When the payments cover the price, the line becomes paid; deleting one brings it back to booked.
-- Lines marked paid in one go (before payments existed) keep working: they count as one payment.

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  item_id    uuid not null,
  kind       text not null default 'payment' check (kind in ('deposit', 'balance', 'instalment', 'payment')),
  amount     numeric(14,2) not null check (amount > 0),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  rate       numeric(18,8) not null default 1 check (rate > 0),
  paid_by    uuid,
  paid_each  boolean not null default false,
  paid_on    date not null default current_date,
  note       text,
  created_at timestamptz not null default now(),
  foreign key (item_id, trip_id) references public.items (id, trip_id) on delete cascade,
  foreign key (paid_by, trip_id) references public.travellers (id, trip_id),
  check ((paid_by is not null) <> paid_each)
);
create index on public.payments (item_id);
create index on public.payments (trip_id);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to anon;
grant select, insert, update, delete on public.payments to authenticated;
create policy "read: members, or demo trip" on public.payments
  for select to anon, authenticated using (private.can_read_trip(trip_id));
create policy "write: members only" on public.payments
  for all to authenticated using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));

-- When the balance is due (one date per line, for what's left).
alter table public.items add column due_on date;

-- "Paid" no longer needs a single payer on the line: its payments can have several.
alter table public.items drop constraint items_paid_by_someone;
alter table public.items add constraint items_payer_only_when_paid
  check (status = 'paid' or (paid_by is null and not paid_each));

-- Every payment, in the trip's currency: the real ones, and a line paid in one go as one payment.
create view public.v_item_payments with (security_invoker = true) as
select p.id as payment_id, p.trip_id, p.item_id, p.kind, round(p.amount * p.rate, 2) as amount,
       p.paid_by, p.paid_each, p.paid_on
from public.payments p
union all
select null, i.trip_id, i.id, 'payment', a.actual, i.paid_by, i.paid_each, i.paid_on
from public.items i
join public.v_item_amounts a on a.item_id = i.id
where i.status = 'paid' and a.actual is not null
  and not exists (select 1 from public.payments p where p.item_id = i.id);

-- Paid so far and left to pay, for each booked or paid line (not those inside a package).
create view public.v_item_left with (security_invoker = true) as
select
  i.id as item_id, i.trip_id, i.place_id, i.due_on,
  a.current as price,
  coalesce(paid.amount, 0) as paid,
  greatest(round(coalesce(a.current, 0) - coalesce(paid.amount, 0), 2), 0) as left_to_pay
from public.items i
join public.v_item_amounts a on a.item_id = i.id
left join lateral (
  select sum(pp.amount) as amount from public.v_item_payments pp where pp.item_id = i.id
) paid on true
where i.status in ('booked', 'paid') and i.package_id is null;

-- Balances (SR-7), from the payments: what each paid (their own payments, and their share of
-- "each their own share" ones) against their share of everything paid so far.
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
  select sum(pp.amount) as amount from public.v_item_payments pp where pp.paid_by = t.id
) paid on true
left join lateral (
  select sum(s.fraction * pp.amount) as amount
  from public.v_item_payments pp join public.v_item_shares s on s.item_id = pp.item_id
  where s.traveller_id = t.id and pp.paid_each
) own on true
left join lateral (
  select sum(s.fraction * pp.amount) as amount
  from public.v_item_payments pp join public.v_item_shares s on s.item_id = pp.item_id
  where s.traveller_id = t.id
) owed on true
left join lateral (
  select sum(r.amount) as amount from public.repayments r where r.from_traveller = t.id
) sent on true
left join lateral (
  select sum(r.amount) as amount from public.repayments r where r.to_traveller = t.id
) got on true;

grant select on public.v_item_payments, public.v_item_left to anon, authenticated;

-- A line with payments: its status follows them (booked ↔ paid). It can't go back to chosen,
-- or be marked paid in one go, while payments are recorded.
create function private.items_guard_payments() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.payments p where p.item_id = new.id) then
    if new.status in ('idea', 'chosen', 'dropped') then
      raise exception 'This line has payments: delete them first.' using errcode = 'P0001';
    end if;
    if new.paid_by is not null or new.paid_each then
      raise exception 'This line is paid in parts: add the rest as a payment.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger items_guard_payments
  before update of status, paid_by, paid_each on public.items
  for each row execute function private.items_guard_payments();

create function private.sync_paid(p_item_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_left numeric;
  v_has boolean;
begin
  select exists (select 1 from public.payments where item_id = p_item_id) into v_has;
  if not v_has then
    update public.items set status = 'booked' where id = p_item_id and status = 'paid' and paid_by is null and not paid_each;
    return;
  end if;
  select left_to_pay into v_left from public.v_item_left where item_id = p_item_id;
  update public.items
  set status = case when coalesce(v_left, 0) <= 0 then 'paid' else 'booked' end,
      paid_on = case when coalesce(v_left, 0) <= 0 then (select max(paid_on) from public.payments where item_id = p_item_id) end
  where id = p_item_id;
end $$;

-- Add a payment to a booked line.
create function public.add_payment(
  p_item_id   uuid,
  p_kind      text,
  p_amount    numeric,
  p_currency  text default null,
  p_rate      numeric default null,
  p_paid_by   uuid default null,
  p_paid_each boolean default false,
  p_paid_on   date default null,
  p_note      text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_item public.items;
  v_currency text;
  v_rate numeric;
  v_id uuid;
begin
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if not private.is_trip_member(v_item.trip_id) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  if v_item.package_id is not null then
    raise exception 'It’s in a package: the package is what gets paid.' using errcode = 'P0001';
  end if;
  if v_item.status = 'paid' and not exists (select 1 from public.payments where item_id = p_item_id) then
    raise exception 'It’s marked paid in one go: set it back to Booked to record payments in parts.' using errcode = 'P0001';
  end if;
  if v_item.status not in ('booked', 'paid') then
    raise exception 'Book it first: payments are for booked lines.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount paid, like 120.' using errcode = 'P0001';
  end if;
  if (p_paid_by is null) = (not coalesce(p_paid_each, false)) then
    raise exception 'Say who paid: one person, or each their own share.' using errcode = 'P0001';
  end if;

  select currency into v_currency from public.trips where id = v_item.trip_id;
  if p_currency is null or p_currency = v_currency then
    v_rate := 1;
  elsif p_rate is null or p_rate <= 0 then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := p_rate;
  end if;

  insert into public.payments (trip_id, item_id, kind, amount, currency, rate, paid_by, paid_each, paid_on, note)
  values (v_item.trip_id, p_item_id, coalesce(p_kind, 'payment'), p_amount, coalesce(p_currency, v_currency), v_rate,
          p_paid_by, coalesce(p_paid_each, false), coalesce(p_paid_on, current_date), nullif(trim(p_note), ''))
  returning id into v_id;
  perform private.sync_paid(p_item_id);
  return v_id;
end $$;

create function public.delete_payment(p_payment_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_item uuid;
begin
  delete from public.payments where id = p_payment_id returning item_id into v_item;
  if v_item is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  perform private.sync_paid(v_item);
end $$;

create function public.set_item_due(p_item_id uuid, p_due_on date) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.items set due_on = p_due_on where id = p_item_id;
  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.add_payment(uuid, text, numeric, text, numeric, uuid, boolean, date, text) from public, anon;
revoke all on function public.delete_payment(uuid) from public, anon;
revoke all on function public.set_item_due(uuid, date) from public, anon;
grant execute on function public.add_payment(uuid, text, numeric, text, numeric, uuid, boolean, date, text) to authenticated;
grant execute on function public.delete_payment(uuid) to authenticated;
grant execute on function public.set_item_due(uuid, date) to authenticated;
