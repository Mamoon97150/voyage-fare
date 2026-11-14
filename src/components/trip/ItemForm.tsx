import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { explainAuthError } from '../../lib/authForm'
import { NO_AMOUNT, parseAmount } from '../../lib/money'
import { addItem, addTicket, type ItemKind, type TripDetail } from '../../lib/trips'
import { dayLabel, kindLabel, SPANS_DAYS } from '../../lib/tripView'
import { FormMessage } from '../AuthForm'
import { FormActions } from '../FormActions'
import { TicketForm } from './TicketForm'

export type ItemValues = {
  kind: ItemKind
  name: string
  dayNumber: number | null
  endDayNumber: number | null
  amount: number | null
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
  const id = placeId ?? 'trip'
  const place = placeId ? detail.places.find((p) => p.id === placeId) : null
  const title = <FormTitle title={place ? `Add to ${place.name}` : 'Add to the whole trip'} note="no price yet? it stays an idea" />

  // A ticket on the whole trip goes somewhere: it gets its own form, with its route.
  if (kind === 'transport' && placeId === null) {
    return (
      <div className="add-item">
        {title}
        <KindPicker kinds={kinds} kind={kind} onKind={setKind} />
        <TicketForm
          detail={detail}
          submitLabel="Add the ticket"
          onSubmit={async (t) => {
            await addTicket({ tripId: detail.trip.id, name: null, ...t })
            onAdded()
          }}
          onCancel={onCancel}
        />
      </div>
    )
  }

  return (
    <ItemForm
      detail={detail}
      formId={`add-${id}`}
      kinds={kinds}
      days={days}
      kind={kind}
      onKind={setKind}
      title={title}
      submitLabel="Add"
      onSubmit={async (v) => {
        await addItem({ tripId: detail.trip.id, placeId, ...v })
        onAdded()
      }}
      onCancel={onCancel}
    />
  )
}

export function KindPicker({ kinds, kind, onKind }: { kinds: ItemKind[]; kind: ItemKind; onKind: (k: ItemKind) => void }) {
  // The place's list has stays; the whole trip's doesn't (its transport is a ticket: "Travel").
  const inPlace = kinds.includes('housing')
  return (
    <div className="field">
      <span className="field__label" aria-hidden="true">
        What is it?
      </span>
      <div className="chip-grid" role="radiogroup" aria-label="What is it?">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            aria-pressed={kind === k}
            className="chip chip--pick"
            onClick={() => onKind(k)}
          >
            <span className="chip__icon" aria-hidden="true">
              {kindLabel(k, inPlace).icon}
            </span>{' '}
            {kindLabel(k, inPlace).label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A form's title, like the estimate form's: the title, and a word in handwriting. */
export function FormTitle({ title, note }: { title: string; note?: string }) {
  return (
    <h3 className="sheet-title form-title">
      {title} {note && <small className="sheet-title__note hand-note">{note}</small>}
    </h3>
  )
}

/** The fields of an item, for adding or changing it. */
export function ItemForm({
  detail,
  formId,
  kinds,
  days,
  initial,
  kind: controlledKind,
  onKind,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  deleteName,
  options,
  nameLabel = 'Name',
  title,
}: {
  detail: TripDetail
  formId: string
  kinds: ItemKind[]
  days: number
  initial?: { kind: ItemKind; name: string; day: string; endDay: string; price: string }
  kind?: ItemKind
  onKind?: (k: ItemKind) => void
  submitLabel: string
  onSubmit: (values: ItemValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  deleteName?: string
  /** Several options: the price is the chosen one's, changed on Compare (shown instead of the field). */
  options?: { text: string; link: string | null }
  /** "What you're deciding" once the line shows the chosen option's name instead. */
  nameLabel?: string
  /** Shown at the top (adding: "Add to Cartagena"). */
  title?: ReactNode
}) {
  const [ownKind, setOwnKind] = useState<ItemKind>(initial?.kind ?? kinds[0])
  const kind = controlledKind ?? ownKind
  const setKind = onKind ?? setOwnKind
  const [name, setName] = useState(initial?.name ?? '')
  const [day, setDay] = useState(initial?.day ?? '')
  const [endDay, setEndDay] = useState(initial?.endDay ?? '')
  const [price, setPrice] = useState(initial?.price ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const id = formId
  const currency = detail.trip.currency
  const spans = SPANS_DAYS.includes(kind)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give it a name.'
    const amount = price.trim() ? parseAmount(price) : null
    if (price.trim() && amount === null) found.price = 'Enter an amount, like 120 or 1 200,50.'
    const start = day ? Number(day) : null
    const end = spans && endDay ? Number(endDay) : null
    if (end !== null && (start === null || end < start)) found.endDay = 'Pick a last day after the first one.'
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await onSubmit({ kind, name: name.trim(), dayNumber: start, endDayNumber: end, amount })
    } catch (error) {
      setBusy(false)
      setFormError(explainAuthError(error as { message?: string }).message)
    }
  }

  const dayOptions = Array.from({ length: days }, (_, i) => i + 1)

  return (
    <form onSubmit={submit} noValidate className="add-item">
      {title}
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <KindPicker kinds={kinds} kind={kind} onKind={setKind} />

      <div className={`field${errors.name ? ' field--error' : ''}`}>
        <label htmlFor={`${id}-name`} className="field__label">
          {nameLabel}
        </label>
        <input
          id={`${id}-name`}
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'housing' ? 'Casa Lola' : kind === 'transport' ? 'Ferry' : 'Rosario islands'}
          autoFocus
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
        />
        {errors.name && (
          <p id={`${id}-name-error`} className="field__error">
            {errors.name}
          </p>
        )}
      </div>

      {days > 0 && (
        <div className={spans ? 'row2' : undefined}>
          <div className="field">
            <label htmlFor={`${id}-day`} className="field__label">
              {spans ? 'From' : 'Day'}
            </label>
            <select id={`${id}-day`} className="field__input" value={day} onChange={(e) => setDay(e.target.value)}>
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
              <label htmlFor={`${id}-end`} className="field__label">
                Until
              </label>
              <select
                id={`${id}-end`}
                className="field__input"
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
                aria-invalid={errors.endDay ? true : undefined}
                aria-describedby={errors.endDay ? `${id}-end-error` : undefined}
              >
                <option value="">—</option>
                {dayOptions.map((n) => (
                  <option key={n} value={n}>
                    {dayLabel(n, detail.trip.start_date)}
                  </option>
                ))}
              </select>
              {errors.endDay && (
                <p id={`${id}-end-error`} className="field__error">
                  {errors.endDay}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {options ? (
        <div className="field">
          <span className="field__label">Price</span>
          <p className="options-note">
            {options.text}
            {options.link && (
              <>
                {' · '}
                <Link to={options.link}>Open in Compare</Link>
              </>
            )}
          </p>
        </div>
      ) : (
      <div className={`field${errors.price ? ' field--error' : ''}`}>
        <label htmlFor={`${id}-price`} className="field__label">
          Price
        </label>
        <div className="field__box">
          <input
            id={`${id}-price`}
            className="field__input num"
            inputMode="decimal"
            placeholder={NO_AMOUNT}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={errors.price ? `${id}-price-error` : `${id}-price-hint`}
          />
          <span className="field__unit">{currency}</span>
        </div>
        {errors.price ? (
          <p id={`${id}-price-error`} className="field__error">
            {errors.price}
          </p>
        ) : (
          <p id={`${id}-price-hint`} className="field__hint">
            The whole price, your best guess. No price yet? Leave it empty: it stays an idea.
          </p>
        )}
      </div>
      )}

      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} onDelete={onDelete} deleteName={deleteName} />
    </form>
  )
}
