// Options: the candidates for one item, side by side on Compare (mockups 2 and 10).
// The database keeps their kind-specific details in options.details; this file reads them,
// works out durations, shares and the order, and groups items into Compare's pages.
import type { Item, ItemKind, Place, TicketMode, TripDetail, TripOption } from './trips'
import { legsAfter, type Mode } from './tripView'

/** One way of a journey, as typed: times as printed on the ticket ("13:05"). */
export type Way = {
  fromAirport?: string
  toAirport?: string
  leaves?: string
  arrives?: string
  stops?: number
  via?: string
}

export type JourneyDetails = {
  mode?: TicketMode
  /** Two one-way tickets as one choice: a price for each, added up (13 Nov decision). */
  prices?: [number, number]
  out?: Way
  back?: Way
  bag?: boolean
  refundable?: boolean
}

export type StayDetails = {
  type?: string
  /** How beautiful the place is, 1 to 5, in the organizer's eyes (12 Nov decision). */
  looks?: number
  /** The location in her own words: "great area", "far from everything". */
  location?: string
  breakfast?: boolean
  freeCancellation?: boolean
}

export type OptionDetails = JourneyDetails & StayDetails

export const detailsOf = (o: Pick<TripOption, 'details'>): OptionDetails =>
  o.details && typeof o.details === 'object' && !Array.isArray(o.details) ? (o.details as OptionDetails) : {}

// ── Durations, from the times (13 Nov: for now; local times, so a time difference skews it) ──

const minutesOf = (t?: string) => {
  const m = t && /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Minutes from leaving to arriving; an arrival "earlier" than the departure is the next day. */
export function wayMinutes(way?: Way): number | null {
  const a = minutesOf(way?.leaves)
  const b = minutesOf(way?.arrives)
  if (a === null || b === null) return null
  return b > a ? b - a : b + 24 * 60 - a
}

export const nextDay = (way?: Way) => {
  const a = minutesOf(way?.leaves)
  const b = minutesOf(way?.arrives)
  return a !== null && b !== null && b <= a
}

export function formatMinutes(m: number | null): string {
  if (m === null) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return h === 0 ? `${min} min` : `${h} h ${String(min).padStart(2, '0')}`
}

/** Out + back, or null when a way is missing a time (it then can't be "fastest"). */
export function journeyMinutes(details: OptionDetails, roundTrip: boolean): number | null {
  const out = wayMinutes(details.out)
  if (out === null) return null
  if (!roundTrip) return out
  const back = wayMinutes(details.back)
  return back === null ? null : out + back
}

// ── Prices: your share, or the whole price ────────────────────────────────────

/** The option's price in the trip currency. Null when it has no price yet (a dash, BR-4). */
export const optionPrice = (o: Pick<TripOption, 'amount' | 'rate'>) =>
  o.amount === null ? null : Math.round(Number(o.amount) * Number(o.rate) * 100) / 100

/** Your part of an option: the item's split applies to whichever option is chosen. */
export function optionShare(detail: TripDetail, o: TripOption, viewer: string | null, mode: Mode): number | null {
  const price = optionPrice(o)
  if (price === null || mode === 'total' || !viewer) return price
  const share = detail.shares.find((s) => s.item_id === o.item_id && s.traveller_id === viewer)
  if (share) return Math.round(Number(share.fraction) * price * 100) / 100
  // Shares only exist for the chosen option's item; an item no one chose yet splits equally.
  return Math.round((price / Math.max(detail.travellers.length, 1)) * 100) / 100
}

export type Sort = 'cheapest' | 'fastest'

export type OptionLine = {
  option: TripOption
  details: OptionDetails
  share: number | null
  /** Above the cheapest, in the same terms (your share or total). */
  more: number | null
  minutes: number | null
  cheapest: boolean
  fastest: boolean
}

export function optionLines(
  detail: TripDetail,
  item: Item,
  viewer: string | null,
  mode: Mode,
  sort: Sort = 'cheapest',
): OptionLine[] {
  const roundTrip = detail.legs.some((l) => l.item_id === item.id && l.leg_number === 2)
  const lines = detail.options
    .filter((o) => o.item_id === item.id)
    .map((option) => {
      const details = detailsOf(option)
      return {
        option,
        details,
        share: optionShare(detail, option, viewer, mode),
        minutes: item.kind === 'transport' ? journeyMinutes(details, roundTrip) : null,
      }
    })
  const priced = lines.filter((l) => l.share !== null).map((l) => l.share as number)
  const low = priced.length ? Math.min(...priced) : null
  const timed = lines.filter((l) => l.minutes !== null).map((l) => l.minutes as number)
  const quick = timed.length > 1 ? Math.min(...timed) : null
  const out = lines.map((l) => ({
    ...l,
    more: l.share !== null && low !== null ? Math.round((l.share - low) * 100) / 100 : null,
    cheapest: priced.length > 1 && l.share === low,
    fastest: quick !== null && l.minutes === quick,
  }))
  const byPrice = (a: OptionLine, b: OptionLine) => (a.share ?? Infinity) - (b.share ?? Infinity) || a.option.position - b.option.position
  const byTime = (a: OptionLine, b: OptionLine) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || byPrice(a, b)
  return out.sort(sort === 'fastest' ? byTime : byPrice)
}

// ── Compare's pages: a tab per category, a page per journey or place ─────────

export type Tab = 'travel' | 'stay' | 'around' | 'activities' | 'food'

export const TABS: { key: Tab; label: string; kinds: ItemKind[] }[] = [
  { key: 'travel', label: 'Travel', kinds: ['transport'] },
  { key: 'stay', label: 'Stay', kinds: ['housing'] },
  { key: 'around', label: 'Around', kinds: ['car_rental', 'transport'] },
  { key: 'activities', label: 'Activities', kinds: ['activity'] },
  { key: 'food', label: 'Food', kinds: ['restaurant'] },
]

export type Subject = {
  key: string
  /** "St Martin ⇄ Cartagena", "Cartagena". */
  title: string
  /** "Round trip", "4 nights", "Whole trip". */
  note: string
  items: Item[]
  place: Place | null
}

export const tabOf = (item: Item): Tab | null => {
  if (item.kind === 'transport') return item.place_id ? 'around' : 'travel'
  if (item.kind === 'housing') return 'stay'
  if (item.kind === 'car_rental') return 'around'
  if (item.kind === 'activity') return 'activities'
  if (item.kind === 'restaurant') return 'food'
  return null // insurance, other: not compared for now
}

/**
 * Travel: one page per journey (a ticket with its route), in route order (13 Nov decision).
 * The other tabs: one page per place, then the whole trip when it has something.
 */
export function subjectsFor(detail: TripDetail, tab: Tab): Subject[] {
  const items = detail.items.filter((i) => tabOf(i) === tab)
  if (tab === 'travel') {
    const ordered = [null, ...detail.places.map((p) => p.id)].flatMap((gap) =>
      legsAfter(detail, gap)
        .filter((l) => l.leg.leg_number === 1)
        .map((l) => l.item),
    )
    const withoutRoute = items.filter((i) => !ordered.includes(i))
    return [...ordered, ...withoutRoute].map((item) => {
      const roundTrip = detail.legs.some((l) => l.item_id === item.id && l.leg_number === 2)
      return { key: item.id, title: item.name, note: roundTrip ? 'Round trip' : 'One way', items: [item], place: null }
    })
  }
  const pages: Subject[] = detail.places.map((place) => ({
    key: place.id,
    title: place.name,
    note: place.nights ? `${place.nights} ${place.nights === 1 ? 'night' : 'nights'}` : 'nights not set',
    items: items.filter((i) => i.place_id === place.id),
    place,
  }))
  const whole = items.filter((i) => !i.place_id)
  if (whole.length) pages.push({ key: 'trip', title: 'Whole trip', note: 'not tied to a place', items: whole, place: null })
  return pages
}

/** A tab gets a mustard dot when something in it is still to decide: an item with no chosen option. */
export function tabToDecide(detail: TripDetail, tab: Tab): boolean {
  return detail.items.some((i) => tabOf(i) === tab && !detail.options.some((o) => o.item_id === i.id && o.is_chosen))
}

export const optionCount = (detail: Pick<TripDetail, 'options'>, item: Item) =>
  detail.options.filter((o) => o.item_id === item.id).length

/** Where an item lives on Compare: its tab and its page (for "Open in Compare" links). */
export function compareLink(detail: TripDetail, item: Item): string | null {
  const tab = tabOf(item)
  if (!tab) return null
  const page = subjectsFor(detail, tab).find((s) => s.items.some((i) => i.id === item.id))
  return `/trips/${detail.trip.id}/compare?tab=${tab}${page ? `&page=${page.key}` : ''}`
}
