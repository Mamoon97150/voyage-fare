// Lines, tickets and places: add, change, remove.
import { supabase } from '../supabase'
import type { Place } from './trips'

export type ItemKind = 'transport' | 'housing' | 'activity' | 'restaurant' | 'car_rental' | 'insurance' | 'package' | 'other'

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

/** Until the first payment (decision 12 Nov). rate: what 1 unit of the current currency is worth in the new one. */
export async function changeTripCurrency(tripId: string, currency: string, rate: number): Promise<void> {
  const { error } = await supabase.rpc('change_trip_currency', { p_trip_id: tripId, p_currency: currency, p_rate: rate })
  if (error) throw error
}

/** Dropped: kept for the record, out of the budget and the dots. Choosing an option brings it back. */
export async function setItemDropped(id: string, dropped: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_item_dropped', { p_item_id: id, p_dropped: dropped })
  if (error) throw error
}

/** Who shares a line (SR-3): some travellers, or everyone (all of them, or an empty list). */
export async function setItemSplit(id: string, travellers: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_item_split', { p_item_id: id, p_travellers: travellers })
  if (error) throw error
}

export type ItemStatus = 'chosen' | 'booked' | 'paid'

/** Booked or paid, with what was really paid; paid also says who paid (BR-2, BR-3). */
export async function setItemStatus(change: {
  id: string
  status: ItemStatus
  actualAmount: number | null
  paidBy: string | null
  paidOn?: string | null
  /** Another currency than the trip's, with the rate saved now (trip currency per 1 unit). */
  actualCurrency?: string
  actualRate?: number
  /** Everyone on the line paid their own share (build 4): counts as paid, no debts. */
  paidEach?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('set_item_status', {
    p_paid_each: change.paidEach ?? false,
    p_actual_currency: change.actualCurrency,
    p_actual_rate: change.actualRate,
    p_item_id: change.id,
    p_status: change.status,
    p_actual_amount: change.actualAmount ?? undefined,
    p_paid_by: change.paidBy ?? undefined,
    p_paid_on: change.paidOn ?? undefined,
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

/** keepPrice: the price lives in Compare (several options, or one in another currency). */
export async function updateTicket(itemId: string, ticket: TicketChange, keepPrice = false): Promise<void> {
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
    p_keep_price: keepPrice,
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
