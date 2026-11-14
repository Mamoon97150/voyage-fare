import { formatMoney, formatWhole } from '../../lib/money'
import { compareLink, optionCount } from '../../lib/options'
import type { Item, TripDetail } from '../../lib/trips'
import type { ItemLine } from '../../lib/tripView'

// "Chosen" is the default and stays silent: the dot already says estimated or confirmed (review 13 Nov).
export const STATUS: Record<string, string | undefined> = { idea: 'Idea', booked: 'Booked', paid: 'Paid', dropped: 'Dropped' }

/**
 * What a line says on the right: your share in whole units; 0 is "Included" when it's booked
 * (inside a package) and "Free" otherwise (review 13 Nov: "0 €" read as a mistake).
 */
export function amountText(line: ItemLine, item: Item, currency: string): string {
  if (item.status === 'dropped') return '—'
  // Covered by a package (build 6): no price of its own.
  if (item.package_id) return 'in the'
  if (!line.concernsViewer) return 'Not yours'
  if (line.amount === 0) return item.status === 'booked' || item.status === 'paid' ? 'Included' : 'Free'
  return formatWhole(line.amount, currency)
}

export const priceOf = (detail: TripDetail, item: Item) => {
  const current = detail.amounts.find((a) => a.item_id === item.id)?.current
  return current === null || current === undefined ? null : Number(current)
}

/**
 * When a line's price lives in Compare, its form shows this instead of a price field, and saving
 * leaves the price alone: several options compared, or one in another currency (review 13 Nov:
 * a euro price typed there turned 615 000 COP into 169 COP).
 */
export function priceInCompare(detail: TripDetail, item: Item): { text: string; link: string | null } | undefined {
  const count = optionCount(detail, item)
  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  const foreign = chosen !== undefined && chosen.amount !== null && chosen.currency !== detail.trip.currency
  if (count < 2 && !foreign) return undefined
  const parts: string[] = []
  if (count >= 2) parts.push(`${count} options compared${chosen ? ` · chosen: ${chosen.name}` : ' · none chosen yet'}`)
  if (foreign) {
    const amount = Number(chosen.amount)
    parts.push(`${formatMoney(amount, chosen.currency)} ≈ ${formatWhole(amount * Number(chosen.rate), detail.trip.currency)}`)
  }
  return { text: parts.join(' · '), link: compareLink(detail, item) }
}

/** The small word under the amount: the status, or "Package" (blue) for a line a package covers. */
export function statusWord(item: Item): { text: string; className: string } | null {
  if (item.package_id && item.status !== 'dropped') return { text: 'Package', className: 'item-row__status item-row__status--package' }
  const text = STATUS[item.status]
  return text ? { text, className: 'item-row__status' } : null
}
