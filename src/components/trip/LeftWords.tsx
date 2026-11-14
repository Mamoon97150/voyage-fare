import { formatWhole } from '../../lib/money'
import { plural } from '../../lib/tripText'
import type { LeftLine } from '../../lib/tripView'

/**
 * Under a booked line paid in parts (mockup left-to-pay-v4, step 1):
 * - "left": "deposit paid · 37 € left" under the amount;
 * - "reminder": in handwriting, "balance due in 5 days" (a week before) or "balance late" — mustard,
 *   with the "to decide" dot; never red (red is over budget only).
 */
export function LeftWords({ line, currency = '', part }: { line: LeftLine | null; currency?: string; part: 'left' | 'reminder' }) {
  if (!line || line.left <= 0) return null
  if (part === 'left') {
    if (!line.hasPayments || line.leftShown <= 0) return null
    return <span className="item-row__left">
        {line.paidWord} · {formatWhole(line.leftShown, currency)} left
      </span>
  }
  if (line.dueIn === null || line.dueIn > 7) return null
  const text =
    line.dueIn < 0
      ? `balance late by ${plural(-line.dueIn, 'day')}`
      : line.dueIn === 0
        ? 'balance due today'
        : `balance due in ${plural(line.dueIn, 'day')}`
  return (
    <span className="item-row__soon">
      <span className="dot-todo" aria-hidden="true" />
      {text}
    </span>
  )
}
