// Reading a whole trip (the trip page, Compare, Budget…) and its row types.
import type { Tables } from '../database.types'
import { supabase } from '../supabase'
import type { Trip, Traveller, Place } from './trips'

export type Item = Tables<'items'>
export type TripOption = Tables<'options'>
export type Room = Tables<'rooms'>
export type RoomOccupant = Tables<'room_occupants'>
export type Leg = Tables<'item_legs'>
export type ItemAmount = Tables<'v_item_amounts'>
export type DailyEstimate = Tables<'daily_estimates'>
export type EstimatePeople = Tables<'v_daily_estimate_people'>
export type EstimateCheck = Tables<'v_daily_estimate_checks'>
export type Payment = Tables<'payments'>
export type ItemLeft = Tables<'v_item_left'>
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
  options: TripOption[]
  legs: Leg[]
  amounts: ItemAmount[]
  shares: ItemShare[]
  budget: TripBudget | null
  travellerShares: TravellerShare[]
  placeTotals: PlaceTotal[]
  travellerPlaceTotals: TravellerPlaceTotal[]
  /** A stay's option by room (SR-4): each room, and who sleeps in it. */
  rooms: Room[]
  roomOccupants: RoomOccupant[]
  /** Daily estimates (build 6), who they're for, and whether their days still fit. */
  dailyEstimates: DailyEstimate[]
  estimatePeople: EstimatePeople[]
  estimateChecks: EstimateCheck[]
  /** Payments in parts (build 6) and, per booked line, paid so far / left to pay. */
  payments: Payment[]
  itemLeft: ItemLeft[]
}

/** null when the trip doesn't exist or isn't shared with this person (privacy hides both the same way). */
export async function getTrip(id: string): Promise<TripDetail | null> {
  const [trip, travellers, places, items, options, legs, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals, rooms, roomOccupants, dailyEstimates, estimatePeople, estimateChecks, payments, itemLeft] =
    await Promise.all([
      supabase.from('trips').select('*').eq('id', id).maybeSingle(),
      supabase.from('travellers').select('*').eq('trip_id', id).order('position'),
      supabase.from('places').select('*').eq('trip_id', id).order('position'),
      supabase.from('items').select('*').eq('trip_id', id).order('position'),
      supabase.from('options').select('*').eq('trip_id', id).order('position'),
      supabase.from('item_legs').select('*').eq('trip_id', id).order('position'),
      supabase.from('v_item_amounts').select('*').eq('trip_id', id),
      supabase.from('v_item_shares').select('*').eq('trip_id', id),
      supabase.from('v_trip_budget').select('*').eq('trip_id', id).maybeSingle(),
      supabase.from('v_traveller_shares').select('*').eq('trip_id', id),
      supabase.from('v_budget_by_place').select('*').eq('trip_id', id),
      supabase.from('v_traveller_by_place').select('*').eq('trip_id', id),
      supabase.from('rooms').select('*').eq('trip_id', id).order('position'),
      supabase.from('room_occupants').select('*').eq('trip_id', id),
      supabase.from('daily_estimates').select('*').eq('trip_id', id).order('label'),
      supabase.from('v_daily_estimate_people').select('*').eq('trip_id', id),
      supabase.from('v_daily_estimate_checks').select('*').eq('trip_id', id),
      supabase.from('payments').select('*').eq('trip_id', id).order('paid_on').order('created_at'),
      supabase.from('v_item_left').select('*').eq('trip_id', id),
    ])
  for (const r of [trip, travellers, places, items, options, legs, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals, rooms, roomOccupants, dailyEstimates, estimatePeople, estimateChecks, payments, itemLeft]) {
    if (r.error) throw r.error
  }
  if (!trip.data) return null
  return {
    trip: trip.data,
    travellers: travellers.data ?? [],
    places: places.data ?? [],
    items: items.data ?? [],
    options: options.data ?? [],
    legs: legs.data ?? [],
    amounts: amounts.data ?? [],
    shares: shares.data ?? [],
    budget: budget.data,
    travellerShares: travellerShares.data ?? [],
    placeTotals: placeTotals.data ?? [],
    travellerPlaceTotals: travellerPlaceTotals.data ?? [],
    rooms: rooms.data ?? [],
    roomOccupants: roomOccupants.data ?? [],
    dailyEstimates: dailyEstimates.data ?? [],
    estimatePeople: estimatePeople.data ?? [],
    estimateChecks: estimateChecks.data ?? [],
    payments: payments.data ?? [],
    itemLeft: itemLeft.data ?? [],
  }
}
