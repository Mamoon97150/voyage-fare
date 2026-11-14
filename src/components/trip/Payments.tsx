import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { formatMoney, parseAmount } from '../../lib/money'
import { useRate } from '../../lib/rates'
import { addPayment, deletePayment, setItemDue, type Item, type PaymentKind, type TripDetail } from '../../lib/trips'
import { isSolo, leftLine } from '../../lib/tripView'
import { localToday } from '../../lib/tripText'
import { FormMessage } from '../AuthForm'
import { CurrencyPicker, RateField } from '../RateField'

const KINDS: { key: PaymentKind; label: string }[] = [
  { key: 'deposit', label: 'Deposit' },
  { key: 'balance', label: 'Balance' },
  { key: 'instalment', label: 'Instalment' },
]
const KIND_WORD: Record<string, string> = { deposit: 'Deposit', balance: 'Balance', instalment: 'Instalment', payment: 'Paid' }
const EACH = 'each'
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayOf = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`))

/**
 * Paid in parts (mockup left-to-pay-v4, step 1): on a booked line, what's been paid (each payment,
 * who, when), what's left and by when, and "+ Add a payment". The budget already counts the full
 * price: paying only changes what's left.
 */
export function PaymentsPanel({ detail, item, viewer, onChanged }: { detail: TripDetail; item: Item; viewer: string | null; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()
  const line = leftLine(detail, item, viewer, 'total')
  // Only booked lines take payments; a line paid in one go keeps its "Paid" (Where it stands).
  if (!line || (item.status === 'paid' && !line.hasPayments)) return null
  const currency = detail.trip.currency
  const payments = (detail.payments ?? []).filter((p) => p.item_id === item.id)
  const name = (id: string | null) => detail.travellers.find((t) => t.id === id)?.name ?? ''

  async function remove(id: string) {
    setError(undefined)
    try {
      await deletePayment(id)
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <section className="payments" aria-label="Payments">
      <h3 className="sheet-title">
        Payments <small className="sheet-title__note">{formatMoney(line.paid + line.left, currency)} in all</small>
      </h3>
      {payments.length > 0 && (
        <>
          <p className="payments__label">Paid so far</p>
          <ul className="payments__list">
            {payments.map((p) => (
              <li key={p.id} className="payments__row">
                <span>
                  <span className="payments__kind">{KIND_WORD[p.kind] ?? 'Paid'}</span>
                  <small>
                    {p.paid_each ? 'each their own share' : name(p.paid_by)} · {dayOf(p.paid_on)}
                    {p.currency !== currency ? ` · ${formatMoney(Number(p.amount), p.currency)}` : ''}
                  </small>
                </span>
                <b className="num">{formatMoney(Math.round(Number(p.amount) * Number(p.rate) * 100) / 100, currency)}</b>
                <button type="button" className="payments__remove" onClick={() => void remove(p.id)} aria-label={`Delete this payment of ${formatMoney(Number(p.amount), p.currency)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {line.left > 0 ? (
        <div className="payments__left">
          <span>
            Left to pay
            <DueDate item={item} onChanged={onChanged} />
          </span>
          <b className="num">{formatMoney(line.left, currency)}</b>
        </div>
      ) : (
        <div className="payments__left payments__left--done">
          <span>Paid in full</span>
          <b aria-hidden="true">✓</b>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {line.left > 0 &&
        (adding ? (
          <PaymentForm
            detail={detail}
            item={item}
            viewer={viewer}
            left={line.left}
            onDone={() => {
              setAdding(false)
              onChanged()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="add-row" onClick={() => setAdding(true)}>
            <span className="add-row__plus" aria-hidden="true">
              +
            </span>
            Add a payment
          </button>
        ))}
      <p className="hand payments__note">the budget already counts the full price: paying only changes what’s left</p>
    </section>
  )
}

/** "by 12 Sept" — tap to set or change when the balance is due. */
function DueDate({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [value, setValue] = useState(item.due_on ?? '')
  const [error, setError] = useState<string>()
  async function save(next: string) {
    setValue(next)
    setError(undefined)
    try {
      await setItemDue(item.id, next || null)
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    }
  }
  return (
    <label className="payments__due">
      <span className="hand">{value ? `by ${dayOf(value)}` : 'when? (optional)'}</span>
      <input type="date" className="field__input" value={value} onChange={(e) => void save(e.target.value)} aria-label="Balance due on" />
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </label>
  )
}

/** One payment: what it is, how much (any currency), the day, who paid. Says what it leaves. */
function PaymentForm({
  detail,
  item,
  viewer,
  left,
  onDone,
  onCancel,
}: {
  detail: TripDetail
  item: Item
  viewer: string | null
  left: number
  onDone: () => void
  onCancel: () => void
}) {
  const trip = detail.trip.currency
  const hasPayments = (detail.payments ?? []).some((p) => p.item_id === item.id)
  const [kind, setKind] = useState<PaymentKind>(hasPayments ? 'balance' : 'deposit')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(localToday())
  const [paidBy, setPaidBy] = useState(viewer ?? detail.travellers[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const rate = useRate(trip, trip, 1)
  const solo = isSolo(detail)
  const id = `pay-${item.id}`
  const typed = amount.trim() ? parseAmount(amount) : null
  const inTrip = typed !== null && rate.rate !== null ? Math.round(typed * rate.rate * 100) / 100 : null
  const after = inTrip === null ? null : Math.round((left - inTrip) * 100) / 100

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (typed === null || typed <= 0) {
      setError('Enter the amount paid, like 120.')
      return
    }
    const foreign = rate.currency !== trip
    if (foreign && rate.rate === null) {
      setError(`What’s the rate? 1 ${rate.currency} is how many ${trip}?`)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await addPayment({
        itemId: item.id,
        kind,
        amount: typed,
        ...(foreign ? { currency: rate.currency, rate: rate.rate! } : {}),
        paidBy: paidBy === EACH ? null : paidBy,
        each: paidBy === EACH,
        paidOn,
      })
      onDone()
    } catch (err) {
      setBusy(false)
      setError(explainAuthError(err as { message?: string }).message)
    }
  }

  return (
    <form className="add-item payment-form" onSubmit={submit} noValidate aria-label="A payment">
      <div className="field">
        <span className="field__label" aria-hidden="true">
          What is it?
        </span>
        <div className="chip-grid" role="radiogroup" aria-label="Kind of payment">
          {KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className="chip chip--pick" onClick={() => setKind(k.key)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label htmlFor={`${id}-amount`} className="field__label">
            Amount
          </label>
          <div className="field__box">
            <input id={`${id}-amount`} className="field__input num" inputMode="decimal" value={amount} placeholder={String(left)} onChange={(e) => setAmount(e.target.value)} />
            <CurrencyPicker id={`${id}-currency`} rate={rate} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-on`} className="field__label">
            On
          </label>
          <input id={`${id}-on`} type="date" className="field__input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
      </div>
      <RateField id={`${id}-rate`} rate={rate} amount={typed} />
      {!solo && (
        <div className="field">
          <label htmlFor={`${id}-by`} className="field__label">
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
      {after !== null && (
        <p className="hand">
          {after <= 0 ? (
            <>
              = what was left: {item.name} will be <b>paid in full</b>
            </>
          ) : (
            `leaves ${formatMoney(after, trip)} to pay`
          )}
        </p>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="add-item__actions">
        <button type="button" className="button button--quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  )
}
