// Trips: create, list, settings, travellers.
import type { Tables } from '../database.types'
import { supabase } from '../supabase'

export type Trip = Tables<'trips'>
export type Traveller = Tables<'travellers'>
export type Place = Tables<'places'>

export type TripSummary = Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date' | 'created_at'> & {
  travellers: number
  places: number
  nights: number
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

export async function listTrips(): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, name, start_date, end_date, created_at, travellers!travellers_trip_id_fkey(id), places!places_trip_id_fkey(nights)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    end_date: t.end_date,
    created_at: t.created_at,
    travellers: t.travellers.length,
    places: t.places.length,
    nights: t.places.reduce((sum, p) => sum + p.nights, 0),
  }))
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
