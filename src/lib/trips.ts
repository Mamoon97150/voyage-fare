import type { Tables } from './database.types'
import { supabase } from './supabase'

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

export type Item = Tables<'items'>
export type ItemAmount = Tables<'v_item_amounts'>
export type ItemShare = Tables<'v_item_shares'>
export type TripBudget = Tables<'v_trip_budget'>
export type TravellerShare = Tables<'v_traveller_shares'>
export type PlaceTotal = Tables<'v_budget_by_place'>
export type TravellerPlaceTotal = Tables<'v_traveller_by_place'>

export type TripDetail = {
  trip: Trip
  travellers: Traveller[]
  places: Place[]
  items: Item[]
  amounts: ItemAmount[]
  shares: ItemShare[]
  budget: TripBudget | null
  travellerShares: TravellerShare[]
  placeTotals: PlaceTotal[]
  travellerPlaceTotals: TravellerPlaceTotal[]
}

/** null when the trip doesn't exist or isn't shared with this person (privacy hides both the same way). */
export async function getTrip(id: string): Promise<TripDetail | null> {
  const [trip, travellers, places, items, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals] =
    await Promise.all([
      supabase.from('trips').select('*').eq('id', id).maybeSingle(),
      supabase.from('travellers').select('*').eq('trip_id', id).order('position'),
      supabase.from('places').select('*').eq('trip_id', id).order('position'),
      supabase.from('items').select('*').eq('trip_id', id).order('position'),
      supabase.from('v_item_amounts').select('*').eq('trip_id', id),
      supabase.from('v_item_shares').select('*').eq('trip_id', id),
      supabase.from('v_trip_budget').select('*').eq('trip_id', id).maybeSingle(),
      supabase.from('v_traveller_shares').select('*').eq('trip_id', id),
      supabase.from('v_budget_by_place').select('*').eq('trip_id', id),
      supabase.from('v_traveller_by_place').select('*').eq('trip_id', id),
    ])
  for (const r of [trip, travellers, places, items, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals]) {
    if (r.error) throw r.error
  }
  if (!trip.data) return null
  return {
    trip: trip.data,
    travellers: travellers.data ?? [],
    places: places.data ?? [],
    items: items.data ?? [],
    amounts: amounts.data ?? [],
    shares: shares.data ?? [],
    budget: budget.data,
    travellerShares: travellerShares.data ?? [],
    placeTotals: placeTotals.data ?? [],
    travellerPlaceTotals: travellerPlaceTotals.data ?? [],
  }
}

export type ItemKind = 'transport' | 'housing' | 'activity' | 'restaurant' | 'car_rental' | 'insurance' | 'other'

/** One step in the database: the item, and with a price its single chosen option. */
export async function addItem(item: {
  tripId: string
  placeId: string | null
  kind: ItemKind
  name: string
  dayNumber: number | null
  endDayNumber: number | null
  amount: number | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_item', {
    p_trip_id: item.tripId,
    p_kind: item.kind,
    p_name: item.name,
    p_place_id: item.placeId ?? undefined,
    p_day_number: item.dayNumber ?? undefined,
    p_end_day_number: item.endDayNumber ?? undefined,
    p_amount: item.amount ?? undefined,
  })
  if (error) throw error
  return data
}

export async function addPlace(place: {
  tripId: string
  name: string
  country: string | null
  latitude: number | null
  longitude: number | null
  nights: number
  position: number
}): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .insert({
      trip_id: place.tripId,
      name: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      nights: place.nights,
      position: place.position,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
