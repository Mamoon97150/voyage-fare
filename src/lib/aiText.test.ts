import { describe, expect, it } from 'vitest'
import { AI_QUESTIONS, aiTextSize, tripForAi } from './aiText'
import type { TripDetail } from './trips'

const plain = (s: string) => s.replace(/[  ]/g, ' ')

const item = (over: Record<string, unknown>) => ({
  id: 'i',
  trip_id: 't1',
  place_id: null,
  kind: 'activity',
  name: 'Item',
  status: 'chosen',
  day_number: null,
  end_day_number: null,
  position: 1,
  note: null,
  link: null,
  meal: null,
  verdict: null,
  package_id: null,
  paid_by: null,
  paid_each: false,
  paid_on: null,
  due_on: null,
  category: 'activities',
  actual_amount: null,
  actual_currency: null,
  actual_rate: 1,
  latitude: null,
  longitude: null,
  location_name: null,
  created_at: '',
  ...over,
})

const option = (over: Record<string, unknown>) => ({
  id: 'o',
  trip_id: 't1',
  item_id: 'i',
  name: 'Option',
  amount: 100,
  currency: 'EUR',
  rate: 1,
  rate_is_manual: false,
  is_chosen: true,
  is_favourite: false,
  position: 1,
  note: null,
  link: null,
  details: {},
  latitude: null,
  longitude: null,
  location_name: null,
  created_at: '',
  ...over,
})

const colombia = {
  trip: {
    id: 't1',
    name: 'Colombia & Panama',
    start_date: '2026-09-04',
    end_date: '2026-09-18',
    home_city: 'St Martin',
    currency: 'EUR',
    target_amount: null,
    target_scope: 'per_person',
    created_by: 'u',
    is_demo: false,
  },
  travellers: [
    { id: 'a', name: 'Ana', user_id: 'u' },
    { id: 'b', name: 'Bea', user_id: null },
    { id: 'c', name: 'Cleo', user_id: null },
  ],
  places: [
    { id: 'bog', name: 'Bogotá', nights: 2, position: 1 },
    { id: 'med', name: 'Medellín', nights: 4, position: 2 },
  ],
  items: [
    item({ id: 'fly', kind: 'transport', name: 'St Martin → Bogotá', status: 'booked', package_id: 'pkg' }),
    item({ id: 'pkg', kind: 'package', name: 'Frégate Agency package', status: 'paid', paid_by: 'a' }),
    item({ id: 'hy', place_id: 'bog', kind: 'housing', name: 'Grand Hyatt', status: 'booked', package_id: 'pkg' }),
    item({
      id: 'din',
      place_id: 'bog',
      kind: 'restaurant',
      name: 'First dinner',
      status: 'paid',
      day_number: 1,
      meal: 'dinner',
      paid_by: 'b',
    }),
    item({ id: 'thr', place_id: 'med', name: 'The thrill day', day_number: 7 }),
    item({ id: 'spa', place_id: 'med', name: 'Spa', status: 'paid', day_number: 8, paid_each: true }),
    item({ id: 'boat', place_id: 'med', name: 'Boat tour', status: 'idea' }),
    item({
      id: 'car',
      place_id: 'med',
      kind: 'restaurant',
      name: 'Carmen',
      status: 'idea',
      link: 'https://www.instagram.com/carmen/',
      note: 'the tasting menu',
    }),
    item({ id: 'old', place_id: 'med', name: 'Dropped idea', status: 'dropped', day_number: 6 }),
  ],
  options: [
    option({ id: 'o1', item_id: 'fly', name: 'Copa Airlines', amount: 0 }),
    option({ id: 'o2', item_id: 'pkg', name: 'Frégate Agency package', amount: 10240 }),
    option({ id: 'o3', item_id: 'hy', name: 'Grand Hyatt', amount: 0 }),
    option({ id: 'o4', item_id: 'din', name: 'At the hotel', amount: 317921, currency: 'COP', rate: 0.000255 }),
    option({ id: 'o5', item_id: 'thr', name: 'Sabaneta', amount: 0, is_favourite: true }),
    option({
      id: 'o6',
      item_id: 'thr',
      name: 'Paragliding',
      amount: 315,
      currency: 'USD',
      rate: 0.9,
      is_chosen: false,
      position: 2,
    }),
    option({ id: 'o7', item_id: 'spa', name: 'Spa Bonanova', amount: null }),
    option({ id: 'o8', item_id: 'boat', name: 'Boat A', amount: 60, is_chosen: false }),
    option({ id: 'o9', item_id: 'boat', name: 'Boat B', amount: 80, is_chosen: false, position: 2 }),
    option({ id: 'o10', item_id: 'car', name: 'Carmen', amount: 285, is_chosen: false }),
  ],
  legs: [
    {
      id: 'l1',
      item_id: 'fly',
      trip_id: 't1',
      leg_number: 1,
      from_name: 'St Martin',
      to_name: 'Bogotá',
      mode: 'plane',
      after_place_id: null,
      position: 1,
      day_number: 1,
      travel_date: null,
      via: null,
    },
  ],
  amounts: [],
  shares: [
    { item_id: 'spa', traveller_id: 'a', fraction: 0.5 },
    { item_id: 'spa', traveller_id: 'c', fraction: 0.5 },
  ],
  budget: {
    current_total: 13807,
    confirmed_total: 13700,
    estimated_total: 107,
    target_total: null,
    missing_amount_count: 1,
  },
  travellerShares: [{ traveller_id: 'a', share_current: 3452, share_confirmed: 3428, share_estimated: 24.6 }],
  placeTotals: [],
  travellerPlaceTotals: [],
  rooms: [],
  roomOccupants: [],
  dailyEstimates: [],
  estimatePeople: [],
  estimateChecks: [],
  payments: [],
  itemLeft: [],
} as unknown as TripDetail

const money = {
  categories: [],
  travellerCategories: [],
  balances: [],
  repayments: [],
  settlement: [{ from_traveller: 'b', to_traveller: 'a', amount: 354.2 }],
}

const text = (o: Partial<Parameters<typeof tripForAi>[1]> = {}) =>
  plain(tripForAi(colombia, { whoPaid: true, realNames: true, viewer: 'a', money, today: '15 Nov 2026', ...o }))

describe('copy the trip for my AI', () => {
  it('the trip, who, the currency, how to read statuses, the budget', () => {
    const t = text()
    expect(t).toContain('# Colombia & Panama')
    expect(t).toContain('4 – 18 Sept 2026 · 6 nights · from St Martin, back to St Martin')
    expect(t).toContain('Travellers: Ana (me), Bea, Cleo')
    expect(t).toContain('“In the package” = covered by Frégate Agency package.')
    expect(t).toContain('Budget, my share: 3 452 € · 3 428 € confirmed · 25 € still estimated')
    expect(t).toContain('Whole trip: 13 807 € · 1 line with no price yet')
  })

  it('tickets first, then each place in order with its stay and its days', () => {
    const t = text()
    expect(t).toContain(
      '## Getting there and around\n- St Martin → Bogotá · plane · Copa Airlines · in the package · booked',
    )
    expect(t).toContain('## 1. Bogotá — 2 nights (4 – 6 Sept)\n- Stay · Grand Hyatt · in the package · booked')
    expect(t).toContain('- Day 1 · dinner · First dinner: At the hotel · 317 921 COP (≈ 81 €) · paid by Bea')
    expect(t.indexOf('## 1. Bogotá')).toBeLessThan(t.indexOf('## 2. Medellín'))
  })

  it('options still compared, favourites, who it’s for, each paid their own; dropped lines left out', () => {
    const t = text()
    expect(t).toContain(
      '- Day 7 · The thrill day: Sabaneta · free · chosen\n    other options: Paragliding · 315 $ (≈ 284 €)',
    )
    expect(t).toContain('Spa: Spa Bonanova · no price yet · paid, each their own · for Ana, Cleo')
    expect(t).toContain(
      '- Idea, no day yet · Boat tour · still deciding between 2 options\n    options: Boat A · 60 € — Boat B · 80 €',
    )
    expect(t).not.toContain('Dropped idea')
  })

  it('To try apart, then what’s left, who owes whom, the date, the question', () => {
    const t = text({ question: AI_QUESTIONS[0].text })
    expect(t).toContain(
      '## To try (restaurants and activities kept for later, not counted yet)\n- Medellín: Carmen · Instagram, @carmen · “the tasting menu” · ≈ 95 € each',
    )
    expect(t).toContain('- 1 decision left: Boat tour (2 options)')
    expect(t).toContain('## Who owes whom\n- Bea pays Ana 354 €')
    expect(t).toContain('Copied from Voyage Fare (voyagefare.app) on 15 Nov 2026.')
    expect(t.endsWith('Question: What’s left to book, and what should I book first?')).toBe(true)
  })

  it('Real names off: Traveller A, B, C; Who paid what off: no payers, no balances', () => {
    const t = text({ realNames: false, whoPaid: false })
    expect(t).toContain('Travellers: Traveller A (me), Traveller B, Traveller C')
    expect(t).toContain('for Traveller A, Traveller C')
    expect(t).not.toMatch(/Ana|Bea|Cleo/)
    expect(t).not.toContain('paid by')
    expect(t).not.toContain('Who owes whom')
  })

  it('how long it is', () => {
    expect(aiTextSize('a\nb\nc')).toBe('≈ 1 page · 3 lines')
  })
})
