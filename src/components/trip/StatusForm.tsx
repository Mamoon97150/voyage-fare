import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { amountForInput, parseAmount } from '../../lib/money'
import { setItemStatus, type Item, type ItemStatus, type TripDetail } from '../../lib/trips'
import { isSolo } from '../../lib/tripView'
import { FormMessage } from '../AuthForm'
import { useRate } from '../../lib/rates'
import { localToday } from '../../lib/tripText'
import { CurrencyPicker, RateField } from '../RateField'

const EACH = 'each'

const STEPS: { key: ItemStatus; label: string }[] = [
  { key: 'chosen', label: 'Chosen' },
  { key: 'booked', label: 'Booked' },
  { key: 'paid', label: 'Paid' },
]

/**
 * Where it stands: chosen → booked → paid. Booked or paid with the amount really paid makes the
 * line confirmed (green). Paid also says who paid: the balances come with "Who paid".
 * Only shown once an option is chosen (an idea has nothing to book).
 */
export function StatusForm({
  detail,
  item,
  viewer,
  onSaved,
}: {
  detail: TripDetail
  item: Item
  viewer: string | null
  onSaved: () => void
}) {
  const initial = (item.status === 'booked' || item.status === 'paid' ? item.status : 'chosen') as ItemStatus
  // What was really paid starts as the chosen option's price, in its own currency and saved rate.
  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  const trip = detail.trip.currency
  const rate = useRate(
    trip,
    item.actual_currency ?? chosen?.currency ?? trip,
    item.actual_currency ? Number(item.actual_rate) : chosen ? Number(chosen.rate) : 1,
  )
  const start = item.actual_amount ?? chosen?.amount ?? null
  const [status, setStatus] = useState<ItemStatus>(initial)
  const [amount, setAmount] = useState(amountForInput(start === null ? null : Number(start)))
  // A traveller's id, or EACH: everyone on the line paid their own share (build 4).
  const [paidBy, setPaidBy] = useState(item.paid_each ? EACH : (item.paid_by ?? viewer ?? detail.travellers[0]?.id ?? ''))
  const [paidOn, setPaidOn] = useState(() => item.paid_on ?? localToday())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const solo = isSolo(detail)
  const id = `status-${item.id}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    const empty = amount.trim() === ''
    const actual = empty ? null : parseAmount(amount)
    if (status !== 'chosen' && !empty && actual === null) {
      setError('That amount doesn’t look right.')
      return
    }
    if (status === 'paid' && actual === null) {
      setError('How much was really paid?')
      return
    }
    const foreign = status !== 'chosen' && actual !== null && rate.currency !== trip
    if (foreign && rate.rate === null) {
      setError(rate.unreadable ? 'That rate doesn’t look right: type it like 1,1531.' : `What’s the rate? 1 ${rate.currency} is how many ${trip}?`)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await setItemStatus({
        id: item.id,
        status,
        actualAmount: status === 'chosen' ? null : actual,
        paidBy: status === 'paid' && paidBy !== EACH ? paidBy : null,
        paidEach: status === 'paid' && paidBy === EACH,
        paidOn: status === 'paid' ? paidOn : null,
        ...(foreign ? { actualCurrency: rate.currency, actualRate: rate.rate ?? undefined } : {}),
      })
      onSaved()
    } catch (err) {
      setError(explainAuthError(err as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="status-form" onSubmit={submit} aria-label={`Where ${item.name} stands`}>
      <h3 className="sheet-title">Where it stands</h3>
      <div className="steps" role="radiogroup" aria-label="Status">
        {STEPS.map((s) => (
          <button key={s.key} type="button" role="radio" aria-checked={status === s.key} onClick={() => setStatus(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {status !== 'chosen' && (
        <div className="row2">
          <div className="field">
            <label className="field__label" htmlFor={`${id}-amount`}>
              {status === 'paid' ? 'Really paid' : 'Booked for'}
            </label>
            <div className="field__box">
              <input
                id={`${id}-amount`}
                className="field__input num"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={status === 'booked' ? 'when you know' : ''}
              />
              <CurrencyPicker id={`${id}-currency`} rate={rate} label="Currency paid in" />
            </div>
          </div>
          {status === 'paid' && (
            <div className="field">
              <label className="field__label" htmlFor={`${id}-on`}>
                On
              </label>
              <input id={`${id}-on`} type="date" className="field__input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
          )}
        </div>
      )}
      {status !== 'chosen' && <RateField id={`${id}-rate`} rate={rate} amount={amount.trim() ? parseAmount(amount) : null} />}
      {status === 'paid' && !solo && (
        <div className="field">
          <label className="field__label" htmlFor={`${id}-by`}>
            Paid by
          </label>
          <select id={`${id}-by`} className="field__input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {detail.travellers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={EACH}>Each paid their own share</option>
          </select>
        </div>
      )}
      <p className="field__hint">
        {status === 'chosen'
          ? 'Not booked yet: the price stays an estimate.'
          : status === 'booked'
            ? 'With the amount, the line turns confirmed.'
            : solo
              ? 'Confirmed, at what you really paid.'
              : paidBy === EACH
                ? 'Confirmed. Everyone paid their own part: nobody owes anything for it.'
                : 'Confirmed. Who owes whom is on “Who paid”.'}
      </p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <button type="submit" className="button button--quiet" disabled={busy}>
        {busy ? 'Saving…' : 'Save where it stands'}
      </button>
    </form>
  )
}

