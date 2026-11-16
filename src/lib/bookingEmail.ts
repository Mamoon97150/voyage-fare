// "Paste a booking email" (build 8 step 5a, mockup ai-reading-v5 screens 3–4): which line of the
// trip the booking goes on, and what changes. Nothing here saves: the page calls applyBooking.
import { sameName } from './aiImport'
import type { FoundBooking } from './data/ai'
import type { Item, ItemKind, TripDetail } from './trips'

export const KIND_OF: Record<FoundBooking['kind'], ItemKind> = {
  stay: 'housing',
  activity: 'activity',
  food: 'restaurant',
  transport: 'transport',
  other: 'other',
}

// Words that don't tell two bookings apart.
const COMMON = new Set([
  'the',
  'and',
  'hotel',
  'hostel',
  'apartment',
  'room',
  'tour',
  'with',
  'from',
  'for',
  'les',
  'des',
  'del',
  'de',
  'la',
  'le',
  'el',
  'los',
  'las',
  'casa',
  'booking',
  'reservation',
  'flight',
  'vol',
  'night',
  'nights',
])

const words = (s: string | null | undefined): string[] =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !COMMON.has(w))

/** How well a line fits the booking: shared name words, same place, same route. */
export function score(detail: TripDetail, item: Item, found: FoundBooking): number {
  const wanted = new Set([...words(found.name), ...words(found.provider)])
  const names = [item.name, ...detail.options.filter((o) => o.item_id === item.id).map((o) => o.name)]
  const have = new Set(names.flatMap(words))
  let points = [...wanted].filter((w) => have.has(w)).length * 2
  const legs = detail.legs.filter((l) => l.item_id === item.id)
  if (
    found.from &&
    found.to &&
    legs.some((l) => fuzzy(l.from_name, found.from as string) && fuzzy(l.to_name, found.to as string))
  )
    points += 4
  if (!points) return 0
  const place = detail.places.find((p) => p.id === item.place_id)
  if (place && found.city && fuzzy(place.name, found.city)) points += 1
  if (item.kind === KIND_OF[found.kind]) points += 1
  return points
}

/** "Bogotá" and "BOG" or "Bogota (El Dorado)": same when one starts the other. */
function fuzzy(a: string, b: string): boolean {
  if (sameName(a, b)) return true
  const [x, y] = [words(a).join(' '), words(b).join(' ')]
  return Boolean(x && y && (x.startsWith(y) || y.startsWith(x)))
}

/** Lines a booking can go on: not dropped, not a package's part, not "To try" notes. */
export const bookable = (detail: TripDetail) =>
  detail.items.filter((i) => i.status !== 'dropped' && i.kind !== 'package' && !i.package_id)

export type BookingPlan = {
  /** The line it goes on (null: a new line). */
  match: Item | null
  /** For "Not this one": every line, best first. */
  choices: Item[]
  /** For a new line. */
  name: string
  kind: ItemKind
  placeId: string | null
  dayNumber: number | null
  optionName: string | null
  notes: string[]
}

export function planBooking(detail: TripDetail, found: FoundBooking): BookingPlan {
  const lines = bookable(detail)
  const scored = lines.map((item) => ({ item, points: score(detail, item, found) }))
  const best = [...scored].sort((a, b) => b.points - a.points)[0]
  const match = best && best.points >= 2 ? best.item : null
  const choices = [...scored]
    .sort((a, b) => b.points - a.points || a.item.name.localeCompare(b.item.name))
    .map((s) => s.item)

  const place = found.city ? (detail.places.find((p) => fuzzy(p.name, found.city as string)) ?? null) : null
  const name =
    found.kind === 'transport' && found.from && found.to
      ? `${found.provider ? `${found.provider} ` : ''}${found.from} → ${found.to}`
      : (found.name ?? found.provider ?? 'Booking')

  const notes: string[] = []
  const start = detail.trip.start_date
  let dayNumber: number | null = null
  if (start && found.start_date) {
    const day =
      Math.round((Date.parse(`${found.start_date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
    const end = detail.trip.end_date
    const last = end
      ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
      : null
    if (day >= 1 && (last === null || day <= last)) dayNumber = found.kind === 'stay' ? null : day
    else notes.push('The email’s dates aren’t within the trip’s dates: check it’s the right booking.')
  }

  return {
    match,
    choices,
    name,
    kind: KIND_OF[found.kind],
    placeId: place?.id ?? null,
    dayNumber,
    optionName: found.name,
    notes,
  }
}

/** What the line says now, to cross out: the chosen option's price, or what was booked. */
export function priceNow(detail: TripDetail, item: Item): { amount: number; currency: string } | null {
  if (item.actual_amount !== null)
    return { amount: Number(item.actual_amount), currency: item.actual_currency ?? detail.trip.currency }
  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  if (chosen?.amount == null) return null
  return { amount: Number(chosen.amount), currency: chosen.currency }
}
