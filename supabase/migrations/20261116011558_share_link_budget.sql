-- Read-only share link, Budget (build 8 step 6, 16 Nov 2026): the link also gives Budget its totals by
-- category. Still never who paid: no balances, settlement or repayments.

create or replace function public.shared_trip(p_token text) returns jsonb
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
    -- Budget's totals by category (never who paid: no balances, settlement or repayments).
    'money', jsonb_build_object(
      'categories', case when v_prices then coalesce((select jsonb_agg(to_jsonb(c)) from public.v_budget_by_category c where c.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
      'travellerCategories', case when v_prices then coalesce((select jsonb_agg(to_jsonb(c)) from public.v_traveller_by_category c where c.trip_id = v_trip), '[]'::jsonb) else '[]'::jsonb end,
      'balances', '[]'::jsonb,
      'settlement', '[]'::jsonb,
      'repayments', '[]'::jsonb
    ),
    'payments', '[]'::jsonb,
    'itemLeft', '[]'::jsonb,
    'files', '[]'::jsonb,
    'mails', '[]'::jsonb
  );
end $$;
