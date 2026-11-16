import { describe, expect, it } from 'vitest'
import {
  aroundName,
  detailsFor,
  detailsText,
  eachOf,
  mealsLeft,
  needsStay,
  NO_DETAILS,
  rentalDays,
  totalOf,
} from './itemDetails'
import type { Item } from './trips'

const item = (over: Partial<Item>) =>
  ({
    id: 'i',
    place_id: 'p1',
    kind: 'activity',
    name: 'X',
    status: 'idea',
    day_number: 2,
    ...NO_DETAILS,
    ...over,
  }) as unknown as Item

describe('details by kind', () => {
  it('per person, to the cent, and back', () => {
    expect(totalOf(25, 3)).toBe(75)
    expect(eachOf(100, 3)).toBe(33.33)
  })

  it('a rental from day 9 to day 12 is 4 days', () => {
    expect(rentalDays(9, 12)).toBe(4)
    expect(rentalDays(9, null)).toBe(1)
    expect(rentalDays(null, null)).toBeNull()
  })

  it('getting around is named from its mode and route', () => {
    expect(aroundName('ferry', 'Naha', 'Zamami')).toBe('Ferry Naha → Zamami')
    expect(aroundName(null, '', '')).toBe('Getting around')
  })

  it('changing what a line is clears the other kinds’ answers', () => {
    const d = { ...NO_DETAILS, deposit: 300, food_kind: 'tapas', needs_booking: true, price_per_person: true }
    expect(detailsFor('restaurant', true, d)).toMatchObject({ deposit: null, food_kind: 'tapas', needs_booking: true })
    expect(detailsFor('car_rental', true, d)).toMatchObject({
      deposit: 300,
      food_kind: null,
      needs_booking: null,
      price_per_person: false,
    })
  })

  it('reads back under the name', () => {
    expect(
      detailsText(
        item({ start_time: '07:00:00', duration: '2 h', needs_booking: true, price_per_person: true }),
        'EUR',
      ),
    ).toEqual(['07:00', '2 h', 'per person', 'book ahead'])
    expect(
      detailsText(
        item({ kind: 'car_rental', from_place: 'Naha', to_place: 'Naha', deposit: 300, insurance_included: false }),
        'EUR',
      ),
    ).toEqual(['Naha', 'no insurance', expect.stringMatching(/^deposit 300\s€ \(held\)$/)])
  })

  it('three meals set: nothing left for “Where we eat”', () => {
    const r = (meal: string, over: Partial<Item> = {}) => item({ kind: 'restaurant', meal, ...over })
    expect(mealsLeft([r('breakfast'), r('dinner')], 'p1', 2)).toEqual(['lunch'])
    expect(mealsLeft([r('breakfast'), r('lunch'), r('dinner')], 'p1', 2)).toEqual([])
    expect(mealsLeft([r('breakfast'), r('lunch'), r('dinner', { status: 'dropped' })], 'p1', 2)).toEqual(['dinner'])
  })

  it('a place with nights and no stay needs one', () => {
    expect(needsStay([], 'p1', 3)).toBe(true)
    expect(needsStay([], 'p1', 0)).toBe(false)
    expect(needsStay([item({ kind: 'housing' })], 'p1', 3)).toBe(false)
  })
})
