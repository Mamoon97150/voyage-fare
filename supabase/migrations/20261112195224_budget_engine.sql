-- Voyage Fare — budget engine (BR-13: every calculation lives here, and is tested).
-- All views run with the caller's rights, so row-level security applies.

-- One row per item: planned, actual, current, confirmed or not.
create view public.v_item_amounts with (security_invoker = true) as
select
  i.id       as item_id,
  i.trip_id,
  i.place_id,
  i.category,
  i.status,
  o.id       as chosen_option_id,
  amounts.planned,
  amounts.actual,
  coalesce(amounts.actual, amounts.planned) as current,          -- BR-2
  (i.status in ('booked', 'paid') and i.actual_amount is not null) as is_confirmed  -- BR-3
from public.items i
left join public.options o on o.item_id = i.id and o.is_chosen   -- BR-1
left join lateral (
  select count(*) as room_count, sum(r.amount) as rooms_amount
  from public.rooms r where r.option_id = o.id
) rooms on true
cross join lateral (
  select
    round(case when rooms.room_count > 0 then rooms.rooms_amount else o.amount end * o.rate, 2) as planned,
    round(i.actual_amount * i.actual_rate, 2) as actual           -- BR-10
) amounts;

-- Who shares an item, and for what fraction (SR-1 to SR-5).
create view public.v_item_shares with (security_invoker = true) as
with chosen as (
  select i.id as item_id, i.trip_id, i.day_number, i.end_day_number, o.id as option_id
  from public.items i
  left join public.options o on o.item_id = i.id and o.is_chosen
),
-- The group an item is split between: its own "split between…", else its day's, else everyone.
base_group as (
  select c.item_id, c.trip_id, t.id as traveller_id
  from chosen c
  join public.travellers t on t.trip_id = c.trip_id
  where case
    when exists (select 1 from public.item_split_travellers s where s.item_id = c.item_id)
      then exists (select 1 from public.item_split_travellers s
                   where s.item_id = c.item_id and s.traveller_id = t.id)
    when c.day_number is not null
         and coalesce(c.end_day_number, c.day_number) = c.day_number
         and exists (select 1 from public.day_split_travellers d
                     where d.trip_id = c.trip_id and d.day_number = c.day_number)
      then exists (select 1 from public.day_split_travellers d
                   where d.trip_id = c.trip_id and d.day_number = c.day_number and d.traveller_id = t.id)
    else true
  end
),
-- Each room weighs its part of the option's price.
room_parts as (
  select c.item_id, c.trip_id, r.id as room_id,
         case when tot.total > 0 then r.amount / tot.total else 1.0 / tot.n end as room_weight
  from chosen c
  join public.rooms r on r.option_id = c.option_id
  cross join lateral (
    select sum(r2.amount) as total, count(*) as n from public.rooms r2 where r2.option_id = c.option_id
  ) tot
),
-- A room is split between its occupants; an empty room falls back on the item's group.
room_people as (
  select rp.item_id, rp.trip_id, rp.room_id, rp.room_weight, ro.traveller_id
  from room_parts rp
  join public.room_occupants ro on ro.room_id = rp.room_id
  union all
  select rp.item_id, rp.trip_id, rp.room_id, rp.room_weight, bg.traveller_id
  from room_parts rp
  join base_group bg on bg.item_id = rp.item_id
  where not exists (select 1 from public.room_occupants ro where ro.room_id = rp.room_id)
),
room_shares as (
  select item_id, trip_id, traveller_id, sum(room_weight / people) as fraction
  from (select *, count(*) over (partition by room_id) as people from room_people) x
  group by item_id, trip_id, traveller_id
),
equal_shares as (
  select bg.item_id, bg.trip_id, bg.traveller_id,
         1.0 / count(*) over (partition by bg.item_id) as fraction
  from base_group bg
  where not exists (select 1 from room_parts rp where rp.item_id = bg.item_id)
)
select item_id, trip_id, traveller_id, fraction from room_shares
union all
select item_id, trip_id, traveller_id, fraction from equal_shares;

-- Travellers concerned by each daily estimate (everyone when none are listed).
create view public.v_daily_estimate_people with (security_invoker = true) as
select d.id as daily_estimate_id, d.trip_id, t.id as traveller_id
from public.daily_estimates d
join public.travellers t on t.trip_id = d.trip_id
where not exists (select 1 from public.daily_estimate_travellers x where x.daily_estimate_id = d.id)
   or exists (select 1 from public.daily_estimate_travellers x
              where x.daily_estimate_id = d.id and x.traveller_id = t.id);

-- Every line of the budget: items, plus daily estimates (always estimated, BR-7).
create view public.v_budget_lines with (security_invoker = true) as
select a.trip_id, 'item'::text as source, a.item_id as source_id, a.place_id, a.category,
       a.planned, a.actual, a.current, a.is_confirmed,
       (a.chosen_option_id is not null) as has_choice
from public.v_item_amounts a
union all
select d.trip_id, 'daily_estimate', d.id, d.place_id, d.category,
       line.amount, null, line.amount, false, true
from public.daily_estimates d
cross join lateral (
  select round(d.amount * d.rate, 2) * d.days
         * (select count(*) from public.v_daily_estimate_people p where p.daily_estimate_id = d.id) as amount
) line;

-- The budget bar: one row per trip.
create view public.v_trip_budget with (security_invoker = true) as
select
  t.id as trip_id,
  t.currency,
  people.n as traveller_count,
  totals.planned_total,
  totals.current_total,
  totals.confirmed_total,
  totals.estimated_total,
  totals.current_total   / nullif(people.n, 0) as current_per_person,     -- BR-6
  totals.confirmed_total / nullif(people.n, 0) as confirmed_per_person,
  totals.estimated_total / nullif(people.n, 0) as estimated_per_person,
  totals.missing_amount_count,
  target.target_total,
  totals.current_total - target.target_total as difference_total,         -- BR-12
  case
    when target.target_total is null or totals.current_total is null then null
    when totals.current_total > target.target_total then 'over'
    when totals.current_total < target.target_total then 'under'
    else 'on_target'
  end as target_status
from public.trips t
cross join lateral (select count(*) as n from public.travellers tr where tr.trip_id = t.id) people
cross join lateral (
  select
    sum(l.planned) as planned_total,
    sum(l.current) as current_total,
    sum(l.current) filter (where l.is_confirmed)     as confirmed_total,
    sum(l.current) filter (where not l.is_confirmed) as estimated_total,
    count(*) filter (where l.has_choice and l.current is null) as missing_amount_count  -- BR-4
  from public.v_budget_lines l where l.trip_id = t.id
) totals
cross join lateral (
  select case t.target_scope
           when 'total' then t.target_amount
           else t.target_amount * people.n
         end as target_total
) target;

create view public.v_budget_by_category with (security_invoker = true) as
select trip_id, category,
       sum(planned) as planned,
       sum(current) as current,
       sum(current) filter (where is_confirmed)     as confirmed,
       sum(current) filter (where not is_confirmed) as estimated
from public.v_budget_lines
group by trip_id, category;

-- By place: whole-trip lines are left out, and there is no grand total here (BR-9).
create view public.v_budget_by_place with (security_invoker = true) as
select trip_id, place_id,
       sum(planned) as planned,
       sum(current) as current,
       sum(current) filter (where is_confirmed)     as confirmed,
       sum(current) filter (where not is_confirmed) as estimated
from public.v_budget_lines
where place_id is not null
group by trip_id, place_id;

-- Each traveller's own share of the budget (BR-6).
create view public.v_traveller_shares with (security_invoker = true) as
select
  t.trip_id,
  t.id as traveller_id,
  round(sum(x.amount), 2) as share_current,
  round(sum(x.amount) filter (where x.is_confirmed), 2)     as share_confirmed,
  round(sum(x.amount) filter (where not x.is_confirmed), 2) as share_estimated
from public.travellers t
left join (
  select s.traveller_id, s.fraction * a.current as amount, a.is_confirmed
  from public.v_item_shares s
  join public.v_item_amounts a on a.item_id = s.item_id
  union all
  select p.traveller_id, round(d.amount * d.rate, 2) * d.days, false
  from public.v_daily_estimate_people p
  join public.daily_estimates d on d.id = p.daily_estimate_id
) x on x.traveller_id = t.id
group by t.trip_id, t.id;

-- Who paid what: balance = what each paid − their share of paid items, ± repayments (SR-7).
create view public.v_traveller_balances with (security_invoker = true) as
select
  t.trip_id,
  t.id as traveller_id,
  coalesce(paid.amount, 0)                 as paid,
  round(coalesce(owed.amount, 0), 2)       as share_of_paid,
  coalesce(sent.amount, 0)                 as repaid,
  coalesce(got.amount, 0)                  as received,
  round(coalesce(paid.amount, 0) - coalesce(owed.amount, 0)
        + coalesce(sent.amount, 0) - coalesce(got.amount, 0), 2) as balance
from public.travellers t
left join lateral (
  select sum(a.actual) as amount
  from public.items i join public.v_item_amounts a on a.item_id = i.id
  where i.paid_by = t.id
) paid on true
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

-- The payments that settle the trip: the biggest debtor pays the biggest creditor,
-- again and again. Never more than (travellers − 1) payments.
create function public.trip_settlement(p_trip_id uuid)
returns table (from_traveller uuid, to_traveller uuid, amount numeric)
language plpgsql stable set search_path = '' as $$
declare
  ids      uuid[];
  bal      numeric[];
  residual numeric;
  i        integer;
  creditor integer;
  debtor   integer;
  biggest  integer;
  pay      numeric;
begin
  select array_agg(b.traveller_id order by t.position, t.name, t.id),
         array_agg(b.balance      order by t.position, t.name, t.id)
    into ids, bal
  from public.v_traveller_balances b
  join public.travellers t on t.id = b.traveller_id
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
    amount := pay;
    return next;

    bal[creditor] := bal[creditor] - pay;
    bal[debtor] := bal[debtor] + pay;
  end loop;
end $$;
