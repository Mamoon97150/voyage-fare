import { describe, expect, it } from 'vitest'
import { planBooking } from './bookingEmail'
import type { FoundBooking } from './data/ai'
import type { TripDetail } from './trips'

const found = (over: Partial<FoundBooking> = {}): FoundBooking => ({
  is_booking: true,
  kind: 'stay',
  name: null,
  provider: null,
  city: null,
  from: null,
  to: null,
  start_date: null,
  end_date: null,
  price: null,
  currency: null,
  confirmation: null,
  link: null,
  ...over,
})

const item = (over: Record<string, unknown>) => ({
  status: 'chosen',
  kind: 'housing',
  place_id: null,
  package_id: null,
  ...over,
})

const trip = (over: Record<string, unknown> = {}) =>
  ({
    trip: { start_date: '2026-09-01', end_date: '2026-09-20', currency: 'EUR' },
    places: [
      { id: 'ctg', name: 'Cartagena' },
      { id: 'bog', name: 'Bogotá' },
    ],
    items: [
      item({ id: 'casona', name: 'Where we sleep', place_id: 'ctg' }),
      item({ id: 'old', name: 'Casona del Porvenir', place_id: 'ctg', status: 'dropped' }),
      item({ id: 'flight', name: 'Flight', kind: 'transport' }),
      item({ id: 'tour', name: 'Tuk-tuk tour', kind: 'activity', place_id: 'ctg' }),
    ],
    options: [{ id: 'o1', item_id: 'casona', name: 'Hotel Casona del Porvenir', is_chosen: true }],
    legs: [{ item_id: 'flight', from_name: 'Bogotá', to_name: 'Cartagena' }],
    ...over,
  }) as unknown as TripDetail

describe('which line a booking email goes on', () => {
  it('by an option’s name, never a dropped line', () => {
    const plan = planBooking(trip(), found({ name: 'Hotel Casona del Porvenir', city: 'Cartagena' }))
    expect(plan.match?.id).toBe('casona')
    expect(plan.choices.map((c) => c.id)).not.toContain('old')
  })

  it('a flight by its route', () => {
    const plan = planBooking(trip(), found({ kind: 'transport', provider: 'Avianca', from: 'Bogota', to: 'Cartagena' }))
    expect(plan.match?.id).toBe('flight')
  })

  it('nothing alike: a new line, in the city’s place, on the day of the trip', () => {
    const plan = planBooking(
      trip(),
      found({ kind: 'activity', name: 'Rosario Islands', city: 'Cartagena', start_date: '2026-09-11' }),
    )
    expect(plan).toMatchObject({
      match: null,
      name: 'Rosario Islands',
      kind: 'activity',
      placeId: 'ctg',
      dayNumber: 11,
    })
  })

  it('dates outside the trip: a note', () => {
    const plan = planBooking(trip(), found({ kind: 'activity', name: 'Museum', start_date: '2027-01-03' }))
    expect(plan.notes[0]).toMatch(/aren’t within the trip’s dates/)
    expect(plan.dayNumber).toBeNull()
  })
})
