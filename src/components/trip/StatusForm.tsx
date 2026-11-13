import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { amountForInput, parseAmount } from '../../lib/money'
import { setItemStatus, type Item, type ItemStatus, type TripDetail } from '../../lib/trips'
import { isSolo } from '../../lib/tripView'
import { FormMessage } from '../AuthForm'
import { priceOf } from './itemShared'

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
  const estimate = priceOf(detail, item)
  const [status, setStatus] = useState<ItemStatus>(initial)
  const [amount, setAmount] = useState(amountForInput(item.actual_amount ?? estimate))
  const [paidBy, setPaidBy] = useState(item.paid_by ?? viewer ?? detail.travellers[0]?.id ?? '')
  const [paidOn, setPaidOn] = useState(() => item.paid_on ?? new Date().toISOString().slice(0, 10))
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
    setBusy(true)
    setError(undefined)
    try {
      await setItemStatus({
        id: item.id,
        status,
        actualAmount: status === 'chosen' ? null : actual,
        paidBy: status === 'paid' ? paidBy : null,
        paidOn: status === 'paid' ? paidOn : null,
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
            <input
              id={`${id}-amount`}
              className="field__input num"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={status === 'booked' ? 'when you know' : ''}
            />
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
              : 'Confirmed. Who owes whom comes with “Who paid”.'}
      </p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <button type="submit" className="button button--quiet" disabled={busy}>
        {busy ? 'Saving…' : 'Save where it stands'}
      </button>
    </form>
  )
}
