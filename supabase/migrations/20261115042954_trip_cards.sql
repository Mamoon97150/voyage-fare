-- "Your trips" as a shelf of notebooks (mockup trips-welcome-v5, 15 Nov): each trip you're on, with
-- what its card shows, in one call. Runs as you (security invoker), so it only sees your trips.
--   places       the route, in order: [{id, name, nights}]
--   travellers   [{id, name, me}]: me = the traveller you are on this trip
--   share_*      your share (confirmed / still estimated); the per-person figure if you're not on it
--   next_due     the next thing booked with something left to pay and a due date: {name, due_on, left}
--   undecided    the first line with options compared and none chosen: {name, options}, and how many
--   today        while travelling: today's plans (the day's lines, not stays or tickets)
--   settle       who pays whom, for what concerns you: [{name, amount, you_pay}]; null = nothing left
create function public.trip_cards()
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
  -- Lines with 2 or more options compared and none chosen yet.
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
      select jsonb_agg(jsonb_build_object(
               'name', other.name, 'amount', s.amount, 'you_pay', s.from_traveller = me.id) order by s.amount desc)
      from public.trip_settlement(t.id) s
      join public.travellers other
        on other.id = case when s.from_traveller = me.id then s.to_traveller else s.from_traveller end
      where me.id in (s.from_traveller, s.to_traveller)
    ),
    not exists (select 1 from public.trip_settlement(t.id))
  from public.trips t
  left join public.travellers me on me.trip_id = t.id and me.user_id = auth.uid()
  left join public.v_traveller_shares mine on mine.traveller_id = me.id
  left join public.v_trip_budget b on b.trip_id = t.id
  -- Only the trips you're on: the public demo trip is readable by all but isn't on your shelf.
  where exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
  order by t.created_at desc
$$;

revoke all on function public.trip_cards() from public, anon;
grant execute on function public.trip_cards() to authenticated;
