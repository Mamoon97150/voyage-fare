// A trip on "Your trips", for the tests: everything empty unless given.
import type { TripCard } from '../lib/trips'

export const card = (over: Partial<TripCard> = {}): TripCard => ({
  id: 't',
  name: 'Trip',
  start_date: null,
  end_date: null,
  created_at: '2026-11-01T00:00:00Z',
  currency: 'EUR',
  home_city: null,
  places: [],
  travellers: [{ id: 'a', name: 'Djamina', me: true }],
  shareConfirmed: 0,
  shareEstimated: 0,
  nextDue: null,
  undecided: null,
  undecidedCount: 0,
  today: null,
  settle: [],
  settled: true,
  ...over,
})
