// "Your trips" as a shelf of notebooks (mockup trips-welcome-v5, 15 Nov): which trip goes where,
// the countdown, the day you're on, and the lines each card says. Dates are ISO calendar days.
import type { TripCard } from './trips'
import { formatWhole } from './money'
import { shortDay } from './tripText'

export type Shelf = {
  /** The trip you're on right now, or else the next one: shown big. */
  featured: TripCard | null
  travelling: boolean
  coming: TripCard[]
  /** No dates yet. */
  dreams: TripCard[]
  past: TripCard[]
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Today in the person's own time zone, as an ISO day. */
export const todayIso = () => new Date().toLocaleDateString('en-CA')

const lastDay = (t: TripCard) => t.end_date ?? t.start_date

export function shelve(cards: TripCard[], today: string): Shelf {
  const now = cards
    .filter((t) => t.start_date && t.start_date <= today && (lastDay(t) as string) >= today)
    .sort((a, b) => (a.start_date as string).localeCompare(b.start_date as string))
  const coming = cards
    .filter((t) => t.start_date && t.start_date > today)
    .sort((a, b) => (a.start_date as string).localeCompare(b.start_date as string))
  const past = cards
    .filter((t) => t.start_date && (lastDay(t) as string) < today)
    .sort((a, b) => (lastDay(b) as string).localeCompare(lastDay(a) as string))
  const featured = now[0] ?? coming[0] ?? null
  return {
    featured,
    travelling: now.length > 0,
    // A second trip at the same time (rare) goes with the coming ones.
    coming: [...now, ...coming].filter((t) => t !== featured),
    dreams: cards.filter((t) => !t.start_date),
    past,
  }
}

/** Days until the trip starts. */
export const daysTo = (t: TripCard, today: string) => (t.start_date ? days(today, t.start_date) : null)

/** "Tomorrow", "In 148 days"; on a small card, far away: "In 7 months". */
export function countdown(n: number, short = false): string {
  if (n <= 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (!short || n <= 60) return `In ${n} days`
  const months = Math.round(n / 30.4)
  return months >= 12 && months % 12 === 0
    ? `In ${months / 12} ${months === 12 ? 'year' : 'years'}`
    : `In ${months} ${months === 1 ? 'month' : 'months'}`
}

/** While travelling: which day it is (1 = the first), and how many there are. */
export function dayOfTrip(t: TripCard, today: string): { day: number; of: number | null } {
  return {
    day: days(t.start_date as string, today) + 1,
    of: t.end_date ? days(t.start_date as string, t.end_date) + 1 : null,
  }
}

/** Where you sleep on a day of the trip: the places in order, each for its nights. */
export function placeOn(t: TripCard, day: number): TripCard['places'][number] | null {
  let before = 0
  for (const p of t.places) {
    if (day <= before + p.nights) return p
    before += p.nights
  }
  return t.places[t.places.length - 1] ?? null
}

export const nights = (t: TripCard) => t.places.reduce((sum, p) => sum + p.nights, 0)

/** The hand note under the title: "Hi Djamina, 148 days to Lisbon" · "Day 6, enjoy Medellín!" */
export function greeting(shelf: Shelf, name: string | null, today: string): string {
  const hi = name ? `Hi ${name}` : 'Hi'
  const t = shelf.featured
  if (!t) return name ? `${hi}, where to next?` : 'Where to next?'
  if (shelf.travelling) {
    const { day } = dayOfTrip(t, today)
    const place = placeOn(t, day)
    return place ? `Day ${day}, enjoy ${place.name}!` : `Day ${day}, enjoy!`
  }
  const n = daysTo(t, today) as number
  const where = t.places[0]?.name ?? t.name
  return n === 1 ? `${hi}, you leave for ${where} tomorrow` : `${hi}, ${n} days to ${where}`
}

/** What's left to sort out on a trip to come: the next payment due, the lines with no option chosen. */
export function toSortOut(t: TripCard): { lines: string[]; count: number } {
  const lines: string[] = []
  if (t.nextDue)
    lines.push(`${t.nextDue.name}, ${formatWhole(t.nextDue.left, t.currency)} · due ${shortDay(t.nextDue.dueOn)}`)
  if (t.undecided) lines.push(`${t.undecided.name}: ${t.undecided.options} options, none chosen`)
  return { lines, count: (t.nextDue ? 1 : 0) + t.undecidedCount }
}

export function sortOutNote(count: number): string {
  return count === 0 ? 'all sorted' : count === 1 ? '1 thing to sort out' : `${count} things to sort out`
}

/** "You owe Danielle 42 €" · "Peggy owes you 69 €": the biggest first. */
export function settleLines(t: TripCard): { text: string; youPay: boolean }[] {
  return t.settle.map((s) => ({
    text: s.youPay
      ? `You owe ${s.name} ${formatWhole(s.amount, t.currency)}`
      : `${s.name} owes you ${formatWhole(s.amount, t.currency)}`,
    youPay: s.youPay,
  }))
}

/** "Sept 2026" for a past trip. */
export const monthYear = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )

export type Need = { key: string; text: string; sub: string; to: string; kind: 'pay' | 'owe' | 'decide' }

/** How soon a payment is due, in words: "due in 5 days", "due today", "was due on 1 Apr". */
function dueWords(today: string, dueOn: string): string {
  const n = days(today, dueOn)
  if (n < 0) return `was due on ${shortDay(dueOn)}`
  if (n === 0) return 'due today'
  if (n === 1) return 'due tomorrow'
  return `due in ${n} days`
}

/**
 * "Needs you" (build 8½, menus-home-v6): across all your trips, what's waiting on you: a payment
 * due within 30 days (or late), money you owe someone, lines still to decide. Money first, the
 * soonest first; past trips only for money still owed.
 */
export function needsYou(cards: TripCard[], today: string): Need[] {
  const pay: (Need & { when: number })[] = []
  const owe: Need[] = []
  const decide: Need[] = []
  for (const t of cards) {
    const over = Boolean(t.start_date && (lastDay(t) as string) < today)
    if (t.nextDue && !over && days(today, t.nextDue.dueOn) <= 30)
      pay.push({
        key: `pay-${t.id}`,
        text: `${t.nextDue.name}: ${formatWhole(t.nextDue.left, t.currency)} to pay`,
        sub: `${t.name} · ${dueWords(today, t.nextDue.dueOn)}`,
        to: `/trips/${t.id}/budget`,
        kind: 'pay',
        when: days(today, t.nextDue.dueOn),
      })
    for (const s of t.settle)
      if (s.youPay)
        owe.push({
          key: `owe-${t.id}-${s.name}`,
          text: `You owe ${s.name} ${formatWhole(s.amount, t.currency)}`,
          sub: t.name,
          to: `/trips/${t.id}/who-paid`,
          kind: 'owe',
        })
    if (t.undecidedCount > 0 && !over)
      decide.push({
        key: `decide-${t.id}`,
        text: t.undecidedCount === 1 ? '1 line to decide' : `${t.undecidedCount} lines to decide`,
        sub: `${t.name}${t.undecided ? ` · ${t.undecided.name}${t.undecidedCount > 1 ? ' and more' : ''}` : ''}`,
        to: `/trips/${t.id}/compare`,
        kind: 'decide',
      })
  }
  return [...pay.sort((a, b) => a.when - b.when).map(({ when: _when, ...n }) => n), ...owe, ...decide]
}
