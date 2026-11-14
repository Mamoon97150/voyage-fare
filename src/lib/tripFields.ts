// The trip's own fields, checked the same way when creating a trip and in its settings
// (code review, 14 Nov: the two copies had started to differ).
import { parseAmount } from './money'

export type TripFieldErrors = { name?: string; dates?: string; target?: string }

/** Name and dates: "Give the trip a name.", both days or "not decided yet", the end after the start. */
export function checkNameAndDates(f: { name: string; noDates: boolean; start: string; end: string }): TripFieldErrors {
  const found: TripFieldErrors = {}
  if (!f.name.trim()) found.name = 'Give the trip a name.'
  if (!f.noDates) {
    if (!f.start || !f.end) found.dates = 'Choose both days, or tick “Dates not decided yet”.'
    else if (f.end < f.start) found.dates = 'The trip ends before it starts.'
  }
  return found
}

/** The target is optional; when typed, it must read as an amount. */
export function checkTarget(target: string): { amount: number | null; error?: string } {
  if (!target.trim()) return { amount: null }
  const amount = parseAmount(target)
  return amount === null ? { amount: null, error: 'Enter an amount, like 2 500.' } : { amount }
}
