-- Read-only share link (build 8 step 6, mockup share-link-v5, 16 Nov 2026).
-- A trip can have one link, voyagefare.app/s/<token>. Anyone with it sees the trip, read-only and
-- without an account, through shared_trip(): it builds the trip on the server and leaves out what
-- a link never shows (who paid, payments, booking numbers and files, the trip's address), hides
-- names (Traveller 1, 2…) unless asked, and prices when asked. Turning it off deletes the link:
-- the next one is new, and the old one shows the same page as a link that never existed.

create table public.trip_shares (
  trip_id     uuid primary key references public.trips (id) on delete cascade,
  token       text not null unique,
  show_prices boolean not null default true,
  show_names  boolean not null default false,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.trip_shares enable row level security;
-- Only through the functions below (members), never read directly.
revoke all on public.trip_shares from public, anon, authenticated;

-- The trip's link (made the first time a traveller asks), and what it shows.
create function public.share_link(p_trip_id uuid)
returns table (token text, show_prices boolean, show_names boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if (select is_demo from public.trips where id = p_trip_id) then
    raise exception 'The demo is already open to everyone.' using errcode = 'P0001';
  end if;
  insert into public.trip_shares (trip_id, token)
  values (p_trip_id, left(replace(gen_random_uuid()::text, '-', ''), 16))
  on conflict (trip_id) do nothing;
  return query select s.token, s.show_prices, s.show_names from public.trip_shares s where s.trip_id = p_trip_id;
end $$;

create function public.set_share(p_trip_id uuid, p_show_prices boolean, p_show_names boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  update public.trip_shares set show_prices = p_show_prices, show_names = p_show_names where trip_id = p_trip_id;
end $$;

create function public.stop_share(p_trip_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  delete from public.trip_shares where trip_id = p_trip_id;
end $$;

-- What the link shows: the trip, as the app's pages read it, without what stays private.
-- null when the link doesn't exist (or was turned off): the same answer for both.
create function public.shared_trip(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_share public.trip_shares;
  v_trip uuid;
  v_prices boolean;
begin
  select * into v_share from public.trip_shares where token = p_token;
  if not found then
    return null;
  end if;
  v_trip := v_share.trip_id;
  v_prices := v_share.show_prices;

  return jsonb_build_object(
    'share', jsonb_build_object('token', v_share.token, 'show_prices', v_prices, 'show_names', v_share.show_names),
    'trip', (select to_jsonb(t) - 'mail_code' - 'created_by'
                    || jsonb_build_object('target_amount', case when v_prices then t.target_amount end)
             from public.trips t where t.id = v_trip),
    'travellers', coalesce((
      select jsonb_agg(
               to_jsonb(r) - 'user_id' - 'n'
               || jsonb_build_object('user_id', null,
                                     'name', case when v_share.show_names then r.name else 'Traveller ' || r.n end)
               order by r.position)
      from (select x.*, row_number() over (order by x.position) as n from public.travellers x where x.trip_id = v_trip) r
    ), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(to_jsonb(p) order by p.position) from public.places p where p.trip_id = v_trip), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
               to_jsonb(i) || jsonb_build_object(
                 'booking_ref', null, 'booking_link', null, 'paid_by', null, 'paid_on', null, 'paid_each', false,
                 'actual_amount', case when v_prices then i.actual_amount end)
               order by i.position)
      from public.items i where i.trip_id = v_trip
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(to_jsonb(o) || jsonb_build_object('amount', case when v_prices then o.amount end) order by o.position)
      from public.options o where o.trip_id = v_trip
    ), '[]'::jsonb),
    'legs', coalesce((select jsonb_agg(to_jsonb(l) order by l.position) from public.item_legs l where l.trip_id = v_trip), '[]'::jsonb),
    'amounts', case when v_prices then coalesce((select jsonb_agg(to_jsonb(a)) from public.v_item_amounts a where a.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'shares', case when v_prices then coalesce((select jsonb_agg(to_jsonb(s)) from public.v_item_shares s where s.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'budget', case when v_prices then (select to_jsonb(b) from public.v_trip_budget b where b.trip_id = v_trip) end,
    'travellerShares', case when v_prices then coalesce((select jsonb_agg(to_jsonb(s)) from public.v_traveller_shares s where s.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'placeTotals', case when v_prices then coalesce((select jsonb_agg(to_jsonb(s)) from public.v_budget_by_place s where s.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'travellerPlaceTotals', case when v_prices then coalesce((select jsonb_agg(to_jsonb(s)) from public.v_traveller_by_place s where s.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'rooms', case when v_prices then coalesce((select jsonb_agg(to_jsonb(r) order by r.position) from public.rooms r where r.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'roomOccupants', case when v_prices then coalesce((select jsonb_agg(to_jsonb(r)) from public.room_occupants r where r.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'dailyEstimates', case when v_prices then coalesce((select jsonb_agg(to_jsonb(d) order by d.label) from public.daily_estimates d where d.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'estimatePeople', case when v_prices then coalesce((select jsonb_agg(to_jsonb(d)) from public.v_daily_estimate_people d where d.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'estimateChecks', case when v_prices then coalesce((select jsonb_agg(to_jsonb(d)) from public.v_daily_estimate_checks d where d.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
    'payments', '[]'::jsonb,
    'itemLeft', '[]'::jsonb,
    'files', '[]'::jsonb,
    'mails', '[]'::jsonb
  );
end $$;

revoke all on function public.share_link(uuid) from public, anon;
revoke all on function public.set_share(uuid, boolean, boolean) from public, anon;
revoke all on function public.stop_share(uuid) from public, anon;
revoke all on function public.shared_trip(text) from public;
grant execute on function public.share_link(uuid) to authenticated;
grant execute on function public.set_share(uuid, boolean, boolean) to authenticated;
grant execute on function public.stop_share(uuid) to authenticated;
grant execute on function public.shared_trip(text) to anon, authenticated;
