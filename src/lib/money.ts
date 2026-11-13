/**
 * Money display rules from the cahier des charges:
 * BR-4  — no amount shows a dash (—), never 0 €.
 * BR-11 — format `1 259 €`, `1 259 € pp`, `2 518 € total`.
 */

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }

export const NO_AMOUNT = '—'

export type MoneyScope = 'pp' | 'total'

export function formatMoney(
  amount: number | null | undefined,
  currency = 'EUR',
  scope?: MoneyScope,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return NO_AMOUNT
  }
  const rounded = Math.round(amount * 100) / 100
  const [whole, cents] = Math.abs(rounded).toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const number = cents === '00' ? grouped : `${grouped},${cents}`
  const sign = rounded < 0 ? '−' : ''
  const unit = SYMBOLS[currency] ?? currency
  const suffix = scope ? ` ${scope}` : ''
  return `${sign}${number} ${unit}${suffix}`
}

/**
 * Read an amount the way people type it, in any common style (review 13 Nov: "1.200" was read as 1.2).
 * Spaces and apostrophes group thousands. A dot or comma followed by exactly 3 digits groups thousands
 * ("1.200", "2,400,000"); followed by 1 or 2 digits it starts the cents ("1200,50", "19.99").
 * With both, the last one starts the cents ("1.200,50", "1,200.50").
 * Returns null when it isn't a plain positive amount, so the form can ask instead of guessing.
 */
export function parseAmount(input: string): number | null {
  const text = input.trim().replace(/[\s  ']/g, '')
  if (!/^\d[\d.,]*$/.test(text)) return null

  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  let whole = text
  let cents = ''

  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma)
    whole = text.slice(0, at)
    cents = text.slice(at + 1)
    const grouping = at === lastDot ? ',' : '.'
    if (whole.includes(at === lastDot ? '.' : ',')) return null // the cents mark twice
    const groups = whole.split(grouping)
    // Thousands groups after the first have exactly 3 digits: "1.200.50,3" is refused.
    if (groups[0].length === 0 || !groups.slice(1).every((g) => g.length === 3)) return null
    whole = groups.join('')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const mark = lastDot >= 0 ? '.' : ','
    const parts = text.split(mark)
    const tail = parts[parts.length - 1]
    if (parts.length > 2 || tail.length === 3) {
      // Thousands: every group after the first has exactly 3 digits.
      if (!parts.slice(1).every((p) => p.length === 3) || parts[0].length === 0) return null
      whole = parts.join('')
    } else if (tail.length === 1 || tail.length === 2) {
      whole = parts[0]
      cents = tail
    } else {
      return null // "12." or "1.2345": unclear
    }
  }

  if (!/^\d+$/.test(whole) || (cents && !/^\d{1,2}$/.test(cents))) return null
  const value = Number(cents ? `${whole}.${cents}` : whole)
  return Number.isFinite(value) ? value : null
}
