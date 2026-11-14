// The app's real queries, against the real Supabase project, as the demo user (review 13 Nov, #5).
// The screen tests use fake data and the database tests a Postgres in memory: this checks the
// layer in between (the "two links between trips and travellers" bug would have failed here).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import {
  addItem,
  addOption,
  addRepayment,
  addPlace,
  addTicket,
  acceptInvitation,
  addTraveller,
  cancelInvitation,
  chooseOption,
  createTrip,
  deleteItem,
  deleteOption,
  deleteRepayment,
  deletePlace,
  deleteTrip,
  getInvitationPreview,
  getMoney,
  getTrip,
  inviteTraveller,
  isTripOwner,
  leaveTrip,
  listOpenInvitations,
  listTrips,
  removeTraveller,
  renameTraveller,
  setFavourite,
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
  // Only this test's session: the default ('global') would also sign the demo user out of the browser.
  await supabase.auth.signOut({ scope: 'local' })
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
    // Build 4: the money side loads, and a repayment goes in and out.
    const money = await getMoney(tripId)
    expect(money.balances).toHaveLength(2)
    const [me, bea] = detail?.travellers ?? []
    await addRepayment({ tripId, from: bea.id, to: me.id, amount: 10, paidOn: '2026-11-13' })
    const after = await getMoney(tripId)
    expect(after.repayments).toHaveLength(1)
    expect(Number(after.balances.find((b) => b.traveller_id === me.id)?.balance)).toBe(-10)
    await deleteRepayment(after.repayments[0].id)
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

  it('options: compare, choose, coup de cœur, and the item keeps its price', async () => {
    const place = await addPlace({ tripId, name: 'Porto', country: 'Portugal', latitude: 41.1, longitude: -8.6, nights: 2, position: 2 })
    const stay = await addItem({ tripId, placeId: place.id, kind: 'housing', name: 'Stay in Porto', dayNumber: null, endDayNumber: null, amount: 300 })
    let detail = (await getTrip(tripId))!
    const other = await addOption(detail, stay, { name: 'Ribeira hotel', amount: 260, details: { looks: 4 }, link: null, note: 'by the river' })
    detail = (await getTrip(tripId))!
    expect(detail.options.filter((o) => o.item_id === stay)).toHaveLength(2)
    expect(detail.options.find((o) => o.id === other)?.is_chosen).toBe(false) // the second waits to be chosen

    const before = Number(detail.budget?.current_total)
    await chooseOption(other)
    await setFavourite(other, true)
    detail = (await getTrip(tripId))!
    expect(Number(detail.budget?.current_total)).toBe(before - 40)
    expect(detail.options.filter((o) => o.item_id === stay && o.is_chosen).map((o) => o.id)).toEqual([other])
    expect(detail.options.find((o) => o.id === other)?.is_favourite).toBe(true)

    await updateItem({ id: stay, kind: 'housing', name: 'Porto', dayNumber: null, endDayNumber: null, amount: null, keepPrice: true })
    detail = (await getTrip(tripId))!
    expect(detail.options.filter((o) => o.item_id === stay)).toHaveLength(2) // nothing lost
    expect(Number(detail.budget?.current_total)).toBe(before - 40)

    await deleteOption(other)
    detail = (await getTrip(tripId))!
    expect(detail.items.find((i) => i.id === stay)?.status).toBe('idea') // the chosen one went
    await deletePlace(place.id)
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

  it('invitations: a link for Bea, the same again, then cancelled', async () => {
    const bea = (await getTrip(tripId))!.travellers.find((t) => t.name === 'Bea')!
    const { token } = await inviteTraveller(bea.id)
    expect((await inviteTraveller(bea.id)).token).toBe(token)
    expect((await listOpenInvitations(tripId)).map((i) => i.traveller_id)).toEqual([bea.id])
    expect(await getInvitationPreview(token)).toEqual(
      expect.objectContaining({ trip_id: tripId, traveller_name: 'Bea', invited_by_name: 'Demo', state: 'open' }),
    )
    // The demo user is already Demo on this trip.
    await expect(acceptInvitation(token)).rejects.toMatchObject({ code: 'P0001' })
    await expect(leaveTrip(tripId)).rejects.toMatchObject({ code: 'P0001' }) // the creator can't leave
    await cancelInvitation(bea.id)
    expect((await getInvitationPreview(token))?.state).toBe('cancelled')
    expect(await listOpenInvitations(tripId)).toEqual([])
    expect(await getInvitationPreview('nope')).toBeNull()
  })

  it('deleting the trip removes it from the list', async () => {
    await deleteTrip(tripId)
    expect((await listTrips()).some((t) => t.id === tripId)).toBe(false)
    expect(await getTrip(tripId)).toBeNull()
    tripId = ''
  })
})
