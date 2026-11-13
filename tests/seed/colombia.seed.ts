// The real Colombia & Panama trip (4–18 Sept 2026), rebuilt from Alizé's notes because the paper
// notebook is lost. It goes into the demo account and replaces any earlier "Colombia & Panama"
// there; nothing else is touched. Run: npm run seed:colombia
// ⚠ Re-running it starts the trip over: what was changed in the app since (a payment…) is lost.
//
// How it's modelled:
// - The agency package (2 560 € a person: flights, hotels with breakfast, most transfers) is one
//   whole-trip line, booked at 10 240 €. Flights and hotels are booked lines at 0 €, "in the package".
// - Extras: the locked day-by-day plan is the chosen option; the alternatives from the shortlist
//   shown to the sisters sit beside it. Prices are the notes' estimates, for the group of four
//   unless a line says otherwise. Prices quoted in dollars or pesos stay in them, at the rates of
//   13 Nov 2026 (1 € = 1,1068 $ = 3 645 COP).
// - Peggy's photoshoot is a gift: split between the other three. The jet-ski is Djamina's.
import { afterAll, expect, it } from 'vitest'
import type { Json } from '../../src/lib/database.types'
import type { OptionDetails } from '../../src/lib/options'
import { supabase } from '../../src/lib/supabase'
import { setItemStatus } from '../../src/lib/trips'

const NAME = 'Colombia & Panama'
/** Euros per 1 unit, 13 Nov 2026 (open.er-api.com: 1 € = 1,106822 $ = 3 645,03 COP). */
const RATES = { USD: Math.round((1 / 1.106822) * 1e8) / 1e8, COP: Math.round((1 / 3645.029563) * 1e8) / 1e8 }

type Opt = { name: string; amount: number | null; currency?: 'USD' | 'COP'; note?: string; link?: string; details?: OptionDetails; favourite?: boolean }
type Line = {
  kind: 'transport' | 'housing' | 'activity' | 'restaurant' | 'other'
  name: string
  day?: number
  endDay?: number
  note?: string
  options: Opt[]
  /** Which option is chosen; null = still to decide. Default: the first. */
  chosen?: number | null
  /** Only these travellers share it (default: everyone). */
  split?: string[]
  /** Booked at this amount. */
  booked?: number
  /** Decided against: kept for the record. */
  dropped?: boolean
}

// Day 1 = Fri 4 Sept.
const PLACES: { name: string; country: string; lat: number; lon: number; nights: number; lines: Line[] }[] = [
  {
    name: 'Bogotá',
    country: 'Colombia',
    lat: 4.711,
    lon: -74.0721,
    nights: 2,
    lines: [
      { kind: 'housing', name: 'Grand Hyatt Bogotá', day: 1, endDay: 3, note: 'In the package', booked: 0, options: [{ name: 'Grand Hyatt Bogotá', amount: 0, note: 'In the package', details: { type: 'Hotel', breakfast: true, location: 'North, 30–40 min from La Candelaria' } }] },
      {
        kind: 'restaurant',
        name: 'First dinner',
        day: 1,
        note: 'Altitude 2 600 m: go easy',
        options: [
          { name: 'Chorro de Quevedo', amount: null, note: 'La Candelaria, canelazo' },
          { name: 'Criterión', amount: 160, note: 'Zona G, elegant · ~40 € each' },
          { name: 'Salvo Patria', amount: 100, note: 'Chapinero, cosy · ~25 € each' },
        ],
      },
      {
        kind: 'activity',
        name: 'Plaza Bolívar + Museo Botero',
        day: 2,
        options: [
          { name: 'Plaza Bolívar + Museo Botero', amount: 0, note: 'Free' },
          { name: 'Museo del Oro', amount: 4, note: '~1 € each · dropped' },
          { name: 'Bogotá Graffiti Tour', amount: 40, note: 'La Candelaria, tip-based · moved to Comuna 13' },
        ],
      },
      {
        kind: 'restaurant',
        name: 'Lunch in La Candelaria',
        day: 2,
        note: 'To find on the spot',
        chosen: null,
        options: [
          { name: 'La Puerta Falsa', amount: 28, note: 'The institution · ~7 € each' },
          { name: 'Prudencia', amount: 120, note: 'Refined lunch · ~30 € each' },
          { name: 'Capital Cocina y Café', amount: null },
        ],
      },
      { kind: 'activity', name: 'Monserrate at sunset', day: 2, options: [{ name: 'Monserrate cable car', amount: 28, note: '~7 € each, return', link: 'https://cerromonserrate.com' }] },
      {
        kind: 'restaurant',
        name: 'Saturday dinner',
        day: 2,
        note: 'Book ahead',
        options: [
          { name: 'Andrés DC', amount: null, note: 'Zona T, the iconic dinner-show', favourite: true },
          { name: 'El Chato', amount: 280, note: 'Top 50 LatAm · ~70 € each' },
          { name: 'Villanos en Bermudas', amount: 200, note: '~50 € each' },
          { name: 'Mesa Franca', amount: 140, note: '~35 € each' },
        ],
      },
      {
        kind: 'activity',
        name: 'Sunday morning',
        day: 3,
        options: [
          { name: 'Usaquén flea market + brunch', amount: 70, note: 'Artisans, the “babouche” hunt' },
          { name: 'Mercado Paloquemao', amount: 28, note: 'Food market · ~7 € each' },
        ],
      },
    ],
  },
  {
    name: 'Guatapé',
    country: 'Colombia',
    lat: 6.2326,
    lon: -75.158,
    nights: 2,
    lines: [
      { kind: 'housing', name: 'The Boato Hotel', day: 3, endDay: 5, note: 'In the package', booked: 0, options: [{ name: 'The Boato Hotel', amount: 0, note: 'Superior room · in the package', details: { type: 'Hotel', breakfast: true } }] },
      {
        kind: 'restaurant',
        name: 'Trout dinner in town',
        day: 3,
        options: [
          { name: 'La Fogata', amount: 48, note: 'Lake view · ~12 € each' },
          { name: 'The Snuggly Duckling', amount: null },
        ],
      },
      { kind: 'activity', name: 'La Piedra del Peñol', day: 4, options: [{ name: 'La Piedra del Peñol', amount: 24, note: '740 steps · ~6 € each' }] },
      {
        kind: 'activity',
        name: 'Boat tour: the sunken village',
        day: 4,
        options: [
          { name: 'Private boat', amount: 55, note: '45–60 € for the group · + the Escobar villa ruin' },
          { name: 'Public boat', amount: 24, note: '~6 € each' },
        ],
      },
      {
        kind: 'activity',
        name: 'Something thrilling',
        day: 4,
        split: ['Djamina'],
        options: [
          { name: 'Jet-ski', amount: 35, note: '30 min' },
          { name: 'Quad around the lake', amount: 40 },
        ],
      },
      {
        kind: 'transport',
        name: 'Transfer to Medellín',
        day: 5,
        note: 'Not in the package · ask The Boato',
        options: [{ name: 'Private transfer via The Boato', amount: 70, note: '60–80 € for the group, ~2 h', details: { mode: 'car' } }],
      },
    ],
  },
  {
    name: 'Medellín',
    country: 'Colombia',
    lat: 6.2442,
    lon: -75.5812,
    nights: 4,
    lines: [
      { kind: 'housing', name: 'Nock Reserved Residences', day: 5, endDay: 9, note: 'In the package', booked: 0, options: [{ name: 'Nock Reserved Residences', amount: 0, note: '2-bedroom flat, deluxe balcony · in the package', details: { type: 'Apartment', breakfast: true, location: 'El Poblado' } }] },
      {
        kind: 'restaurant',
        name: 'Dinner in Provenza',
        day: 5,
        options: [
          { name: 'OCI.mde', amount: null, note: 'Chef ex-L’Astrance' },
          { name: 'Carmen', amount: 240, note: '~60 € each' },
          { name: 'Sambombi', amount: null },
        ],
      },
      { kind: 'activity', name: 'Plaza Botero + Museo de Antioquia', day: 6, options: [{ name: 'Plaza Botero + Museo de Antioquia', amount: 20, note: '~5 € each' }] },
      {
        kind: 'restaurant',
        name: 'Bandeja paisa lunch',
        day: 6,
        options: [
          { name: 'Hato Viejo', amount: null },
          { name: 'Hacienda', amount: null },
          { name: 'Mondongo’s', amount: null },
        ],
      },
      { kind: 'activity', name: 'Comuna 13 tour', day: 6, note: '16:30 · the tour’s street food is dinner', options: [{ name: 'Casa Kolacho', amount: 80, note: '~20 € each · the money stays in the neighbourhood' }] },
      {
        kind: 'activity',
        name: 'The thrill day',
        day: 7,
        chosen: 1,
        options: [
          { name: 'Paragliding, GTOPIK', amount: 315, currency: 'USD', note: '20 min, 70 $ each + transport 35 $ · dropped' },
          { name: 'Sabaneta, Pueblito Paisa, Laureles', amount: 0, note: 'Neighbourhoods day' },
          { name: 'Coffee finca, half day', amount: 312, currency: 'USD', note: '~78 $ each · dropped' },
        ],
      },
      { kind: 'restaurant', name: 'Dinner on La 70 + salsa', day: 7, options: [{ name: 'La 70, then Son Havana', amount: null }] },
      { kind: 'activity', name: 'Spa', day: 8, options: [{ name: 'Spa Bonanova', amount: null }] },
      { kind: 'activity', name: 'Nails, the four of us', day: 8, options: [{ name: 'Momo Beauty Bar, Lalinde', amount: 615000, currency: 'COP', note: 'Gel X, pedi spa, pedicures' }] },
      {
        kind: 'activity',
        name: 'Perfume workshop',
        day: 8,
        chosen: null,
        dropped: true,
        split: ['Djamina', 'Danielle'],
        note: 'Dropped: no perfume this time',
        options: [{ name: 'Iris Alta Perfumería', amount: 580000, currency: 'COP', note: '~290 000 COP each, your own 50 ml' }],
      },
      { kind: 'restaurant', name: 'Dinner at RITWAL', day: 8, options: [{ name: 'RITWAL', amount: null, note: 'Mirador Los Balsos · book' }] },
      { kind: 'transport', name: 'Transfer to the airport', day: 9, note: 'Not in the package', options: [{ name: 'Taxi or van', amount: null, details: { mode: 'car' } }] },
    ],
  },
  {
    name: 'Cartagena',
    country: 'Colombia',
    lat: 10.391,
    lon: -75.4794,
    nights: 5,
    lines: [
      { kind: 'housing', name: 'Hotel Casona del Porvenir', day: 9, endDay: 14, note: 'In the package', booked: 0, options: [{ name: 'Hotel Casona del Porvenir', amount: 0, note: 'In the package', details: { type: 'Hotel', breakfast: true, location: 'El Centro, inside the walls' } }] },
      {
        kind: 'restaurant',
        name: 'Welcome dinner',
        day: 9,
        options: [
          { name: 'Candé', amount: null, note: 'Live folklore' },
          { name: 'La Cevichería', amount: null, note: 'Better for lunch' },
        ],
      },
      { kind: 'activity', name: 'Palacio de la Inquisición', day: 10, options: [{ name: 'Palacio de la Inquisición', amount: 20, note: '~5 € each' }] },
      { kind: 'restaurant', name: 'Birthday brunch', day: 11, options: [{ name: 'Nía Bakery & Cocktails', amount: null }] },
      {
        kind: 'activity',
        name: 'Peggy’s photoshoot',
        day: 11,
        split: ['Djamina', 'Danielle', 'Gabriel'],
        note: 'A surprise for her 50th · golden hour, ~16:45',
        options: [
          { name: 'Fly Dress Colombia', amount: 230, currency: 'USD', favourite: true },
          { name: 'Fly Dress Colombia, bigger package', amount: 310, currency: 'USD' },
          { name: 'Flytographer', amount: 425, currency: 'USD', note: 'From, for 60 min', link: 'https://www.flytographer.com/destinations/cartagena' },
          { name: 'Private photo shoot (Viator)', amount: 90, currency: 'USD', note: 'From, a person, 1 h 30' },
        ],
      },
      { kind: 'restaurant', name: 'Birthday dinner', day: 11, note: '21:00, with the surprise cake', options: [{ name: 'Morena Orígenes', amount: null, note: 'Getsemaní' }] },
      {
        kind: 'activity',
        name: 'Day trip',
        day: 13,
        options: [
          { name: 'San Basilio de Palenque', amount: 440, currency: 'USD', note: 'Black Legacy Experience · 110 $ each' },
          { name: 'Rosario Islands', amount: 260, note: '~65 € each · dropped' },
          { name: 'Volcán del Totumo', amount: 140, note: 'Mud bath · ~35 € each · cancelled' },
        ],
      },
    ],
  },
  {
    name: 'Panama City',
    country: 'Panama',
    lat: 8.9824,
    lon: -79.5199,
    nights: 1,
    lines: [
      { kind: 'housing', name: 'Riande Aeropuerto', day: 14, endDay: 15, note: 'In the package', booked: 0, options: [{ name: 'Riande Aeropuerto', amount: 0, note: 'Room only, free airport shuttle · in the package', details: { type: 'Hotel', breakfast: false, location: 'By the airport' } }] },
      {
        kind: 'activity',
        name: 'The afternoon',
        day: 14,
        options: [
          { name: 'Casco Viejo', amount: 20, currency: 'USD', note: 'Taxi · molas, Geisha coffee, Tántalo rooftop' },
          { name: 'Miraflores locks', amount: 80, note: '~20 € each' },
          { name: 'Albrook mall', amount: 0 },
          { name: 'Rest at the hotel', amount: 0 },
        ],
      },
      { kind: 'restaurant', name: 'Farewell dinner', day: 14, options: [{ name: 'Casco Viejo', amount: null }] },
    ],
  },
]

const FLIGHTS: { from: string; to: string; after: string | null; airline: string; leaves: string; arrives: string; via?: string; fromAirport: string; toAirport: string; stops?: number }[] = [
  { from: 'St Martin', to: 'Bogotá', after: null, airline: 'Copa Airlines', leaves: '12:32', arrives: '17:07', via: 'Panama', fromAirport: 'SXM', toAirport: 'BOG', stops: 1 },
  { from: 'Bogotá', to: 'Medellín', after: 'Bogotá', airline: 'Avianca', leaves: '16:50', arrives: '17:50', fromAirport: 'BOG', toAirport: 'MDE' },
  { from: 'Medellín', to: 'Cartagena', after: 'Medellín', airline: 'Avianca', leaves: '17:40', arrives: '18:55', fromAirport: 'MDE', toAirport: 'CTG' },
  { from: 'Cartagena', to: 'Panama City', after: 'Cartagena', airline: 'Copa Airlines', leaves: '09:45', arrives: '11:07', fromAirport: 'CTG', toAirport: 'PTY' },
  { from: 'Panama City', to: 'St Martin', after: 'Panama City', airline: 'Copa Airlines', leaves: '07:24', arrives: '11:33', fromAirport: 'PTY', toAirport: 'SXM' },
]

const must = <T>(r: { data: T; error: unknown }): T => {
  if (r.error) throw r.error
  return r.data
}

afterAll(async () => {
  await supabase.auth.signOut({ scope: 'local' })
})

it('rebuilds the Colombia & Panama trip in the demo account', async () => {
  const email = process.env.DEMO_USER_EMAIL
  const password = process.env.DEMO_USER_PASSWORD
  if (!email || !password) throw new Error('Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env.local')
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  // Replace our own earlier copy, nothing else.
  const old = must(await supabase.from('trips').select('id').eq('name', NAME).eq('created_by', auth.user.id))
  for (const t of old) must(await supabase.from('trips').delete().eq('id', t.id))

  const tripId = must(
    await supabase.rpc('create_trip', {
      p_name: NAME,
      p_me: 'Djamina',
      p_travellers: ['Peggy', 'Danielle', 'Gabriel'],
      p_start_date: '2026-09-04',
      p_end_date: '2026-09-18',
      p_home_city: 'St Martin',
      p_home_latitude: 18.0425,
      p_home_longitude: -63.0548,
      p_currency: 'EUR',
      p_target_scope: 'per_person',
    }),
  ) as string
  const travellers = must(await supabase.from('travellers').select('id, name').eq('trip_id', tripId))
  const who = (name: string) => travellers.find((t) => t.name === name)!.id

  const placeIds: Record<string, string> = {}
  for (const [i, p] of PLACES.entries()) {
    const row = must(
      await supabase
        .from('places')
        .insert({ trip_id: tripId, name: p.name, country: p.country, latitude: p.lat, longitude: p.lon, nights: p.nights, position: i + 1 })
        .select('id')
        .single(),
    )
    placeIds[p.name] = row.id
  }

  async function addLine(placeId: string | null, line: Line) {
    const itemId = must(
      await supabase.rpc('add_item', {
        p_trip_id: tripId,
        p_kind: line.kind,
        p_name: line.name,
        p_place_id: placeId ?? undefined,
        p_day_number: line.day,
        p_end_day_number: line.endDay,
        p_note: line.note,
      }),
    ) as string
    await addOptions(itemId, line)
    return itemId
  }

  async function addOptions(itemId: string, line: Line) {
    const chosen = line.chosen === undefined ? 0 : line.chosen
    for (const [i, o] of line.options.entries()) {
      must(
        await supabase.from('options').insert({
          trip_id: tripId,
          item_id: itemId,
          name: o.name,
          amount: o.amount,
          currency: o.currency ?? 'EUR',
          rate: o.currency ? RATES[o.currency] : 1,
          details: (o.details ?? {}) as Json,
          link: o.link ?? null,
          note: o.note ?? null,
          is_favourite: o.favourite ?? false,
          is_chosen: i === chosen,
          position: i + 1,
        }),
      )
    }
    if (line.split) {
      must(await supabase.from('item_split_travellers').insert(line.split.map((n) => ({ item_id: itemId, traveller_id: who(n), trip_id: tripId }))))
    }
    if (line.dropped) must(await supabase.rpc('set_item_dropped', { p_item_id: itemId, p_dropped: true }))
    if (line.booked !== undefined) await setItemStatus({ id: itemId, status: 'booked', actualAmount: line.booked, paidBy: null })
  }

  // The package: one line for the whole trip, booked.
  await addLine(null, {
    kind: 'other',
    name: 'Agency package',
    note: 'Flights, hotels, transfers · Djamina paid 1 500 € so far, the rest in 4 payments',
    booked: 10240,
    options: [{ name: 'Agency package', amount: 10240, note: '2 560 € a person, booking fees included' }],
  })

  // The flights: one-way tickets in the route, booked, in the package.
  for (const f of FLIGHTS) {
    const itemId = must(
      await supabase.rpc('add_ticket', {
        p_trip_id: tripId,
        p_from: f.from,
        p_to: f.to,
        p_mode: 'plane',
        p_via: f.via,
        p_after_place_id: f.after ? placeIds[f.after] : undefined,
      }),
    ) as string
    await addOptions(itemId, {
      kind: 'transport',
      name: '',
      booked: 0,
      options: [
        {
          name: f.airline,
          amount: 0,
          note: 'In the package',
          details: {
            mode: 'plane',
            out: { fromAirport: f.fromAirport, toAirport: f.toAirport, leaves: f.leaves, arrives: f.arrives, stops: f.stops ?? 0, via: f.via },
          },
        },
      ],
    })
  }

  for (const p of PLACES) for (const line of p.lines) await addLine(placeIds[p.name], line)

  const budget = must(await supabase.from('v_trip_budget').select('*').eq('trip_id', tripId).single())
  console.log('Colombia & Panama:', tripId, budget)
  expect(Number(budget.confirmed_total)).toBe(10240)
})
