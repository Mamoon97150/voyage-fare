import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../lib/authForm'
import { NO_AMOUNT } from '../lib/money'
import type { TicketChange, TicketMode, TripDetail } from '../lib/trips'
import { legsAfter, MODES, suggestedRoute } from '../lib/tripView'
import { FormMessage } from './AuthForm'
import { FormActions } from './FormActions'

const START = 'start'
const gapOf = (placeId: string | null) => placeId ?? START
const placeOf = (gap: string) => (gap === START ? null : gap)

/**
 * A ticket: one price, 1 or 2 legs placed in the route (mockup: trip view v3), for adding or changing it.
 * When adding, the cities are suggested from where it sits, so it's often just a price to type.
 */
export function TicketForm({
  detail,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  deleteName,
  deleteNote,
}: {
  detail: TripDetail
  initial?: TicketChange
  submitLabel: string
  onSubmit: (ticket: TicketChange) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  deleteName?: string
  deleteNote?: string
}) {
  const { places, trip } = detail
  const last = places[places.length - 1]?.id ?? START
  // A new ticket goes in the first gap of the route that has none yet; usually it leaves home.
  const firstFree = [START, ...places.map((p) => p.id)].find((gap) => legsAfter(detail, placeOf(gap)).length === 0)
  const startGap = initial ? gapOf(initial.afterPlaceId) : (firstFree ?? START)
  const suggested = suggestedRoute(detail, placeOf(startGap))

  const [where, setWhere] = useState(startGap)
  const [from, setFrom] = useState(initial?.from ?? suggested.from)
  const [to, setTo] = useState(initial?.to ?? suggested.to)
  const [edited, setEdited] = useState(Boolean(initial))
  const [mode, setMode] = useState<TicketMode>(initial?.mode ?? 'plane')
  const [roundTrip, setRoundTrip] = useState(initial ? initial.roundTrip : startGap === START && places.length > 0)
  const [returnWhere, setReturnWhere] = useState(initial?.roundTrip ? gapOf(initial.returnAfterPlaceId) : last)
  const [via, setVia] = useState(initial?.via ?? '')
  const [price, setPrice] = useState(initial?.amount === null || initial?.amount === undefined ? '' : String(initial.amount))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)

  function moveTo(gap: string) {
    setWhere(gap)
    if (!edited) {
      const s = suggestedRoute(detail, placeOf(gap))
      setFrom(s.from)
      setTo(s.to)
      if (gap !== START) setRoundTrip(false)
    }
  }

  const gapLabel = (gap: string) => {
    if (gap === START) return places[0] ? `Before ${places[0].name} (the start)` : 'At the start'
    const i = places.findIndex((p) => p.id === gap)
    return i === places.length - 1 ? `After ${places[i].name} (the end)` : `After ${places[i].name}`
  }
  const gaps = [START, ...places.map((p) => p.id)]

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!from.trim()) found.from = 'Where does it leave from?'
    if (!to.trim()) found.to = 'Where does it go?'
    const amount = price.trim() ? Number(price.replace(/\s/g, '').replace(',', '.')) : null
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) found.price = 'Enter an amount, like 900.'
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await onSubmit({
        from: from.trim(),
        to: to.trim(),
        mode,
        via: via.trim() || null,
        afterPlaceId: placeOf(where),
        roundTrip,
        returnAfterPlaceId: roundTrip ? placeOf(returnWhere) : null,
        amount,
      })
    } catch (error) {
      setBusy(false)
      setFormError(explainAuthError(error as { message?: string }).message)
    }
  }

  const field = (key: string, label: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <div className={`field${errors[key] ? ' field--error' : ''}`}>
      <label htmlFor={`ticket-${key}`} className="field__label">
        {label}
      </label>
      <input
        id={`ticket-${key}`}
        className="field__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          set(e.target.value)
          if (key === 'from' || key === 'to') setEdited(true)
        }}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `ticket-${key}-error` : undefined}
      />
      {errors[key] && (
        <p id={`ticket-${key}-error`} className="field__error">
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="add-ticket">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}

      {places.length > 0 && (
        <div className="field">
          <label htmlFor="ticket-where" className="field__label">
            In the route
          </label>
          <select id="ticket-where" className="field__input" value={where} onChange={(e) => moveTo(e.target.value)}>
            {gaps.map((g) => (
              <option key={g} value={g}>
                {gapLabel(g)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row2">
        {field('from', 'From', from, setFrom, trip.home_city ?? 'St Martin')}
        {field('to', 'To', to, setTo, places[0]?.name ?? 'Cartagena')}
      </div>

      <div className="row2">
        <div className="field">
          <label htmlFor="ticket-mode" className="field__label">
            By
          </label>
          <select id="ticket-mode" className="field__input" value={mode} onChange={(e) => setMode(e.target.value as TicketMode)}>
            {(Object.keys(MODES) as TicketMode[]).map((m) => (
              <option key={m} value={m}>
                {MODES[m].icon} {MODES[m].label}
              </option>
            ))}
          </select>
        </div>
        {field('via', 'Via (optional)', via, setVia, 'Panama')}
      </div>

      <label className="check">
        <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
        Round trip, one ticket
      </label>
      {roundTrip && places.length > 0 && (
        <div className="field">
          <label htmlFor="ticket-return" className="field__label">
            The way back
          </label>
          <select id="ticket-return" className="field__input" value={returnWhere} onChange={(e) => setReturnWhere(e.target.value)}>
            {gaps.map((g) => (
              <option key={g} value={g}>
                {gapLabel(g)}
              </option>
            ))}
          </select>
          <p className="field__hint">Counted once: the way back shows “included”.</p>
        </div>
      )}

      <div className={`field${errors.price ? ' field--error' : ''}`}>
        <label htmlFor="ticket-price" className="field__label">
          Price{roundTrip ? ' (both ways)' : ''}
        </label>
        <div className="field__box">
          <input
            id="ticket-price"
            className="field__input num"
            inputMode="decimal"
            placeholder={NO_AMOUNT}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={errors.price ? 'ticket-price-error' : 'ticket-price-hint'}
          />
          <span className="field__unit">{trip.currency}</span>
        </div>
        {errors.price ? (
          <p id="ticket-price-error" className="field__error">
            {errors.price}
          </p>
        ) : (
          <p id="ticket-price-hint" className="field__hint">
            For everyone on the ticket. No price yet? Leave it empty: it stays an idea.
          </p>
        )}
      </div>

      <FormActions
        busy={busy}
        submitLabel={submitLabel}
        onCancel={onCancel}
        onDelete={onDelete}
        deleteName={deleteName}
        deleteNote={deleteNote}
      />
    </form>
  )
}
