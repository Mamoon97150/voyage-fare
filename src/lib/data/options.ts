// Options: compare, choose, coup de cœur (build 3), rooms (build 4).
import type { Json } from '../database.types'
import { supabase } from '../supabase'
import { addItem, type ItemKind } from './items'
import type { TripDetail } from './tripDetail'

export type RoomInput = { name: string; amount: number; occupants: string[] }

export type OptionInput = {
  name: string
  amount: number | null
  /** A stay by room (SR-4): its rooms, or null for one price. Left out: the rooms aren't touched. */
  rooms?: RoomInput[] | null
  /** The price's own currency and the rate saved when it was typed (BR-10). Default: the trip's, 1. */
  currency?: string
  rate?: number
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
      currency: input.currency ?? detail.trip.currency,
      rate: input.rate ?? 1,
      details: input.details,
      link: input.link,
      note: input.note,
      is_chosen: siblings.length === 0,
      position: Math.max(0, ...siblings.map((o) => o.position)) + 1,
    })
    .select('id')
    .single()
  if (error) throw error
  if (input.rooms !== undefined) await setOptionRooms(data.id, input.rooms)
  return data.id
}

/** A stay's rooms (SR-4), saved in one step; null or none = one price, split equally. */
export async function setOptionRooms(optionId: string, rooms: RoomInput[] | null): Promise<void> {
  const { error } = await supabase.rpc('set_option_rooms', { p_option_id: optionId, p_rooms: (rooms ?? []) as unknown as Json })
  if (error) throw error
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
    .update({
      name: input.name,
      amount: input.amount,
      details: input.details,
      link: input.link,
      note: input.note,
      ...(input.currency ? { currency: input.currency, rate: input.rate ?? 1 } : {}),
    })
    .eq('id', id)
  if (error) throw error
  if (input.rooms !== undefined) await setOptionRooms(id, input.rooms)
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
