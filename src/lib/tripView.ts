// What the trip view shows, worked out from the database's numbers.
// No budget arithmetic here beyond picking the right figure: the database does the sums (BR-13).
import type { Item, ItemKind, Leg, Place, TicketChange, TicketMode, TripDetail } from './trips'

export type Mode = 'mine' | 'total'

/**
 * The words are the budget's categories, the same on adding, Compare and Budget (14 Nov):
 * Travel · Stay · Getting around · Activities · Food · Insurance · Other.
 * A transport line inside a place is getting around (a taxi, a ferry); for the whole trip it's a ticket.
 */
export const KINDS: Record<ItemKind, { label: string; icon: string }> = {
  transport: { label: 'Travel', icon: '✈' },
  housing: { label: 'Stay', icon: '⌂' },
  activity: { label: 'Activities', icon: '✦' },
  restaurant: { label: 'Food', icon: '◍' },
  car_rental: { label: 'Getting around', icon: '⇄' },
  insurance: { label: 'Insurance', icon: '☂' },
  package: { label: 'Package', icon: '▣' },
  other: { label: 'Other', icon: '•' },
}

/** A kind's word where it is: transport inside a place is "Getting around". */
export function kindLabel(kind: ItemKind, inPlace: boolean): { label: string; icon: string } {
  if (kind === 'transport' && inPlace) return KINDS.car_rental
  return KINDS[kind] ?? KINDS.other
}

/** What can be added where: tickets and insurance belong to the whole trip, stays and outings to a place. */
export const KINDS_FOR_PLACE: ItemKind[] = ['housing', 'activity', 'restaurant', 'transport', 'other']
export const KINDS_FOR_TRIP: ItemKind[] = ['transport', 'car_rental', 'insurance', 'package', 'other']

/** Kinds that usually last several days. */
export const SPANS_DAYS: ItemKind[] = ['housing', 'car_rental']

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v))

/** The traveller who is "you" on this trip, if any. */
export function viewerOf(detail: Pick<TripDetail, 'travellers'>, userId: string | undefined): string | null {
  return detail.travellers.find((t) => t.user_id && t.user_id === userId)?.id ?? null
}

/** Solo trip: one traveller, so "your share" and "total" are the same thing (13 Nov rule). */
export const isSolo = (detail: Pick<TripDetail, 'travellers'>) => detail.travellers.length <= 1

export type ItemLine = {
  amount: number | null
  confirmed: boolean
  priced: boolean
  /** In mine mode: false when the item is not split with you (a gift, someone else's outing). */
  concernsViewer: boolean
}

export function itemLine(detail: TripDetail, item: Item, viewer: string | null, mode: Mode): ItemLine {
  const a = detail.amounts.find((x) => x.item_id === item.id)
  const current = num(a?.current)
  const confirmed = Boolean(a?.is_confirmed)
  if (mode === 'total' || !viewer) {
    return { amount: current, confirmed, priced: current !== null, concernsViewer: true }
  }
  const share = detail.shares.find((s) => s.item_id === item.id && s.traveller_id === viewer)
  if (!share) return { amount: null, confirmed, priced: current !== null, concernsViewer: false }
  const amount = current === null ? null : Math.round(Number(share.fraction) * current * 100) / 100
  return { amount, confirmed, priced: current !== null, concernsViewer: true }
}

/**
 * What a line is called: once an option is chosen, what was chosen ("Spa Bonanova"), with the
 * name of the decision underneath ("Spa"). A ticket keeps its route: that's what it is (13 Nov).
 */
export function itemTitle(detail: Pick<TripDetail, 'options' | 'legs'>, item: Item): { title: string; decision: string | null } {
  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  const ticket = detail.legs.some((l) => l.item_id === item.id)
  if (!chosen || ticket || chosen.name.trim().toLowerCase() === item.name.trim().toLowerCase()) {
    return { title: item.name, decision: null }
  }
  return { title: chosen.name, decision: item.name }
}

/** How many days the trip has: from its dates, else from its nights (N nights = N + 1 days). */
export function tripDays(detail: Pick<TripDetail, 'trip' | 'places'>): number {
  const { start_date, end_date } = detail.trip
  if (start_date && end_date) {
    const ms = Date.parse(`${end_date}T00:00:00Z`) - Date.parse(`${start_date}T00:00:00Z`)
    return Math.round(ms / 86_400_000) + 1
  }
  const nights = detail.places.reduce((sum, p) => sum + p.nights, 0)
  return nights > 0 ? nights + 1 : 0
}

const short = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export function dayLabel(n: number, startDate: string | null): string {
  if (!startDate) return `Day ${n}`
  const d = new Date(Date.parse(`${startDate}T00:00:00Z`) + (n - 1) * 86_400_000)
  return `Day ${n} · ${short.format(d)}`
}

export function daysText(item: Pick<Item, 'day_number' | 'end_day_number'>): string | null {
  if (!item.day_number) return null
  if (item.end_day_number && item.end_day_number !== item.day_number) return `Days ${item.day_number}–${item.end_day_number}`
  return `Day ${item.day_number}`
}

export type ItemGroup = { key: string; label: string; items: Item[] }

/** A place's items as in the mockup: the stay first, then day by day, then ideas with no day. */
export function groupPlaceItems(items: Item[]): ItemGroup[] {
  const stays = items.filter((i) => i.kind === 'housing')
  const rest = items.filter((i) => i.kind !== 'housing')
  const days = [...new Set(rest.filter((i) => i.day_number).map((i) => i.day_number as number))].sort((a, b) => a - b)
  const groups: ItemGroup[] = []
  if (stays.length) groups.push({ key: 'stay', label: 'Stay', items: stays })
  for (const d of days) groups.push({ key: `day-${d}`, label: `Day ${d}`, items: rest.filter((i) => i.day_number === d) })
  const ideas = rest.filter((i) => !i.day_number)
  if (ideas.length) groups.push({ key: 'ideas', label: 'Ideas, no day yet', items: ideas })
  return groups
}

export function placeTotal(detail: TripDetail, place: Place, viewer: string | null, mode: Mode): number | null {
  if (mode === 'total' || !viewer) return num(detail.placeTotals.find((p) => p.place_id === place.id)?.current)
  return num(detail.travellerPlaceTotals.find((p) => p.place_id === place.id && p.traveller_id === viewer)?.current)
}

export type BudgetView = {
  figure: number | null
  confirmed: number | null
  estimated: number | null
  target: number | null
  /** Positive = over the target. */
  difference: number | null
  missing: number
}

/**
 * The budget bar. Mine: your share, against your part of the target.
 * Total: the whole trip, against the whole target.
 */
export function budgetView(detail: TripDetail, viewer: string | null, mode: Mode): BudgetView {
  const b = detail.budget
  const missing = Number(b?.missing_amount_count ?? 0)
  const targetTotal = num(b?.target_total)
  if (mode === 'total' || !viewer) {
    const figure = num(b?.current_total)
    return {
      figure,
      confirmed: num(b?.confirmed_total),
      estimated: num(b?.estimated_total),
      target: targetTotal,
      difference: figure !== null && targetTotal !== null ? figure - targetTotal : null,
      missing,
    }
  }
  const mine = detail.travellerShares.find((s) => s.traveller_id === viewer)
  const figure = num(mine?.share_current)
  const travellers = Math.max(detail.travellers.length, 1)
  const target =
    detail.trip.target_amount === null
      ? null
      : detail.trip.target_scope === 'per_person'
        ? Number(detail.trip.target_amount)
        : Math.round((Number(detail.trip.target_amount) / travellers) * 100) / 100
  return {
    figure,
    confirmed: num(mine?.share_confirmed),
    estimated: num(mine?.share_estimated),
    target,
    difference: figure !== null && target !== null ? Math.round((figure - target) * 100) / 100 : null,
    missing,
  }
}

// ── Tickets and their legs, between the places ────────────────────────────────


export const MODES: Record<TicketMode, { label: string; icon: string }> = {
  plane: { label: 'Plane', icon: '✈' },
  train: { label: 'Train', icon: '🚆' },
  bus: { label: 'Bus', icon: '🚌' },
  car: { label: 'Car', icon: '🚗' },
  boat: { label: 'Boat', icon: '⛴' },
  other: { label: 'Other', icon: '•' },
}

export type LegLine = { leg: Leg; item: Item; roundTrip: boolean }

/** The legs sitting in one gap of the route: before the first place (null) or after a place. */
export function legsAfter(detail: Pick<TripDetail, 'legs' | 'items'>, afterPlaceId: string | null): LegLine[] {
  return detail.legs
    .filter((l) => l.after_place_id === afterPlaceId)
    .sort((a, b) => a.position - b.position || a.leg_number - b.leg_number)
    .flatMap((leg) => {
      const item = detail.items.find((i) => i.id === leg.item_id)
      if (!item) return []
      const roundTrip = detail.legs.some((l) => l.item_id === leg.item_id && l.leg_number === 2)
      return [{ leg, item, roundTrip }]
    })
}

/** Tickets drawn in the route are not listed again in the whole-trip sheet. */
export function hasLegs(detail: Pick<TripDetail, 'legs'>, item: Item): boolean {
  return detail.legs.some((l) => l.item_id === item.id)
}

/**
 * Where a new ticket most likely goes, so the form is often just a price to type:
 * before the first place it leaves home; after a place it goes to the next one, or home.
 */
export function suggestedRoute(
  detail: Pick<TripDetail, 'trip' | 'places'>,
  afterPlaceId: string | null,
): { from: string; to: string } {
  const home = detail.trip.home_city ?? ''
  const { places } = detail
  if (afterPlaceId === null) return { from: home, to: places[0]?.name ?? '' }
  const i = places.findIndex((p) => p.id === afterPlaceId)
  return { from: places[i]?.name ?? '', to: places[i + 1]?.name ?? home }
}

/** A ticket as its form shows it, read back from its legs. */
export function ticketOf(detail: Pick<TripDetail, 'legs'>, item: Item, amount: number | null): TicketChange {
  const legs = detail.legs.filter((l) => l.item_id === item.id).sort((a, b) => a.leg_number - b.leg_number)
  const out = legs[0]
  const back = legs.find((l) => l.leg_number === 2)
  return {
    from: out?.from_name ?? '',
    to: out?.to_name ?? '',
    mode: (out?.mode as TicketMode) ?? 'plane',
    via: out?.via ?? null,
    afterPlaceId: out?.after_place_id ?? null,
    roundTrip: Boolean(back),
    returnAfterPlaceId: back?.after_place_id ?? null,
    amount,
  }
}

// ── Daily estimates (build 6) ───────────────────────────────────────────────────

/** What a daily estimate can be for: the budget's words (14 Nov), with a name to start from. */
export const ESTIMATE_CATEGORIES: { key: string; label: string; icon: string; suggestion: string }[] = [
  { key: 'food', label: 'Food', icon: KINDS.restaurant.icon, suggestion: 'Food & drinks' },
  { key: 'local_transport', label: 'Getting around', icon: KINDS.car_rental.icon, suggestion: 'Getting around' },
  { key: 'activities', label: 'Activities', icon: KINDS.activity.icon, suggestion: 'Activities' },
  { key: 'buffer', label: 'Other', icon: KINDS.other.icon, suggestion: 'Extras' },
]

/** Days by default: the place's nights, or the trip's days for the whole trip. */
export function estimateDefaultDays(detail: Pick<TripDetail, 'trip' | 'places'>, placeId: string | null): number {
  if (placeId) return detail.places.find((p) => p.id === placeId)?.nights ?? 0
  return tripDays(detail)
}

/**
 * One estimate's figure: your share (a day each × days, if it's for you) or the whole group's.
 * Same rounding as the budget view (BR-7): the day's amount in the trip currency, to the cent, × days.
 */
export function estimateLine(
  detail: Pick<TripDetail, 'estimatePeople' | 'estimateChecks'>,
  e: { id: string; amount: number; rate: number; days: number },
  viewer: string | null,
  mode: Mode,
): { amount: number | null; people: number; forViewer: boolean; mismatch: boolean; expectedDays: number | null } {
  const people = (detail.estimatePeople ?? []).filter((p) => p.daily_estimate_id === e.id)
  const forViewer = viewer !== null && people.some((p) => p.traveller_id === viewer)
  const each = (Math.round(Number(e.amount) * Number(e.rate) * 100) / 100) * e.days
  const check = (detail.estimateChecks ?? []).find((c) => c.daily_estimate_id === e.id)
  const amount = mode === 'total' || !viewer ? each * people.length : forViewer ? each : null
  return {
    amount,
    people: people.length,
    forViewer,
    mismatch: Boolean(check?.days_mismatch),
    expectedDays: check?.expected_days ?? null,
  }
}

// ── Agency packages (build 6, mockup package-v4) ────────────────────────────────

/** The packages of a trip (lines of kind "package"). */
export const packagesOf = (detail: Pick<TripDetail, 'items'>) => detail.items.filter((i) => i.kind === 'package')

/** The lines a package covers. */
export const coveredBy = (detail: Pick<TripDetail, 'items'>, pkg: Item) => detail.items.filter((i) => i.package_id === pkg.id)

const COVER_WORDS: Record<string, [string, string]> = {
  ticket: ['ticket', 'tickets'],
  housing: ['stay', 'stays'],
  activity: ['activity', 'activities'],
  restaurant: ['meal', 'meals'],
  around: ['transfer', 'transfers'],
  insurance: ['insurance', 'insurances'],
  other: ['other', 'others'],
}

/** "covers 2 tickets · 5 stays · 3 transfers" (or null when it covers nothing yet). */
export function coversText(detail: Pick<TripDetail, 'items'>, pkg: Item): string | null {
  const counts = new Map<string, number>()
  for (const i of coveredBy(detail, pkg)) {
    const key =
      i.kind === 'transport' ? (i.place_id ? 'around' : 'ticket') : i.kind === 'car_rental' ? 'around' : i.kind in COVER_WORDS ? i.kind : 'other'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  const order = ['ticket', 'housing', 'around', 'activity', 'restaurant', 'insurance', 'other']
  return `covers ${order
    .filter((k) => counts.has(k))
    .map((k) => {
      const n = counts.get(k)!
      return `${n} ${COVER_WORDS[k][n === 1 ? 0 : 1]}`
    })
    .join(' · ')}`
}

// ── What's left to pay (build 6, mockup left-to-pay-v4) ─────────────────────────

/** Days from today (local) to an ISO date: negative = late. */
export function daysUntil(iso: string, today = new Date()): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - start) / 86_400_000)
}

export type LeftLine = {
  /** Paid so far and left, whole line. */
  paid: number
  left: number
  /** Left for you (your share) or the whole line, as the page shows. */
  leftShown: number
  hasPayments: boolean
  /** "deposit paid" when only a deposit is in, else "paid in part". */
  paidWord: string
  due: string | null
  /** Days until the balance is due (negative = late); null without a date or nothing left. */
  dueIn: number | null
}

/** A booked line's paid / left to pay; null for lines with nothing to pay (not booked, in a package). */
export function leftLine(detail: TripDetail, item: Item, viewer: string | null, mode: Mode): LeftLine | null {
  const row = (detail.itemLeft ?? []).find((l) => l.item_id === item.id)
  if (!row) return null
  const left = num(row.left_to_pay) ?? 0
  const paid = num(row.paid) ?? 0
  const share = detail.shares.find((s) => s.item_id === item.id && s.traveller_id === viewer)
  const leftShown = mode === 'total' || !viewer ? left : Math.round(left * Number(share?.fraction ?? 0) * 100) / 100
  const kinds = (detail.payments ?? []).filter((p) => p.item_id === item.id).map((p) => p.kind)
  return {
    paid,
    left,
    leftShown,
    hasPayments: kinds.length > 0,
    paidWord: kinds.length > 0 && kinds.every((k) => k === 'deposit') ? 'deposit paid' : 'paid in part',
    due: row.due_on,
    dueIn: row.due_on && left > 0 ? daysUntil(row.due_on) : null,
  }
}
