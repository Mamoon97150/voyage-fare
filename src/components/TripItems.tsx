import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../lib/authForm'
import { formatMoney, NO_AMOUNT } from '../lib/money'
import { addItem, type Item, type ItemKind, type TripDetail } from '../lib/trips'
import { dayLabel, daysText, itemLine, KINDS, SPANS_DAYS, type Mode } from '../lib/tripView'
import { FormMessage } from './AuthForm'

const STATUS: Record<string, string> = { idea: 'Idea', chosen: 'Chosen', booked: 'Booked', paid: 'Paid' }

/** One line of the notebook: a dot (green confirmed, mustard estimated, hollow no price), the name, the amount. */
export function ItemRow({
  detail,
  item,
  viewer,
  mode,
  showDays = true,
}: {
  detail: TripDetail
  item: Item
  viewer: string | null
  mode: Mode
  showDays?: boolean
}) {
  const line = itemLine(detail, item, viewer, mode)
  const dot = !line.priced ? 'dot--none' : line.confirmed ? 'dot--confirmed' : 'dot--estimated'
  const meta = [KINDS[item.kind as ItemKind]?.label, showDays ? daysText(item) : null, item.note].filter(Boolean).join(' · ')
  return (
    <li className="item-row">
      <i className={`dot ${dot}`} aria-hidden="true" />
      <span className="item-row__main">
        <span className="item-row__name">{item.name}</span>
        {meta && <span className="item-row__meta">{meta}</span>}
      </span>
      <span className="item-row__amount num">
        <b>{line.concernsViewer ? formatMoney(line.amount, detail.trip.currency) : 'Not yours'}</b>
        <span className="item-row__status">{STATUS[item.status] ?? item.status}</span>
      </span>
    </li>
  )
}

/** Add something to a place or to the whole trip. A price is optional: without one, it's an idea. */
export function AddItem({
  detail,
  placeId,
  kinds,
  days,
  onAdded,
  onCancel,
}: {
  detail: TripDetail
  placeId: string | null
  kinds: ItemKind[]
  days: number
  onAdded: () => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<ItemKind>(kinds[0])
  const [name, setName] = useState('')
  const [day, setDay] = useState('')
  const [endDay, setEndDay] = useState('')
  const [price, setPrice] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const id = placeId ?? 'trip'
  const currency = detail.trip.currency
  const spans = SPANS_DAYS.includes(kind)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give it a name.'
    const amount = price.trim() ? Number(price.replace(/\s/g, '').replace(',', '.')) : null
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) found.price = 'Enter an amount, like 120.'
    const start = day ? Number(day) : null
    const end = spans && endDay ? Number(endDay) : null
    if (end !== null && (start === null || end < start)) found.endDay = 'Pick a last day after the first one.'
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await addItem({ tripId: detail.trip.id, placeId, kind, name: name.trim(), dayNumber: start, endDayNumber: end, amount })
      onAdded()
    } catch (error) {
      setBusy(false)
      setFormError(explainAuthError(error as { message?: string }).message)
    }
  }

  const dayOptions = Array.from({ length: days }, (_, i) => i + 1)

  return (
    <form onSubmit={submit} noValidate className="add-item">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <div className="kinds" role="radiogroup" aria-label="What is it?">
        {kinds.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className="kind" onClick={() => setKind(k)}>
            <span aria-hidden="true">{KINDS[k].icon}</span> {KINDS[k].label}
          </button>
        ))}
      </div>

      <div className={`field${errors.name ? ' field--error' : ''}`}>
        <label htmlFor={`item-name-${id}`} className="field__label">
          Name
        </label>
        <input
          id={`item-name-${id}`}
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'housing' ? 'Casa Lola' : kind === 'transport' ? 'Flights' : 'Rosario islands'}
          autoFocus
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `item-name-${id}-error` : undefined}
        />
        {errors.name && (
          <p id={`item-name-${id}-error`} className="field__error">
            {errors.name}
          </p>
        )}
      </div>

      {days > 0 && (
        <div className={spans ? 'row2' : undefined}>
          <div className="field">
            <label htmlFor={`item-day-${id}`} className="field__label">
              {spans ? 'From' : 'Day'}
            </label>
            <select id={`item-day-${id}`} className="field__input" value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">No day yet</option>
              {dayOptions.map((n) => (
                <option key={n} value={n}>
                  {dayLabel(n, detail.trip.start_date)}
                </option>
              ))}
            </select>
          </div>
          {spans && (
            <div className={`field${errors.endDay ? ' field--error' : ''}`}>
              <label htmlFor={`item-end-${id}`} className="field__label">
                Until
              </label>
              <select
                id={`item-end-${id}`}
                className="field__input"
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
                aria-invalid={errors.endDay ? true : undefined}
                aria-describedby={errors.endDay ? `item-end-${id}-error` : undefined}
              >
                <option value="">—</option>
                {dayOptions.map((n) => (
                  <option key={n} value={n}>
                    {dayLabel(n, detail.trip.start_date)}
                  </option>
                ))}
              </select>
              {errors.endDay && (
                <p id={`item-end-${id}-error`} className="field__error">
                  {errors.endDay}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`field${errors.price ? ' field--error' : ''}`}>
        <label htmlFor={`item-price-${id}`} className="field__label">
          Price
        </label>
        <div className="field__box">
          <input
            id={`item-price-${id}`}
            className="field__input num"
            inputMode="decimal"
            placeholder={NO_AMOUNT}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={errors.price ? `item-price-${id}-error` : `item-price-${id}-hint`}
          />
          <span className="field__unit">{currency}</span>
        </div>
        {errors.price ? (
          <p id={`item-price-${id}-error`} className="field__error">
            {errors.price}
          </p>
        ) : (
          <p id={`item-price-${id}-hint`} className="field__hint">
            The whole price, your best guess. No price yet? Leave it empty: it stays an idea.
          </p>
        )}
      </div>

      <div className="add-item__actions">
        <button type="button" className="button button--quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy || undefined}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  )
}
