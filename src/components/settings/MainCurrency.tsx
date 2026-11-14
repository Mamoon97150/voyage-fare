import { useState } from 'react'
import { FormMessage } from '../AuthForm'
import { SketchBox } from '../Sketch'
import { explainAuthError } from '../../lib/authForm'
import { formatMoney } from '../../lib/money'
import { fetchRate, formatRate, parseRate } from '../../lib/rates'
import { changeTripCurrency, type TripDetail } from '../../lib/trips'
import { CURRENCIES, currencyLabel } from '../../lib/tripText'

/**
 * The main currency: totals, the target and who-owes-whom are in it. It can change until the
 * first payment (decision 12 Nov); every price keeps its own currency and its rate is converted.
 */
export function MainCurrency({ detail, onChanged }: { detail: TripDetail; onChanged: () => void }) {
  const from = detail.trip.currency
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [inverted, setInverted] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const fixed = detail.items.some((i) => i.status === 'paid')

  async function pick(next: string) {
    setTo(next)
    setError(undefined)
    if (!next) return
    setState('loading')
    const r = await fetchRate(from, next)
    if (r === null) {
      setText('')
      setState('failed')
      return
    }
    setInverted(r < 1)
    setText(formatRate(r < 1 ? 1 / r : r))
    setShown(r < 1 ? 1 / r : r)
    setState('idle')
  }

  const [shown, setShown] = useState<number | null>(null)
  const typed = text.trim() ? parseRate(text, shown) : null
  // What 1 of the current currency is worth in the new one.
  const rate = typed !== null ? (inverted ? 1 / typed : typed) : null
  const target = detail.trip.target_amount === null ? null : Number(detail.trip.target_amount)

  async function change() {
    if (!to || rate === null) {
      setError(text.trim() ? 'That rate doesn’t look right: type it like 1,1531.' : `What’s the rate? 1 ${from} is how many ${to}?`)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await changeTripCurrency(detail.trip.id, to, Math.round(rate * 1e8) / 1e8)
      setOpen(false)
      setTo('')
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SketchBox weight="light" className="form__sheet" seed={73}>
      <h2 className="sheet-title">Main currency</h2>
      <div className="kv">
        <span>Totals and shares in</span>
        <b>{currencyLabel(from)}</b>
      </div>
      {fixed ? (
        <p className="field__hint">Fixed since the first payment: who owes whom is counted in it.</p>
      ) : !open ? (
        <>
          <p className="field__hint">It can change until the first payment; after that it’s fixed.</p>
          <button type="button" className="button button--quiet" onClick={() => setOpen(true)}>
            Change the main currency
          </button>
        </>
      ) : (
        <div className="currency-change">
          <div className="field">
            <label htmlFor="new-currency" className="field__label">
              New main currency
            </label>
            <select id="new-currency" className="field__input" value={to} onChange={(e) => void pick(e.target.value)}>
              <option value="">Pick one</option>
              {CURRENCIES.filter((c) => c !== from).map((c) => (
                <option key={c} value={c}>
                  {currencyLabel(c)}
                </option>
              ))}
            </select>
          </div>
          {to && (
            <div className="field">
              <label htmlFor="new-currency-rate" className="field__label">
                Rate
              </label>
              <div className="field__box rate">
                <span className="rate__left num">1 {inverted ? to : from} =</span>
                <input
                  id="new-currency-rate"
                  className="field__input num"
                  inputMode="decimal"
                  value={text}
                  placeholder={state === 'loading' ? '…' : ''}
                  onChange={(e) => setText(e.target.value)}
                />
                <span className="field__unit">{inverted ? from : to}</span>
              </div>
              <p className="field__hint">
                {state === 'loading'
                  ? 'Getting today’s rate…'
                  : state === 'failed'
                    ? 'Couldn’t get today’s rate: type it.'
                    : 'Today’s rate. Every price keeps its own currency; the ones in ' + from + ' are converted with it.'}
                {target !== null && rate !== null && (
                  <b className="num"> Your target becomes {formatMoney(Math.round(target * rate), to)}.</b>
                )}
              </p>
            </div>
          )}
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="button button--primary" disabled={busy || !to} onClick={() => void change()}>
              {busy ? 'Changing…' : to ? `Change to ${to}` : 'Change'}
            </button>
          </div>
        </div>
      )}
    </SketchBox>
  )
}
