// The questions each kind of line asks (build 8¾, mockup kinds-v6, 16 Nov 2026), and how they read
// back on the line. No budget arithmetic: a price typed per person is multiplied once, on saving,
// and the line keeps the total (the database does the sums, BR-13).
import { formatWhole } from './money'
import type { Item, ItemKind, TripDetail } from './trips'
import type { Meal } from './trips'
import { MEALS } from './toTry'

export const LOCAL_MODES = [
  ['taxi', 'Taxi'],
  ['bus', 'Bus'],
  ['ferry', 'Ferry'],
  ['train', 'Train'],
  ['metro', 'Metro'],
  ['walk', 'On foot'],
  ['other', 'Other'],
] as const
export type LocalMode = (typeof LOCAL_MODES)[number][0]

export type ItemDetails = {
  start_time: string | null
  price_per_person: boolean
  needs_booking: boolean | null
  duration: string | null
  food_kind: string | null
  from_place: string | null
  to_place: string | null
  local_mode: LocalMode | null
  insurance_included: boolean | null
  deposit: number | null
  meal: Meal | null
}

export const NO_DETAILS: ItemDetails = {
  start_time: null,
  price_per_person: false,
  needs_booking: null,
  duration: null,
  food_kind: null,
  from_place: null,
  to_place: null,
  local_mode: null,
  insurance_included: null,
  deposit: null,
  meal: null,
}

/** Which questions a kind asks. Getting around is a transport line inside a place. */
export function askedFor(kind: ItemKind, inPlace: boolean) {
  const around = kind === 'transport' && inPlace
  return {
    time: kind === 'activity',
    duration: kind === 'activity',
    booking: kind === 'activity' || kind === 'restaurant',
    meal: kind === 'restaurant',
    food: kind === 'restaurant',
    perPerson: kind === 'activity' || kind === 'restaurant' || around,
    fromTo: kind === 'car_rental' || around,
    mode: around,
    insurance: kind === 'car_rental',
    deposit: kind === 'car_rental',
  }
}

/** Only the answers this kind asks for: changing what a line is clears the others. */
export function detailsFor(kind: ItemKind, inPlace: boolean, d: ItemDetails): ItemDetails {
  const a = askedFor(kind, inPlace)
  return {
    start_time: a.time ? d.start_time || null : null,
    price_per_person: a.perPerson ? d.price_per_person : false,
    needs_booking: a.booking ? d.needs_booking : null,
    duration: a.duration ? d.duration?.trim() || null : null,
    food_kind: a.food ? d.food_kind?.trim() || null : null,
    from_place: a.fromTo ? d.from_place?.trim() || null : null,
    to_place: a.fromTo ? d.to_place?.trim() || null : null,
    local_mode: a.mode ? d.local_mode : null,
    insurance_included: a.insurance ? d.insurance_included : null,
    deposit: a.deposit ? d.deposit : null,
    meal: a.meal ? d.meal : null,
  }
}

/** A line's saved answers, for its form. */
export function detailsOf(item: Item): ItemDetails {
  return {
    start_time: item.start_time ? item.start_time.slice(0, 5) : null,
    price_per_person: item.price_per_person,
    needs_booking: item.needs_booking,
    duration: item.duration,
    food_kind: item.food_kind,
    from_place: item.from_place,
    to_place: item.to_place,
    local_mode: item.local_mode as LocalMode | null,
    insurance_included: item.insurance_included,
    deposit: item.deposit === null ? null : Number(item.deposit),
    meal: item.meal as Meal | null,
  }
}

/** How many share a line: everyone unless "Who it's for" says otherwise. A new line: everyone. */
export function sharers(detail: Pick<TripDetail, 'travellers' | 'shares'>, itemId?: string): number {
  const all = Math.max(detail.travellers.length, 1)
  if (!itemId) return all
  const n = detail.shares.filter((s) => s.item_id === itemId && Number(s.fraction) > 0).length
  return n || all
}

const cents = (n: number) => Math.round(n * 100) / 100

/** Per person × people, to the cent. */
export const totalOf = (each: number, people: number) => cents(each * people)
/** The total back to a per-person price, for the form. */
export const eachOf = (total: number, people: number) => cents(total / Math.max(people, 1))

/** A rental from day 9 to day 12 is 4 days; without a drop-off day, one. */
export function rentalDays(from: number | null, until: number | null): number | null {
  if (from === null) return null
  return until !== null && until >= from ? until - from + 1 : 1
}

/** "Ferry Naha → Zamami", the name a getting-around line gets when none is typed. */
export function aroundName(mode: LocalMode | null, from: string, to: string): string {
  const word = mode ? LOCAL_MODES.find(([k]) => k === mode)?.[1] : null
  const route = [from.trim(), to.trim()].filter(Boolean).join(' → ')
  return [word, route].filter(Boolean).join(' ') || 'Getting around'
}

/** The details shown under a line's name, in a few words. */
export function detailsText(item: Item, currency: string): string[] {
  const d = detailsOf(item)
  const bits: (string | null)[] = []
  if (item.kind === 'activity') {
    bits.push(d.start_time, d.duration)
  }
  if (item.kind === 'restaurant') bits.push(d.food_kind)
  if (d.from_place || d.to_place) {
    if (item.kind === 'car_rental') {
      bits.push(
        d.from_place && d.to_place && d.from_place !== d.to_place
          ? `${d.from_place} → ${d.to_place}`
          : (d.from_place ?? d.to_place),
      )
    } else if (!item.name.includes('→')) bits.push([d.from_place, d.to_place].filter(Boolean).join(' → '))
  }
  if (d.price_per_person) bits.push('per person')
  if (d.needs_booking) bits.push(item.kind === 'restaurant' ? 'book a table' : 'book ahead')
  if (item.kind === 'car_rental') {
    if (d.insurance_included === true) bits.push('insurance included')
    if (d.insurance_included === false) bits.push('no insurance')
    if (d.deposit) bits.push(`deposit ${formatWhole(d.deposit, currency)} (held)`)
  }
  return bits.filter((b): b is string => Boolean(b))
}

/** The meals still free on a day of a place: "+ Where we eat" goes once all three are set. */
export function mealsLeft(items: Item[], placeId: string, day: number): Meal[] {
  const taken = new Set(
    items
      .filter(
        (i) =>
          i.place_id === placeId && i.kind === 'restaurant' && i.day_number === day && i.status !== 'dropped' && i.meal,
      )
      .map((i) => i.meal),
  )
  return MEALS.map(([k]) => k).filter((m) => !taken.has(m))
}

/** A place with nights and nowhere to sleep yet shows a dashed "Where we sleep". */
export const needsStay = (items: Item[], placeId: string, nights: number) =>
  nights > 0 && !items.some((i) => i.place_id === placeId && i.kind === 'housing' && i.status !== 'dropped')
