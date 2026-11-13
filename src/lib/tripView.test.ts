import { describe, expect, it } from 'vitest'
import type { Item, TripDetail } from './trips'
import { budgetView, dayLabel, daysText, groupPlaceItems, isSolo, itemLine, tripDays, viewerOf } from './tripView'

const item = (over: Partial<Item>): Item =>
  ({ id: 'i', trip_id: 't', place_id: 'p', kind: 'activity', name: 'x', day_number: null, end_day_number: null, ...over }) as Item

function detail(over: Partial<TripDetail> = {}): TripDetail {
  return {
    trip: { id: 't', start_date: null, end_date: null, target_amount: 700, target_scope: 'per_person', currency: 'EUR' },
    travellers: [
      { id: 'ana', user_id: 'u-ana', name: 'Ana' },
      { id: 'bea', user_id: null, name: 'Bea' },
    ],
    places: [{ id: 'p', nights: 3 }, { id: 'q', nights: 2 }],
    items: [],
    amounts: [
      { item_id: 'gift', current: 150, is_confirmed: true },
      { item_id: 'dinner', current: 90, is_confirmed: false },
      { item_id: 'idea', current: null, is_confirmed: false },
    ],
    shares: [
      { item_id: 'gift', traveller_id: 'bea', fraction: 1 },
      { item_id: 'dinner', traveller_id: 'ana', fraction: 0.5 },
      { item_id: 'dinner', traveller_id: 'bea', fraction: 0.5 },
    ],
    budget: { current_total: 240, confirmed_total: 150, estimated_total: 90, target_total: 1400, missing_amount_count: 1 },
    travellerShares: [{ traveller_id: 'ana', share_current: 45, share_confirmed: null, share_estimated: 45 }],
    placeTotals: [],
    travellerPlaceTotals: [],
    ...over,
  } as unknown as TripDetail
}

describe('who is looking', () => {
  it('finds you by your account', () => {
    expect(viewerOf(detail(), 'u-ana')).toBe('ana')
    expect(viewerOf(detail(), 'someone-else')).toBeNull()
  })

  it('a trip with one traveller is solo', () => {
    expect(isSolo(detail())).toBe(false)
    expect(isSolo(detail({ travellers: [{ id: 'ana' }] as TripDetail['travellers'] }))).toBe(true)
  })
})

describe('an item line', () => {
  it('your share of a shared item, or the whole price', () => {
    expect(itemLine(detail(), item({ id: 'dinner' }), 'ana', 'mine').amount).toBe(45)
    expect(itemLine(detail(), item({ id: 'dinner' }), 'ana', 'total').amount).toBe(90)
  })

  it('an item not split with you (a gift for you) is marked so, not shown as 0', () => {
    const line = itemLine(detail(), item({ id: 'gift' }), 'ana', 'mine')
    expect(line).toMatchObject({ amount: null, concernsViewer: false, priced: true })
  })

  it('no price stays empty (BR-4)', () => {
    expect(itemLine(detail(), item({ id: 'idea' }), 'ana', 'total')).toMatchObject({ amount: null, priced: false })
  })
})

describe('days', () => {
  it('from the dates, else from the nights', () => {
    const d = detail()
    expect(tripDays(d)).toBe(6) // 5 nights
    expect(tripDays({ ...d, trip: { ...d.trip, start_date: '2027-05-12', end_date: '2027-05-24' } })).toBe(13)
    expect(tripDays({ ...d, places: [] })).toBe(0)
  })

  it('labels', () => {
    expect(dayLabel(3, null)).toBe('Day 3')
    expect(dayLabel(3, '2027-05-12')).toBe('Day 3 · Fri 14 May')
    expect(daysText({ day_number: 1, end_day_number: 4 })).toBe('Days 1–4')
    expect(daysText({ day_number: 2, end_day_number: null })).toBe('Day 2')
    expect(daysText({ day_number: null, end_day_number: null })).toBeNull()
  })
})

describe('a place’s items, as in the mockup', () => {
  it('stay first, then day by day, then ideas', () => {
    const groups = groupPlaceItems([
      item({ id: 'a', day_number: 2 }),
      item({ id: 'b' }),
      item({ id: 'c', kind: 'housing', day_number: 1, end_day_number: 4 }),
      item({ id: 'd', day_number: 1 }),
    ])
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Stay', ['c']],
      ['Day 1', ['d']],
      ['Day 2', ['a']],
      ['Ideas, no day yet', ['b']],
    ])
  })
})

describe('the budget bar', () => {
  it('yours: your share against your part of the target', () => {
    expect(budgetView(detail(), 'ana', 'mine')).toEqual({
      figure: 45,
      confirmed: null,
      estimated: 45,
      target: 700,
      difference: -655,
      missing: 1,
    })
  })

  it('a whole-trip target is split for your part', () => {
    const d = detail()
    const v = budgetView({ ...d, trip: { ...d.trip, target_amount: 1000, target_scope: 'total' } }, 'ana', 'mine')
    expect(v.target).toBe(500)
  })

  it('total: the whole trip against the whole target', () => {
    expect(budgetView(detail(), 'ana', 'total')).toMatchObject({ figure: 240, target: 1400, difference: -1160 })
  })

  it('nothing priced: a dash, never 0', () => {
    const v = budgetView(detail({ budget: { current_total: null, target_total: null, missing_amount_count: 0 } as TripDetail['budget'] }), null, 'total')
    expect(v.figure).toBeNull()
    expect(v.difference).toBeNull()
  })
})
