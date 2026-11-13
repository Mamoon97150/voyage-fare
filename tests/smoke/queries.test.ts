// The app's real queries, against the real Supabase project, as the demo user (review 13 Nov, #5).
// The screen tests use fake data and the database tests a Postgres in memory: this checks the
// layer in between (the "two links between trips and travellers" bug would have failed here).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import {
  addItem,
  addPlace,
  addTicket,
  addTraveller,
  createTrip,
  deleteItem,
  deletePlace,
  deleteTrip,
  getTrip,
  getTripHeader,
  isTripOwner,
  listTrips,
  removeTraveller,
  renameTraveller,
  updateItem,
  updatePlace,
  updateTicket,
  updateTrip,
} from '../../src/lib/trips'

const email = process.env.DEMO_USER_EMAIL
const password = process.env.DEMO_USER_PASSWORD
let userId = ''
let tripId = ''

beforeAll(async () => {
  if (!email || !password) throw new Error('Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env.local')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  userId = data.user.id
})

afterAll(async () => {
  // Always clean up, even when a step failed.
  if (tripId) await deleteTrip(tripId).catch(() => {})
  await supabase.auth.signOut()
})

describe('the real queries, end to end', () => {
  it('create a trip, find it in the list, open it', async () => {
    tripId = await createTrip({
      name: `Smoke test ${new Date().toISOString()}`,
      me: 'Demo',
      travellers: ['Bea'],
      startDate: null,
      endDate: null,
      homeCity: 'St Martin',
      homeLatitude: 18.07,
      homeLongitude: -63.05,
      currency: 'EUR',
      targetAmount: 1000,
      targetScope: 'per_person',
    })
    expect((await listTrips()).some((t) => t.id === tripId)).toBe(true)
    const detail = await getTrip(tripId)
    expect(detail?.travellers.map((t) => t.name)).toEqual(['Demo', 'Bea'])
    expect(await getTripHeader(tripId)).toEqual(expect.objectContaining({ travellers: 2 }))
    expect(await isTripOwner(tripId, userId)).toBe(true)
  })

  it('places, items and tickets: add, change, and the budget follows', async () => {
    const place = await addPlace({ tripId, name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, nights: 3, position: 1 })
    await updatePlace(place.id, { name: 'Lisboa', nights: 4 })

    const stay = await addItem({ tripId, placeId: place.id, kind: 'housing', name: 'Flat', dayNumber: 1, endDayNumber: 4, amount: 400 })
    await updateItem({ id: stay, kind: 'housing', name: 'Alfama flat', dayNumber: 1, endDayNumber: 4, amount: 450 })
    const ticket = await addTicket({
      tripId,
      from: 'St Martin',
      to: 'Lisboa',
      mode: 'plane',
      name: null,
      via: 'Paris',
      afterPlaceId: null,
      roundTrip: true,
      returnAfterPlaceId: place.id,
      amount: 1200,
    })
    await updateTicket(ticket, {
      from: 'St Martin',
      to: 'Lisboa',
      mode: 'plane',
      via: null,
      afterPlaceId: null,
      roundTrip: true,
      returnAfterPlaceId: place.id,
      amount: 1100,
    })

    const detail = await getTrip(tripId)
    expect(detail?.places[0]).toEqual(expect.objectContaining({ name: 'Lisboa', nights: 4 }))
    expect(detail?.legs).toHaveLength(2)
    expect(Number(detail?.budget?.current_total)).toBe(1550) // 450 + 1 100, the round trip once
    const mine = detail?.travellers.find((t) => t.user_id === userId)
    expect(Number(detail?.travellerShares.find((s) => s.traveller_id === mine?.id)?.share_current)).toBe(775)
    expect(detail?.travellerPlaceTotals.length).toBeGreaterThan(0)

    await deleteItem(stay)
    await deletePlace(place.id)
    const after = await getTrip(tripId)
    expect(after?.places).toHaveLength(0)
    expect(after?.legs.every((l) => l.after_place_id === null)).toBe(true) // the way back moved up
  })

  it('settings: the trip and its travellers', async () => {
    await updateTrip(tripId, {
      name: 'Smoke test (renamed)',
      startDate: '2027-05-12',
      endDate: '2027-05-20',
      homeCity: 'St Martin',
      homeLatitude: 18.07,
      homeLongitude: -63.05,
      targetAmount: 2000,
      targetScope: 'total',
    })
    await addTraveller(tripId, 'Cleo', 5)
    let detail = await getTrip(tripId)
    const cleo = detail!.travellers.find((t) => t.name === 'Cleo')!
    await renameTraveller(cleo.id, 'Cléo')
    await removeTraveller(cleo.id)
    const me = detail!.travellers.find((t) => t.user_id === userId)!
    await expect(removeTraveller(me.id)).rejects.toMatchObject({ code: 'P0001' })
    detail = await getTrip(tripId)
    expect(detail?.trip).toEqual(expect.objectContaining({ name: 'Smoke test (renamed)', target_scope: 'total' }))
    expect(detail?.travellers.map((t) => t.name)).toEqual(['Demo', 'Bea'])
  })

  it('deleting the trip removes it from the list', async () => {
    await deleteTrip(tripId)
    expect((await listTrips()).some((t) => t.id === tripId)).toBe(false)
    expect(await getTrip(tripId)).toBeNull()
    tripId = ''
  })
})
