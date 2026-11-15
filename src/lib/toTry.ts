// The restaurant pool "To try" (mockup to-try-v5, 15 Nov): where a link comes from, a place's days,
// what's already planned on each, and which lines are in the pool.
import type { Item, Place, TripDetail } from './trips'
import { addDays } from './tripText'

export type Source = { kind: 'instagram' | 'tiktok' | 'maps' | 'web'; label: string; badge: string }

/** Where a link was found, read from the address itself (nothing is fetched). */
export function sourceOf(link: string | null): (Source & { handle: string | null; name: string | null }) | null {
  if (!link) return null
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  const parts = url.pathname.split('/').filter(Boolean)
  if (host === 'instagram.com' || host === 'instagr.am') {
    // instagram.com/<account>/ is an account; /p/, /reel/ … are posts (no account in the address).
    const handle = parts[0] && !['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(parts[0]) ? parts[0] : null
    return { kind: 'instagram', label: 'Instagram', badge: 'IG', handle: handle && `@${handle}`, name: null }
  }
  if (host.endsWith('tiktok.com')) {
    const handle = parts.find((p) => p.startsWith('@')) ?? null
    return { kind: 'tiktok', label: 'TikTok', badge: 'TT', handle, name: null }
  }
  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || (host.startsWith('google.') && parts[0] === 'maps')) {
    // google.com/maps/place/Pergamino+Caf%C3%A9/@… carries the name.
    const i = parts.indexOf('place')
    const name = i >= 0 && parts[i + 1] ? decodeURIComponent(parts[i + 1].replace(/\+/g, ' ')) : null
    return { kind: 'maps', label: 'Google Maps', badge: 'G', handle: null, name }
  }
  return { kind: 'web', label: host, badge: '↗', handle: null, name: null }
}

/**
 * A pool restaurant: a restaurant in a place, with no day, still an idea (not counting). One that
 * already counts with no day (chosen, booked, in a package) stays with the place's other ideas.
 */
export const isToTry = (i: Item) =>
  i.kind === 'restaurant' && i.place_id !== null && !i.day_number && i.status === 'idea'

/** The days you're in a place: day numbers of the whole trip, one per night, in order. */
export function placeDays(detail: Pick<TripDetail, 'places'>, place: Place): number[] {
  const ordered = [...detail.places].sort((a, b) => a.position - b.position)
  let before = 0
  for (const p of ordered) {
    if (p.id === place.id) return Array.from({ length: Math.max(p.nights, 1) }, (_, k) => before + k + 1)
    before += p.nights
  }
  return []
}

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

/** "Wed 9" for a day of the trip, or null without dates. */
export const dayDate = (start: string | null, day: number) =>
  start ? weekday.format(new Date(`${addDays(start, day - 1)}T00:00:00Z`)) : null

/** What's already on a day in a place: a meal first ("Carmen"), else the first line; null when free. */
export function plannedOn(detail: Pick<TripDetail, 'items'>, placeId: string, day: number): string | null {
  const on = detail.items.filter(
    (i) =>
      i.place_id === placeId &&
      i.kind !== 'housing' &&
      i.status !== 'dropped' &&
      i.day_number !== null &&
      day >= i.day_number &&
      day <= (i.end_day_number ?? i.day_number),
  )
  const meal = on.find((i) => i.kind === 'restaurant')
  return (meal ?? on[0])?.name ?? null
}

/** A restaurant on a day with no price: its cost is in the place's (or the trip's) food daily estimate. */
export function inFoodBudget(detail: Pick<TripDetail, 'dailyEstimates' | 'options'>, item: Item): boolean {
  if (item.kind !== 'restaurant' || !item.day_number) return false
  if (detail.options.some((o) => o.item_id === item.id && o.is_chosen)) return false
  return (detail.dailyEstimates ?? []).some(
    (d) => d.category === 'food' && (d.place_id === item.place_id || d.place_id === null),
  )
}

/** Has the day been? Then "Loved it · Fine · Skip" can be asked. */
export function dayHasCome(start: string | null, day: number | null, today: string): boolean {
  return Boolean(start && day && addDays(start, day - 1) <= today)
}

export const MEALS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
] as const

export const VERDICTS = [
  ['loved', '♥ Loved it'],
  ['fine', 'Fine'],
  ['skip', 'Skip'],
] as const
