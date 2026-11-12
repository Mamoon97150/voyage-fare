import type { PGlite } from '@electric-sql/pglite'

/**
 * A small made-up trip that exercises every rule.
 * The expected numbers in the tests were worked out by hand from this file.
 *
 * Lisbon (3 nights) + Porto (2 nights) · 4 travellers · EUR · target 700 € pp
 *
 *  Item                         Planned  Actual  Status   Paid by  Split
 *  Flights (whole trip)           1 000   1 040  paid     Ana      everyone
 *  Lisbon flat, by room             500     500  booked   —        room 1 (300): Ana, Bea · room 2 (200): Cleo, Dana
 *  Porto hotel, 400 USD @ 0.90      360       —  chosen   —        everyone
 *  Photo shoot, day 2               150     150  paid     Bea      day 2 = Ana, Bea, Cleo (a gift for Dana)
 *  Dinner, day 2                     90       —  chosen   —        day 2 = Ana, Bea, Cleo
 *  Surf lesson (Porto)               80      80  paid     Cleo     split between Ana and Cleo
 *  Insurance (whole trip)             —       —  chosen   —        everyone (no amount yet)
 *  Porto restaurant idea            (60)      —  idea     —        not chosen, not counted
 *  Food, 20 € pp per day × 5        400       —  estimate —        everyone
 */
export const ids = {
  owner: '00000000-0000-0000-0000-0000000000a1',
  stranger: '00000000-0000-0000-0000-0000000000a2',
  trip: '10000000-0000-0000-0000-000000000001',
  ana: '20000000-0000-0000-0000-000000000001',
  bea: '20000000-0000-0000-0000-000000000002',
  cleo: '20000000-0000-0000-0000-000000000003',
  dana: '20000000-0000-0000-0000-000000000004',
  lisbon: '30000000-0000-0000-0000-000000000001',
  porto: '30000000-0000-0000-0000-000000000002',
  flights: '40000000-0000-0000-0000-000000000001',
  flat: '40000000-0000-0000-0000-000000000002',
  hotel: '40000000-0000-0000-0000-000000000003',
  photo: '40000000-0000-0000-0000-000000000004',
  dinner: '40000000-0000-0000-0000-000000000005',
  surf: '40000000-0000-0000-0000-000000000006',
  insurance: '40000000-0000-0000-0000-000000000007',
  idea: '40000000-0000-0000-0000-000000000008',
  flightsCheap: '50000000-0000-0000-0000-000000000001',
  flightsDear: '50000000-0000-0000-0000-000000000002',
  flatRooms: '50000000-0000-0000-0000-000000000003',
  flatOther: '50000000-0000-0000-0000-000000000004',
  room1: '60000000-0000-0000-0000-000000000001',
  room2: '60000000-0000-0000-0000-000000000002',
} as const

export async function seedTrip(db: PGlite) {
  const t = ids.trip
  await db.exec(`
    insert into auth.users (id) values ('${ids.owner}'), ('${ids.stranger}');

    insert into public.trips (id, name, currency, target_amount, target_scope, created_by)
    values ('${t}', 'Lisbon & Porto', 'EUR', 700, 'per_person', '${ids.owner}');

    insert into public.travellers (id, trip_id, name, position) values
      ('${ids.ana}',  '${t}', 'Ana',  1),
      ('${ids.bea}',  '${t}', 'Bea',  2),
      ('${ids.cleo}', '${t}', 'Cleo', 3),
      ('${ids.dana}', '${t}', 'Dana', 4);

    insert into public.places (id, trip_id, name, nights, position) values
      ('${ids.lisbon}', '${t}', 'Lisbon', 3, 1),
      ('${ids.porto}',  '${t}', 'Porto',  2, 2);

    insert into public.items (id, trip_id, place_id, kind, category, name, day_number) values
      ('${ids.flights}',   '${t}', null,            'transport',  'main_transport', 'Flights',          null),
      ('${ids.flat}',      '${t}', '${ids.lisbon}', 'housing',    'accommodation',  'Lisbon flat',      null),
      ('${ids.hotel}',     '${t}', '${ids.porto}',  'housing',    'accommodation',  'Porto hotel',      null),
      ('${ids.photo}',     '${t}', '${ids.lisbon}', 'activity',   'activities',     'Photo shoot',      2),
      ('${ids.dinner}',    '${t}', '${ids.lisbon}', 'restaurant', 'food',           'Birthday dinner',  2),
      ('${ids.surf}',      '${t}', '${ids.porto}',  'activity',   'activities',     'Surf lesson',      null),
      ('${ids.insurance}', '${t}', null,            'insurance',  'insurance',      'Travel insurance', null),
      ('${ids.idea}',      '${t}', '${ids.porto}',  'restaurant', 'food',           'Seafood place',    null);

    insert into public.options (id, trip_id, item_id, name, amount, currency, rate, is_chosen, is_favourite) values
      ('${ids.flightsDear}',  '${t}', '${ids.flights}', 'TAP direct',      1200, 'EUR', 1,   false, false),
      ('${ids.flightsCheap}', '${t}', '${ids.flights}', 'Ryanair',         1000, 'EUR', 1,   true,  false),
      ('${ids.flatRooms}',    '${t}', '${ids.flat}',    'Alfama flat',     null, 'EUR', 1,   true,  true),
      ('${ids.flatOther}',    '${t}', '${ids.flat}',    'Baixa hotel',      450, 'EUR', 1,   false, false),
      (gen_random_uuid(),     '${t}', '${ids.hotel}',   'Ribeira hotel',    400, 'USD', 0.9, true,  false),
      (gen_random_uuid(),     '${t}', '${ids.photo}',   'Photographer',     150, 'EUR', 1,   true,  false),
      (gen_random_uuid(),     '${t}', '${ids.dinner}',  'Tasca',             90, 'EUR', 1,   true,  false),
      (gen_random_uuid(),     '${t}', '${ids.surf}',    'Surf school',       80, 'EUR', 1,   true,  false),
      (gen_random_uuid(),     '${t}', '${ids.insurance}', 'Insurer',       null, 'EUR', 1,   true,  false),
      (gen_random_uuid(),     '${t}', '${ids.idea}',    'Tasting menu',      60, 'EUR', 1,   false, false);

    insert into public.rooms (id, trip_id, option_id, name, amount) values
      ('${ids.room1}', '${t}', '${ids.flatRooms}', 'Big room',   300),
      ('${ids.room2}', '${t}', '${ids.flatRooms}', 'Small room', 200);
    insert into public.room_occupants (room_id, traveller_id, trip_id) values
      ('${ids.room1}', '${ids.ana}',  '${t}'), ('${ids.room1}', '${ids.bea}',  '${t}'),
      ('${ids.room2}', '${ids.cleo}', '${t}'), ('${ids.room2}', '${ids.dana}', '${t}');

    -- Day 2 is Dana's birthday: the day is a gift from the other three.
    insert into public.day_split_travellers (trip_id, day_number, traveller_id) values
      ('${t}', 2, '${ids.ana}'), ('${t}', 2, '${ids.bea}'), ('${t}', 2, '${ids.cleo}');

    insert into public.item_split_travellers (item_id, traveller_id, trip_id) values
      ('${ids.surf}', '${ids.ana}', '${t}'), ('${ids.surf}', '${ids.cleo}', '${t}');

    update public.items set status = 'paid', actual_amount = 1040, actual_currency = 'EUR', paid_by = '${ids.ana}'
      where id = '${ids.flights}';
    update public.items set status = 'booked', actual_amount = 500, actual_currency = 'EUR'
      where id = '${ids.flat}';
    update public.items set status = 'paid', actual_amount = 150, actual_currency = 'EUR', paid_by = '${ids.bea}'
      where id = '${ids.photo}';
    update public.items set status = 'paid', actual_amount = 80, actual_currency = 'EUR', paid_by = '${ids.cleo}'
      where id = '${ids.surf}';

    insert into public.daily_estimates (trip_id, category, label, amount, currency, days)
    values ('${t}', 'food', 'Food', 20, 'EUR', 5);
  `)
}
