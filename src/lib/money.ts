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
