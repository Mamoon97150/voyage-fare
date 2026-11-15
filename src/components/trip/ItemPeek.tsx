import { formatWhole } from '../../lib/money'
import type { Item, TripDetail } from '../../lib/trips'
import { shortDay } from '../../lib/tripText'
import { priceOf } from './itemShared'

const KIND: Record<string, string> = {
  deposit: 'Deposit',
  balance: 'Balance',
  instalment: 'Instalment',
  payment: 'Paid',
}

/**
 * In the demo, tapping a line shows its details instead of the form to change it (mockup demo-v5):
 * the whole price, who it's for, who paid.
 */
export function ItemPeek({ detail, item }: { detail: TripDetail; item: Item }) {
  const currency = detail.trip.currency
  const name = (id: string | null) => detail.travellers.find((t) => t.id === id)?.name ?? null
  const price = priceOf(detail, item)
  const sharers = detail.shares.filter((s) => s.item_id === item.id && Number(s.fraction) > 0)
  const everyone = sharers.length === detail.travellers.length
  const equal = sharers.length > 0 && sharers.every((s) => Number(s.fraction) === Number(sharers[0].fraction))
  const payments = (detail.payments ?? []).filter((p) => p.item_id === item.id)

  const paid = payments.length
    ? payments
        .map(
          (p) =>
            `${KIND[p.kind] ?? 'Paid'} ${formatWhole(Number(p.amount) * Number(p.rate), currency)} by ${
              p.paid_each ? 'each' : name(p.paid_by)
            }, ${shortDay(p.paid_on)}`,
        )
        .join(' · ')
    : item.status === 'paid'
      ? [item.paid_each ? 'each their own share' : name(item.paid_by), item.paid_on ? shortDay(item.paid_on) : null]
          .filter(Boolean)
          .join(', ')
      : null

  return (
    <div className="item-peek">
      <dl>
        {price !== null && (
          <>
            <dt>Whole price</dt>
            <dd className="num">
              {item.package_id ? 'in the package' : formatWhole(price, currency)}
              {!item.package_id && sharers.length > 0 ? ` for ${sharers.length}` : ''}
            </dd>
          </>
        )}
        {sharers.length > 0 && (
          <>
            <dt>Who it’s for</dt>
            <dd>
              {everyone ? 'everyone' : sharers.map((s) => name(s.traveller_id)).join(', ')}
              {equal && price !== null && !item.package_id
                ? `, ${formatWhole(price * Number(sharers[0].fraction), currency)} each`
                : ''}
            </dd>
          </>
        )}
        {paid && (
          <>
            <dt>Paid</dt>
            <dd>{paid}</dd>
          </>
        )}
      </dl>
      <p className="hand item-peek__note">in your own notebook, this is where you’d change it</p>
    </div>
  )
}
