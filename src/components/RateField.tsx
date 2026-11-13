import { formatMoney } from '../lib/money'
import type { RateState } from '../lib/rates'
import { CURRENCIES } from '../lib/tripText'

/** The currency beside a price: a small picker in place of the unit. */
export function CurrencyPicker({ id, rate, label = 'Currency' }: { id: string; rate: RateState; label?: string }) {
  const codes = CURRENCIES.includes(rate.currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [rate.currency, ...CURRENCIES]
  return (
    <select
      id={id}
      className="field__unit field__unit--pick"
      aria-label={label}
      value={rate.currency}
      onChange={(e) => void rate.setCurrency(e.target.value)}
    >
      {[rate.tripCurrency, ...codes.filter((c) => c !== rate.tripCurrency)].map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

/**
 * Under a price in another currency: today's rate, saved with it, and what it comes to.
 * "1 EUR = 3 645 COP" or "1 USD = 0,9035 EUR", whichever reads better.
 */
export function RateField({ id, rate, amount, error }: { id: string; rate: RateState; amount: number | null; error?: string }) {
  if (rate.currency === rate.tripCurrency) return null
  const [left, right] = rate.inverted ? [rate.tripCurrency, rate.currency] : [rate.currency, rate.tripCurrency]
  const converted = amount !== null && rate.rate !== null ? amount * rate.rate : null
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id} className="field__label">
        Rate
      </label>
      <div className="field__box rate">
        <span className="rate__left num">1 {left} =</span>
        <input
          id={id}
          className="field__input num"
          inputMode="decimal"
          value={rate.text}
          placeholder={rate.state === 'loading' ? '…' : ''}
          onChange={(e) => rate.setText(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
        />
        <span className="field__unit">{right}</span>
      </div>
      {error && <p className="field__error">{error}</p>}
      <p id={`${id}-hint`} className="field__hint">
        {rate.state === 'loading'
          ? 'Getting today’s rate…'
          : rate.state === 'failed'
            ? 'Couldn’t get today’s rate: type it from your bank or the booking.'
            : rate.state === 'saved'
              ? 'The rate saved with the price.'
              : 'Today’s rate, saved with the price.'}
        {converted !== null && <b className="num"> ≈ {formatMoney(Math.round(converted), rate.tripCurrency)}</b>}
      </p>
    </div>
  )
}
