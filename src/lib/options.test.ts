import { describe, expect, it } from 'vitest'
import {
  formatMinutes,
  journeyMinutes,
  nextDay,
  optionLines,
  subjectsFor,
  tabToDecide,
  wayMinutes,
} from './options'
import type { Item, TripDetail, TripOption } from './trips'

const option = (over: Partial<TripOption>): TripOption =>
  ({ id: 'o', item_id: 'f', trip_id: 't', name: 'x', amount: 100, currency: 'EUR', rate: 1, is_chosen: false, is_favourite: false, details: {}, position: 0, ...over }) as TripOption
const item = (over: Partial<Item>): Item =>
  ({ id: 'i', trip_id: 't', place_id: null, kind: 'transport', name: 'x', status: 'idea', day_number: null, end_day_number: null, position: 0, ...over }) as Item

describe('durations, from the times', () => {
  it('same day, next day, missing', () => {
    expect(wayMinutes({ leaves: '13:05', arrives: '19:25' })).toBe(380)
    expect(wayMinutes({ leaves: '19:00', arrives: '08:30' })).toBe(810) // night bus, arrives the next day
    expect(nextDay({ leaves: '19:00', arrives: '08:30' })).toBe(true)
    expect(wayMinutes({ leaves: '13:05' })).toBeNull()
    expect(formatMinutes(380)).toBe('6 h 20')
    expect(formatMinutes(70)).toBe('1 h 10')
    expect(formatMinutes(45)).toBe('45 min')
  })

  it('a round trip adds both ways; a missing time means no total', () => {
    const d = { out: { leaves: '13:05', arrives: '19:25' }, back: { leaves: '08:40', arrives: '15:45' } }
    expect(journeyMinutes(d, true)).toBe(380 + 425)
    expect(journeyMinutes(d, false)).toBe(380)
    expect(journeyMinutes({ out: d.out }, true)).toBeNull()
  })
})

function trip(over: Partial<TripDetail> = {}): TripDetail {
  return {
    trip: { id: 't', currency: 'COP', home_city: 'St Martin' },
    travellers: [
      { id: 'ana', user_id: 'u' },
      { id: 'bea', user_id: null },
      { id: 'cleo', user_id: null },
    ],
    places: [
      { id: 'c', name: 'Cartagena', nights: 4, position: 1 },
      { id: 'm', name: 'Medellín', nights: 3, position: 2 },
    ],
    items: [],
    options: [],
    legs: [],
    amounts: [],
    shares: [],
    ...over,
  } as unknown as TripDetail
}

describe('options side by side', () => {
  const flights = item({ id: 'f', name: 'St Martin ⇄ Cartagena' })
  const detail = trip({
    items: [flights],
    legs: [
      { item_id: 'f', leg_number: 1, after_place_id: null, position: 0 },
      { item_id: 'f', leg_number: 2, after_place_id: 'm', position: 1 },
    ] as TripDetail['legs'],
    options: [
      option({ id: 'avianca', amount: 1470, rate: 3900, details: { out: { leaves: '07:10', arrives: '16:50' }, back: { leaves: '11:30', arrives: '20:25' } } }),
      option({ id: 'copa', amount: 1560, rate: 3900, details: { out: { leaves: '13:05', arrives: '19:25' }, back: { leaves: '08:40', arrives: '15:45' } } }),
      option({ id: 'idea', amount: null, details: {} }),
    ],
    shares: [
      { item_id: 'f', traveller_id: 'ana', fraction: 1 / 3 },
      { item_id: 'f', traveller_id: 'bea', fraction: 1 / 3 },
      { item_id: 'f', traveller_id: 'cleo', fraction: 1 / 3 },
    ] as TripDetail['shares'],
  })

  it('your share in the trip currency, the gap to the cheapest, the tags', () => {
    const lines = optionLines(detail, flights, 'ana', 'mine')
    expect(lines.map((l) => [l.option.id, l.share, l.more, l.cheapest, l.fastest])).toEqual([
      ['avianca', 1911000, 0, true, false],
      ['copa', 2028000, 117000, false, true],
      ['idea', null, null, false, false], // no price: last, a dash
    ])
  })

  it('sorted by speed: the fastest first, the untimed last', () => {
    expect(optionLines(detail, flights, 'ana', 'mine', 'fastest').map((l) => l.option.id)).toEqual(['copa', 'avianca', 'idea'])
  })

  it('total: the whole price', () => {
    expect(optionLines(detail, flights, 'ana', 'total')[0].share).toBe(5733000)
  })
})

describe('Compare’s pages', () => {
  const flights = item({ id: 'f', name: 'St Martin ⇄ Cartagena' })
  const bus = item({ id: 'b', name: 'Cartagena → Medellín' })
  const insurance = item({ id: 'ins', kind: 'insurance' })
  const stayC = item({ id: 'sc', kind: 'housing', place_id: 'c', name: 'Casa Lola' })
  const ferry = item({ id: 'fe', kind: 'transport', place_id: 'c', name: 'Ferry to the islands' })
  const detail = trip({
    items: [bus, flights, insurance, stayC, ferry],
    legs: [
      { item_id: 'f', leg_number: 1, after_place_id: null, position: 0 },
      { item_id: 'b', leg_number: 1, after_place_id: 'c', position: 0 },
      { item_id: 'f', leg_number: 2, after_place_id: 'm', position: 1 },
    ] as TripDetail['legs'],
    options: [option({ item_id: 'sc', is_chosen: true })],
  })

  it('Travel: one page per journey, in route order', () => {
    expect(subjectsFor(detail, 'travel').map((s) => [s.title, s.note])).toEqual([
      ['St Martin ⇄ Cartagena', 'Round trip'],
      ['Cartagena → Medellín', 'One way'],
    ])
  })

  it('Stay: one page per place, empty ones included', () => {
    expect(subjectsFor(detail, 'stay').map((s) => [s.title, s.items.map((i) => i.id)])).toEqual([
      ['Cartagena', ['sc']],
      ['Medellín', []],
    ])
  })

  it('a ferry inside a place is “Around”, not Travel', () => {
    expect(subjectsFor(detail, 'around')[0].items.map((i) => i.id)).toEqual(['fe'])
  })

  it('a dot where something is still to decide', () => {
    expect(tabToDecide(detail, 'travel')).toBe(true) // no option chosen for the tickets
    expect(tabToDecide(detail, 'stay')).toBe(false) // Casa Lola is chosen
  })
})
