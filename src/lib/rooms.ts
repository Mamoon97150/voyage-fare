// A stay by room (SR-4): the rooms as typed in the form, before they're saved.
import { parseAmount } from './money'

export type RoomDraft = { name: string; price: string; occupants: string[] }

/** The rooms typed so far, added up: null while a price is missing or unreadable. */
export function roomsTotal(rooms: RoomDraft[]): number | null {
  let sum = 0
  for (const r of rooms) {
    const v = parseAmount(r.price)
    if (v === null) return null
    sum += v
  }
  return sum
}
