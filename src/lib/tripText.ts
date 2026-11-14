// How a trip describes itself in a line ("12 – 24 May 2027 · from St Martin · 4 travellers").

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const full = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "12 – 24 May 2027", "28 Apr – 3 May 2027", "28 Dec 2026 – 3 Jan 2027", or null without dates. */
export function formatDates(start: string | null, end: string | null): string | null {
  if (!start) return null
  const a = new Date(`${start}T00:00:00Z`)
  if (!end || end === start) return full.format(a)
  const b = new Date(`${end}T00:00:00Z`)
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${full.format(a)} – ${full.format(b)}`
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${dayMonth.format(a)} – ${full.format(b)}`
  return `${day.format(a)} – ${full.format(b)}`
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "12 – 17 Sept", "30 Aug – 2 Sept": a stretch inside a trip, the year is the trip's. */
export function formatShortDates(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00Z`)
  const b = new Date(`${end}T00:00:00Z`)
  if (start === end) return dayMonth.format(a)
  return a.getUTCMonth() === b.getUTCMonth() ? `${day.format(a)} – ${dayMonth.format(b)}` : `${dayMonth.format(a)} – ${dayMonth.format(b)}`
}

/** The date `days` after an ISO date, as an ISO date. */
export const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/** The trip's cover line, by hand, short enough for one line: "4 – 18 Sept 2026 · 4 travellers". */
export function tripSubtitle(trip: { start_date: string | null; end_date: string | null; home_city: string | null }, travellers: number): string {
  return [formatDates(trip.start_date, trip.end_date) ?? 'Dates not decided', plural(travellers, 'traveller')]
    .filter(Boolean)
    .join(' · ')
}

/** The currencies offered when creating a trip; any ISO code works in the database. */
export const CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CAD', 'CHF', 'XCD', 'ANG', 'COP', 'MXN', 'BRL', 'MAD', 'AED', 'THB', 'JPY',
] as const

const names = new Intl.DisplayNames(['en'], { type: 'currency' })
export const currencyLabel = (code: string) => `${code} · ${names.of(code) ?? code}`
