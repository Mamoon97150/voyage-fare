import type { Json, Tables } from './database.types'
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
export type TripOption = Tables<'options'>
export type Leg = Tables<'item_legs'>
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
  options: TripOption[]
  legs: Leg[]
  amounts: ItemAmount[]
  shares: ItemShare[]
  budget: TripBudget | null
  travellerShares: TravellerShare[]
  placeTotals: PlaceTotal[]
  travellerPlaceTotals: TravellerPlaceTotal[]
}

/** null when the trip doesn't exist or isn't shared with this person (privacy hides both the same way). */
export async function getTrip(id: string): Promise<TripDetail | null> {
  const [trip, travellers, places, items, options, legs, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals] =
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
    ])
  for (const r of [trip, travellers, places, items, options, legs, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals]) {
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

export type TicketMode = 'plane' | 'train' | 'bus' | 'car' | 'boat' | 'other'

/** One step in the database: one transport item, one price, 1 or 2 legs placed in the route. */
export async function addTicket(ticket: {
  tripId: string
  from: string
  to: string
  mode: TicketMode
  name: string | null
  via: string | null
  afterPlaceId: string | null
  roundTrip: boolean
  returnAfterPlaceId: string | null
  amount: number | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_ticket', {
    p_trip_id: ticket.tripId,
    p_from: ticket.from,
    p_to: ticket.to,
    p_mode: ticket.mode,
    p_name: ticket.name ?? undefined,
    p_via: ticket.via ?? undefined,
    p_after_place_id: ticket.afterPlaceId ?? undefined,
    p_round_trip: ticket.roundTrip,
    p_return_after_place_id: ticket.returnAfterPlaceId ?? undefined,
    p_amount: ticket.amount ?? undefined,
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

// ── Changing and removing (each one step in the database) ─────────────────────

export async function updateItem(item: {
  id: string
  kind: ItemKind
  name: string
  dayNumber: number | null
  endDayNumber: number | null
  amount: number | null
  /** With several options the price is the chosen option's: leave it alone. */
  keepPrice?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('update_item', {
    p_item_id: item.id,
    p_kind: item.kind,
    p_name: item.name,
    p_day_number: item.dayNumber ?? undefined,
    p_end_day_number: item.endDayNumber ?? undefined,
    p_amount: item.amount ?? undefined,
    p_keep_price: item.keepPrice ?? false,
  })
  if (error) throw error
}

export type TicketChange = {
  from: string
  to: string
  mode: TicketMode
  via: string | null
  afterPlaceId: string | null
  roundTrip: boolean
  returnAfterPlaceId: string | null
  amount: number | null
}

export async function updateTicket(itemId: string, ticket: TicketChange): Promise<void> {
  const { error } = await supabase.rpc('update_ticket', {
    p_item_id: itemId,
    p_from: ticket.from,
    p_to: ticket.to,
    p_mode: ticket.mode,
    p_via: ticket.via ?? undefined,
    p_after_place_id: ticket.afterPlaceId ?? undefined,
    p_round_trip: ticket.roundTrip,
    p_return_after_place_id: ticket.returnAfterPlaceId ?? undefined,
    p_amount: ticket.amount ?? undefined,
  })
  if (error) throw error
}

/** An item (or a ticket, with its legs) and its price go together. */
export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

export async function updatePlace(id: string, change: { name: string; nights: number }): Promise<void> {
  const { error } = await supabase.from('places').update(change).eq('id', id)
  if (error) throw error
}

/** The place and its items; tickets after it move up in the route. */
export async function deletePlace(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_place', { p_place_id: id })
  if (error) throw error
}

/** Just enough for a trip's other pages: its name and how many travellers (null when not yours). */
export async function getTripHeader(id: string): Promise<{ name: string; travellers: number } | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('name, travellers!travellers_trip_id_fkey(id)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? { name: data.name, travellers: data.travellers.length } : null
}

// ── Trip settings (mockup 8) ───────────────────────────────────────────────────

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

// ── Options: compare, choose, coup de cœur (build 3) ───────────────────────────

export type OptionInput = {
  name: string
  amount: number | null
  details: Json
  link: string | null
  note: string | null
}

/**
 * Add a candidate to an item. The first option of an item is chosen right away (like adding an
 * item with a price); the next ones wait until you choose. Priced in the trip currency until
 * currencies arrive (rate 1).
 */
export async function addOption(detail: TripDetail, itemId: string, input: OptionInput): Promise<string> {
  const siblings = detail.options.filter((o) => o.item_id === itemId)
  const { data, error } = await supabase
    .from('options')
    .insert({
      trip_id: detail.trip.id,
      item_id: itemId,
      name: input.name,
      amount: input.amount,
      currency: detail.trip.currency,
      rate: 1,
      details: input.details,
      link: input.link,
      note: input.note,
      is_chosen: siblings.length === 0,
      position: Math.max(0, ...siblings.map((o) => o.position)) + 1,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** A page of Compare with nothing yet (no stay in Medellín): the item and its first option together. */
export async function addItemWithOption(
  detail: TripDetail,
  item: { placeId: string | null; kind: ItemKind; name: string },
  input: OptionInput,
): Promise<void> {
  const itemId = await addItem({ tripId: detail.trip.id, ...item, dayNumber: null, endDayNumber: null, amount: null })
  await addOption({ ...detail, options: [] }, itemId, input)
}

export async function updateOption(id: string, input: OptionInput): Promise<void> {
  const { error } = await supabase
    .from('options')
    .update({ name: input.name, amount: input.amount, details: input.details, link: input.link, note: input.note })
    .eq('id', id)
  if (error) throw error
}

/** Choosing one un-chooses the others; the item becomes "chosen" (the database keeps that rule). */
export async function chooseOption(id: string): Promise<void> {
  const { error } = await supabase.from('options').update({ is_chosen: true }).eq('id', id)
  if (error) throw error
}

export async function setFavourite(id: string, favourite: boolean): Promise<void> {
  const { error } = await supabase.from('options').update({ is_favourite: favourite }).eq('id', id)
  if (error) throw error
}

/** Deleting the chosen one leaves nothing chosen: the item is an idea again until you choose. */
export async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase.from('options').delete().eq('id', id)
  if (error) throw error
}
