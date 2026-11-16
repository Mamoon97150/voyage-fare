-- Build 10 (16 Nov 2026, mockup money-v6): paying together, a deposit then each their own bill, cash.
--
-- 1. Who pays together: travellers can be in a group (a couple, two sisters, a family). A group
--    settles up as ONE with everyone else; each member keeps their own share of the budget.
--    "Between you" (option B, decided 16 Nov): inside a group, a debt only appears when one member
--    paid a line that is for other members and not for themselves.
-- 2. "Each pays their own bill": a payment can be just for its payer (their part of what's left
--    after a deposit for everyone). It counts against the line, and only against the payer's share.
-- 3. Cash: a line paid on the spot, in two taps, marked as cash (an amount that may be rough).

-- ── 1. Groups ───────────────────────────────────────────────────────────────

create table public.pay_groups (
  id      uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  unique (id, trip_id)
);
create index on public.pay_groups (trip_id);

alter table public.travellers add column pay_group_id uuid;
alter table public.travellers add constraint travellers_pay_group_fk
  foreign key (pay_group_id, trip_id) references public.pay_groups (id, trip_id) on delete set null (pay_group_id);
create index on public.travellers (pay_group_id);

alter table public.pay_groups enable row level security;
revoke all on public.pay_groups from anon, authenticated;
grant select on public.pay_groups to anon;
grant select, insert, update, delete on public.pay_groups to authenticated;
create policy "read: members, or demo trip" on public.pay_groups
  for select to anon, authenticated using (private.can_read_trip(trip_id));
create policy "write: members only" on public.pay_groups
  for all to authenticated using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));

-- A group of one isn't a group: when members leave (or are removed), tidy up.
create function private.tidy_pay_groups() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.pay_groups g
  where (select count(*) from public.travellers t where t.pay_group_id = g.id) < 2;
  return null;
end $$;

create trigger travellers_tidy_pay_groups
  after update of pay_group_id or delete on public.travellers
  for each statement execute function private.tidy_pay_groups();

-- Put these travellers together (2 or more), in a new group or an existing one (its members are
-- replaced). Someone already in another group moves. Fewer than 2 people = no group.
create function public.set_pay_group(p_trip_id uuid, p_traveller_ids uuid[], p_group_id uuid default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_group uuid := p_group_id;
  v_count integer;
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  select count(*) into v_count from public.travellers
  where trip_id = p_trip_id and id = any (coalesce(p_traveller_ids, '{}'));
  if v_count <> coalesce(array_length(p_traveller_ids, 1), 0) then
    raise exception 'Someone isn’t on this trip.' using errcode = 'P0001';
  end if;

  if v_group is not null and not exists (select 1 from public.pay_groups where id = v_group and trip_id = p_trip_id) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;

  if v_count < 2 then
    if v_group is not null then
      delete from public.pay_groups where id = v_group;
    end if;
    return null;
  end if;

  if v_group is null then
    insert into public.pay_groups (trip_id) values (p_trip_id) returning id into v_group;
  end if;
  -- Add first, then let go of the others: the group never drops under 2 on the way (it would be tidied away).
  update public.travellers set pay_group_id = v_group where id = any (p_traveller_ids);
  update public.travellers set pay_group_id = null
  where pay_group_id = v_group and not (id = any (p_traveller_ids));
  return v_group;
end $$;

create function public.remove_pay_group(p_group_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.pay_groups where id = p_group_id;
  if not found then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.set_pay_group(uuid, uuid[], uuid) from public, anon;
revoke all on function public.remove_pay_group(uuid) from public, anon;
grant execute on function public.set_pay_group(uuid, uuid[], uuid) to authenticated;
grant execute on function public.remove_pay_group(uuid) to authenticated;

-- "Djamina & Danielle", "Ana, Bea & Cleo"; a traveller on their own: their name.
create function public.party_name(p_group_id uuid, p_traveller_id uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when p_group_id is null then (select name from public.travellers where id = p_traveller_id)
    else (
      select case when count(*) = 1 then max(name)
                  else string_agg(name, ', ' order by position, name) filter (where rn < n)
                       || ' & ' || max(name) filter (where rn = n) end
      from (
        select name, position, row_number() over (order by position, name, id) as rn, count(*) over () as n
        from public.travellers where pay_group_id = p_group_id
      ) m
    )
  end
$$;
grant execute on function public.party_name(uuid, uuid) to anon, authenticated;

-- ── 2. A payment just for its payer ("each pays their own bill") ────────────

alter table public.payments add column for_payer boolean not null default false;
alter table public.payments add constraint payments_for_payer_needs_payer check (not for_payer or paid_by is not null);

create or replace view public.v_item_payments with (security_invoker = true) as
select p.id as payment_id, p.trip_id, p.item_id, p.kind, round(p.amount * p.rate, 2) as amount,
       p.paid_by, p.paid_each, p.paid_on, p.for_payer
from public.payments p
union all
select null, i.trip_id, i.id, 'payment', a.actual, i.paid_by, i.paid_each, i.paid_on, false
from public.items i
join public.v_item_amounts a on a.item_id = i.id
where i.status = 'paid' and a.actual is not null
  and not exists (select 1 from public.payments p where p.item_id = i.id);

-- Balances: a payment for its payer counts as theirs alone (paid by them, owed by them).
create or replace view public.v_traveller_balances with (security_invoker = true) as
select
  t.trip_id,
  t.id as traveller_id,
  round(coalesce(paid.amount, 0) + coalesce(own.amount, 0), 2) as paid,
  round(coalesce(owed.amount, 0) + coalesce(mine.amount, 0), 2) as share_of_paid,
  coalesce(sent.amount, 0)                 as repaid,
  coalesce(got.amount, 0)                  as received,
  round(coalesce(paid.amount, 0) + coalesce(own.amount, 0) - coalesce(owed.amount, 0) - coalesce(mine.amount, 0)
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
  where s.traveller_id = t.id and not pp.for_payer
) owed on true
left join lateral (
  select sum(pp.amount) as amount from public.v_item_payments pp where pp.for_payer and pp.paid_by = t.id
) mine on true
left join lateral (
  select sum(r.amount) as amount from public.repayments r where r.from_traveller = t.id
) sent on true
left join lateral (
  select sum(r.amount) as amount from public.repayments r where r.to_traveller = t.id
) got on true;

-- Each person's bill on a booked line: their share of the price, less their part of what was paid
-- for everyone (a deposit), less what they paid for themselves.
create view public.v_item_bills with (security_invoker = true) as
select
  s.item_id, s.trip_id, s.traveller_id,
  round(s.fraction * a.current, 2) as share,
  round(s.fraction * coalesce(common.amount, 0), 2) as common_part,
  coalesce(own.amount, 0) as paid_own,
  greatest(round(s.fraction * (a.current - coalesce(common.amount, 0)) - coalesce(own.amount, 0), 2), 0) as left_to_pay
from public.v_item_shares s
join public.items i on i.id = s.item_id
join public.v_item_amounts a on a.item_id = s.item_id
left join lateral (
  select sum(pp.amount) as amount from public.v_item_payments pp where pp.item_id = s.item_id and not pp.for_payer
) common on true
left join lateral (
  select sum(pp.amount) as amount from public.v_item_payments pp
  where pp.item_id = s.item_id and pp.for_payer and pp.paid_by = s.traveller_id
) own on true
where i.status in ('booked', 'paid') and i.package_id is null and a.current is not null;

grant select on public.v_item_bills to anon, authenticated;

-- add_payment gets "just for the payer".
drop function public.add_payment(uuid, text, numeric, text, numeric, uuid, boolean, date, text);
create function public.add_payment(
  p_item_id   uuid,
  p_kind      text,
  p_amount    numeric,
  p_currency  text default null,
  p_rate      numeric default null,
  p_paid_by   uuid default null,
  p_paid_each boolean default false,
  p_paid_on   date default null,
  p_note      text default null,
  p_for_payer boolean default false
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
  if coalesce(p_for_payer, false) and p_paid_by is null then
    raise exception 'Say who paid their own bill.' using errcode = 'P0001';
  end if;

  select currency into v_currency from public.trips where id = v_item.trip_id;
  if p_currency is null or p_currency = v_currency then
    v_rate := 1;
  elsif p_rate is null or p_rate <= 0 then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := p_rate;
  end if;

  insert into public.payments (trip_id, item_id, kind, amount, currency, rate, paid_by, paid_each, paid_on, note, for_payer)
  values (v_item.trip_id, p_item_id, coalesce(p_kind, 'payment'), p_amount, coalesce(p_currency, v_currency), v_rate,
          p_paid_by, coalesce(p_paid_each, false), coalesce(p_paid_on, current_date), nullif(trim(p_note), ''),
          coalesce(p_for_payer, false))
  returning id into v_id;
  perform private.sync_paid(p_item_id);
  return v_id;
end $$;

revoke all on function public.add_payment(uuid, text, numeric, text, numeric, uuid, boolean, date, text, boolean) from public, anon;
grant execute on function public.add_payment(uuid, text, numeric, text, numeric, uuid, boolean, date, text, boolean) to authenticated;

-- ── Settling up, by group ───────────────────────────────────────────────────

-- One row per party (a group, or someone on their own): what it is owed (+) or owes (−).
create view public.v_party_balances with (security_invoker = true) as
select
  t.trip_id,
  t.pay_group_id as group_id,
  case when t.pay_group_id is null then min(t.id::text)::uuid end as traveller_id,
  -- Who stands for the party in a repayment: its first member.
  (array_agg(t.id order by t.position, t.name, t.id))[1] as lead_traveller,
  min(t.position) as position,
  round(sum(b.paid), 2) as paid,
  round(sum(b.share_of_paid), 2) as share_of_paid,
  round(sum(b.balance), 2) as balance
from public.travellers t
join public.v_traveller_balances b on b.traveller_id = t.id
group by t.trip_id, t.pay_group_id, case when t.pay_group_id is null then t.id end;

grant select on public.v_party_balances to anon, authenticated;

-- Who pays whom, between parties. from_traveller / to_traveller = the party's first member (who a
-- repayment is recorded for); from_group / to_group say when it's a group.
drop function public.trip_settlement(uuid);
create function public.trip_settlement(p_trip_id uuid)
returns table (from_traveller uuid, to_traveller uuid, amount numeric, from_group uuid, to_group uuid)
language plpgsql stable set search_path = '' as $$
declare
  ids      uuid[];
  groups   uuid[];
  bal      numeric[];
  residual numeric;
  i        integer;
  creditor integer;
  debtor   integer;
  biggest  integer;
  pay      numeric;
begin
  select array_agg(b.lead_traveller order by b.position, b.lead_traveller),
         array_agg(b.group_id       order by b.position, b.lead_traveller),
         array_agg(b.balance        order by b.position, b.lead_traveller)
    into ids, groups, bal
  from public.v_party_balances b
  where b.trip_id = p_trip_id;

  if ids is null then
    return;
  end if;

  -- Rounding to the cent can leave a cent over (100 € split in 3). Put it on the biggest balance.
  select sum(x) into residual from unnest(bal) x;
  if residual <> 0 then
    biggest := 1;
    for i in 1 .. array_length(bal, 1) loop
      if abs(bal[i]) > abs(bal[biggest]) then biggest := i; end if;
    end loop;
    bal[biggest] := bal[biggest] - residual;
  end if;

  loop
    creditor := null;
    debtor := null;
    for i in 1 .. array_length(bal, 1) loop
      if bal[i] > 0 and (creditor is null or bal[i] > bal[creditor]) then creditor := i; end if;
      if bal[i] < 0 and (debtor is null or bal[i] < bal[debtor]) then debtor := i; end if;
    end loop;
    exit when creditor is null or debtor is null;

    pay := least(bal[creditor], -bal[debtor]);
    from_traveller := ids[debtor];
    to_traveller := ids[creditor];
    from_group := groups[debtor];
    to_group := groups[creditor];
    amount := pay;
    return next;

    bal[creditor] := bal[creditor] - pay;
    bal[debtor] := bal[debtor] + pay;
  end loop;
end $$;
grant execute on function public.trip_settlement(uuid) to anon, authenticated;

-- "Between you" inside a group (option B): a member paid a line for other members of the group and
-- not for themselves → those members owe them their part. Repayments between members count back.
create view public.v_group_between with (security_invoker = true) as
select pp.trip_id, payer.pay_group_id as group_id, s.traveller_id as owed_by, pp.paid_by as owed_to,
       round(s.fraction * pp.amount, 2) as amount, pp.item_id, pp.paid_on
from public.v_item_payments pp
join public.travellers payer on payer.id = pp.paid_by and payer.pay_group_id is not null
join public.v_item_shares s on s.item_id = pp.item_id and s.traveller_id <> pp.paid_by
join public.travellers member on member.id = s.traveller_id and member.pay_group_id = payer.pay_group_id
where not pp.paid_each and not pp.for_payer
  and not exists (select 1 from public.v_item_shares me where me.item_id = pp.item_id and me.traveller_id = pp.paid_by)
union all
select r.trip_id, a.pay_group_id, r.to_traveller, r.from_traveller, r.amount, null, r.paid_on
from public.repayments r
join public.travellers a on a.id = r.from_traveller
join public.travellers b on b.id = r.to_traveller and b.pay_group_id = a.pay_group_id;

grant select on public.v_group_between to anon, authenticated;

-- Your trips: "settle" speaks for your group too.
create or replace function public.trip_cards()
returns table (
  id uuid,
  name text,
  start_date date,
  end_date date,
  created_at timestamptz,
  currency text,
  home_city text,
  places jsonb,
  travellers jsonb,
  share_confirmed numeric,
  share_estimated numeric,
  next_due jsonb,
  undecided jsonb,
  undecided_count integer,
  today text[],
  settle jsonb,
  settled boolean
)
language sql stable security invoker set search_path = '' as $$
  with undecided as (
    select i.trip_id, i.name, i.position, count(*)::integer as n
    from public.items i join public.options o on o.item_id = i.id
    where i.status <> 'dropped'
    group by i.id
    having count(*) >= 2 and not bool_or(o.is_chosen)
  )
  select
    t.id, t.name, t.start_date, t.end_date, t.created_at, t.currency, t.home_city,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'nights', p.nights) order by p.position, p.name)
      from public.places p where p.trip_id = t.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', tr.id, 'name', tr.name, 'me', coalesce(tr.user_id = auth.uid(), false))
                       order by tr.position, tr.name)
      from public.travellers tr where tr.trip_id = t.id
    ), '[]'::jsonb),
    coalesce(mine.share_confirmed, b.confirmed_per_person, 0),
    coalesce(mine.share_estimated, b.estimated_per_person, 0),
    (
      select jsonb_build_object('name', i.name, 'due_on', l.due_on, 'left', l.left_to_pay)
      from public.v_item_left l join public.items i on i.id = l.item_id
      where l.trip_id = t.id and l.due_on is not null and l.left_to_pay > 0
      order by l.due_on, i.name limit 1
    ),
    (
      select jsonb_build_object('name', u.name, 'options', u.n)
      from undecided u where u.trip_id = t.id order by u.position, u.name limit 1
    ),
    (select count(*)::integer from undecided u where u.trip_id = t.id),
    case when current_date between t.start_date and coalesce(t.end_date, t.start_date) then (
      select coalesce(array_agg(i.name order by i.day_number, i.position, i.name), '{}')
      from public.items i
      where i.trip_id = t.id and i.status not in ('idea', 'dropped') and i.kind not in ('housing', 'transport')
        and (current_date - t.start_date + 1) between i.day_number and coalesce(i.end_day_number, i.day_number)
    ) end,
    (
      select jsonb_agg(jsonb_build_object('name', x.other, 'amount', x.amount, 'you_pay', x.you_pay) order by x.amount desc)
      from (
        select s.amount,
               coalesce(s.from_traveller = me.id or s.from_group = me.pay_group_id, false) as you_pay,
               case when coalesce(s.from_traveller = me.id or s.from_group = me.pay_group_id, false)
                    then public.party_name(s.to_group, s.to_traveller)
                    else public.party_name(s.from_group, s.from_traveller) end as other
        from public.trip_settlement(t.id) s
        where me.id in (s.from_traveller, s.to_traveller) or me.pay_group_id in (s.from_group, s.to_group)
      ) x
    ),
    not exists (select 1 from public.trip_settlement(t.id))
  from public.trips t
  left join public.travellers me on me.trip_id = t.id and me.user_id = auth.uid()
  left join public.v_traveller_shares mine on mine.traveller_id = me.id
  left join public.v_trip_budget b on b.trip_id = t.id
  where exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
  order by t.created_at desc
$$;

-- ── 3. Cash ─────────────────────────────────────────────────────────────────

alter table public.items add column is_cash boolean not null default false;

-- "I paid cash ≈ 40 €": a line paid on the spot. p_for = who it's for (empty = everyone).
create function public.add_cash(
  p_trip_id    uuid,
  p_amount     numeric,
  p_name       text,
  p_category   text,
  p_paid_by    uuid,
  p_for        uuid[] default '{}',
  p_place_id   uuid default null,
  p_day_number integer default null,
  p_currency   text default null,
  p_rate       numeric default null,
  p_paid_on    date default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_currency text;
  v_rate numeric;
  v_kind text;
  v_id uuid;
  v_n integer;
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'How much? Like 40.' using errcode = 'P0001';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Say what it was for, in a word.' using errcode = 'P0001';
  end if;
  if p_category not in ('local_transport', 'activities', 'food', 'buffer') then
    raise exception 'Pick Getting around, Food, Activities or Other.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.travellers where id = p_paid_by and trip_id = p_trip_id) then
    raise exception 'Say who paid.' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.travellers where trip_id = p_trip_id and id = any (coalesce(p_for, '{}'));
  if v_n <> coalesce(array_length(p_for, 1), 0) then
    raise exception 'Someone isn’t on this trip.' using errcode = 'P0001';
  end if;

  select currency into v_currency from public.trips where id = p_trip_id;
  if p_currency is null or p_currency = v_currency then
    v_rate := 1;
  elsif p_rate is null or p_rate <= 0 then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := p_rate;
  end if;

  v_kind := case p_category
    when 'local_transport' then case when p_place_id is null then 'other' else 'transport' end
    when 'activities' then 'activity'
    when 'food' then 'restaurant'
    else 'other' end;

  insert into public.items (trip_id, place_id, kind, category, name, day_number, status, is_cash,
                            actual_amount, actual_currency, actual_rate, paid_by, paid_on, position)
  values (p_trip_id, p_place_id, v_kind, p_category, trim(p_name), p_day_number, 'paid', true,
          p_amount, coalesce(p_currency, v_currency), v_rate, p_paid_by, coalesce(p_paid_on, current_date),
          coalesce((select max(position) + 1 from public.items where trip_id = p_trip_id), 0))
  returning id into v_id;

  insert into public.item_split_travellers (item_id, trip_id, traveller_id)
  select v_id, p_trip_id, x from unnest(coalesce(p_for, '{}')) x;
  return v_id;
end $$;

revoke all on function public.add_cash(uuid, numeric, text, text, uuid, uuid[], uuid, integer, text, numeric, date) from public, anon;
grant execute on function public.add_cash(uuid, numeric, text, text, uuid, uuid[], uuid, integer, text, numeric, date) to authenticated;
