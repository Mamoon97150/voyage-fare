// Trips: create, list, settings, travellers.
import type { Tables } from '../database.types'
import { supabase } from '../supabase'
import { removeTripFiles } from './bookings'

export type Trip = Tables<'trips'>
export type Traveller = Tables<'travellers'>
export type Place = Tables<'places'>

/**
 * A trip on "Your trips" (mockup trips-welcome-v5, 15 Nov): everything its card says, from one
 * database call (trip_cards). Amounts are your share, in the trip's currency.
 */
export type TripCard = Pick<
  Trip,
  'id' | 'name' | 'start_date' | 'end_date' | 'created_at' | 'currency' | 'home_city'
> & {
  places: { id: string; name: string; nights: number }[]
  travellers: { id: string; name: string; me: boolean }[]
  shareConfirmed: number
  shareEstimated: number
  /** The next thing booked with something left to pay by a date. */
  nextDue: { name: string; dueOn: string; left: number } | null
  /** The first line with options compared and none chosen, and how many there are. */
  undecided: { name: string; options: number } | null
  undecidedCount: number
  /** While travelling: today's plans. Null otherwise. */
  today: string[] | null
  /** Who pays whom, for what concerns you. */
  settle: { name: string; amount: number; youPay: boolean }[]
  /** Nobody owes anybody anything on this trip. */
  settled: boolean
}

export type NewTrip = {
  name: string
  me: string
  travellers: string[]
  startDate: string | null
  endDate: string | null
  homeCity: string | null
  homeLatitude: number | null
  homeLongitude: number | null
  currency: string
  targetAmount: number | null
  targetScope: 'per_person' | 'total'
}

/** All in one step in the database: the trip, you, and the other travellers. */
export async function createTrip(trip: NewTrip): Promise<string> {
  const { data, error } = await supabase.rpc('create_trip', {
    p_name: trip.name,
    p_me: trip.me,
    p_travellers: trip.travellers,
    p_start_date: trip.startDate ?? undefined,
    p_end_date: trip.endDate ?? undefined,
    p_home_city: trip.homeCity ?? undefined,
    p_home_latitude: trip.homeLatitude ?? undefined,
    p_home_longitude: trip.homeLongitude ?? undefined,
    p_currency: trip.currency,
    p_target_amount: trip.targetAmount ?? undefined,
    p_target_scope: trip.targetScope,
  })
  if (error) throw error
  return data
}

export async function listTrips(): Promise<TripCard[]> {
  const { data, error } = await supabase.rpc('trip_cards')
  if (error) throw error
  return data.map((t) => {
    const due = t.next_due as { name: string; due_on: string; left: number } | null
    return {
      id: t.id,
      name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
      created_at: t.created_at,
      currency: t.currency,
      home_city: t.home_city,
      places: (t.places ?? []) as TripCard['places'],
      travellers: (t.travellers ?? []) as TripCard['travellers'],
      shareConfirmed: Number(t.share_confirmed ?? 0),
      shareEstimated: Number(t.share_estimated ?? 0),
      nextDue: due ? { name: due.name, dueOn: due.due_on, left: Number(due.left) } : null,
      undecided: t.undecided as TripCard['undecided'],
      undecidedCount: t.undecided_count ?? 0,
      today: t.today ?? null,
      settle: ((t.settle ?? []) as { name: string; amount: number; you_pay: boolean }[]).map((s) => ({
        name: s.name,
        amount: Number(s.amount),
        youPay: s.you_pay,
      })),
      settled: t.settled ?? true,
    }
  })
}

export type TripChange = {
  name: string
  startDate: string | null
  endDate: string | null
  homeCity: string | null
  homeLatitude: number | null
  homeLongitude: number | null
  targetAmount: number | null
  targetScope: 'per_person' | 'total'
}

export async function updateTrip(id: string, change: TripChange): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({
      name: change.name,
      start_date: change.startDate,
      end_date: change.endDate,
      home_city: change.homeCity,
      home_latitude: change.homeLatitude,
      home_longitude: change.homeLongitude,
      target_amount: change.targetAmount,
      target_scope: change.targetScope,
    })
    .eq('id', id)
  if (error) throw error
}

/** Only the person who created a trip can delete it (13 Nov decision). */
export async function isTripOwner(tripId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role === 'owner'
}

export async function deleteTrip(id: string): Promise<void> {
  // Its tickets and vouchers first: Storage doesn't follow the database on its own.
  await removeTripFiles(id).catch(() => {})
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}

export async function addTraveller(tripId: string, name: string, position: number): Promise<void> {
  const { error } = await supabase.from('travellers').insert({ trip_id: tripId, name, position })
  if (error) throw error
}

export async function renameTraveller(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('travellers').update({ name }).eq('id', id)
  if (error) throw error
}

/** Refused with a reason when they paid or owe, are you, are the last one, or are alone on an item. */
export async function removeTraveller(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_traveller', { p_traveller_id: id })
  if (error) throw error
}

/** The public demo trip's id (build 7), or null when there's none. Readable without signing in. */
export async function getDemoTripId(): Promise<string | null> {
  const { data, error } = await supabase.from('trips').select('id').eq('is_demo', true).limit(1).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

/** Start a new trip from this one (build 8 step 3): no dates, nothing booked or paid. */
export async function duplicateTrip(change: {
  tripId: string
  name: string
  travellers: string[]
  allOptions: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_trip', {
    p_trip_id: change.tripId,
    p_name: change.name,
    p_travellers: change.travellers,
    p_all_options: change.allOptions,
  })
  if (error) throw error
  return data
}
