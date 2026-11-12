import { formatMoney } from '../lib/money'

type Props = {
  label: string
  confirmed: number
  estimated: number
  currency?: string
}

/** Confirmed vs still estimated, per person. First draft of the always-visible budget bar. */
export function BudgetBar({ label, confirmed, estimated, currency = 'EUR' }: Props) {
  const total = confirmed + estimated
  const share = (part: number) => (total > 0 ? `${(part / total) * 100}%` : '0%')

  return (
    <section className="card" aria-label={label}>
      <p className="card__label">{label}</p>
      <p className="budget-bar__figure">{formatMoney(total, currency, 'pp')}</p>
      <div className="budget-bar__track" aria-hidden="true">
        <div className="budget-bar__confirmed" style={{ width: share(confirmed) }} />
        <div className="budget-bar__estimated" style={{ width: share(estimated) }} />
      </div>
      <ul className="budget-bar__legend">
        <li>
          <span className="dot dot--confirmed" />
          Confirmed {formatMoney(confirmed, currency)}
        </li>
        <li>
          <span className="dot dot--estimated" />
          Still estimated {formatMoney(estimated, currency)}
        </li>
      </ul>
    </section>
  )
}
