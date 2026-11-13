import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../lib/authForm'
import { formatMoney, NO_AMOUNT } from '../lib/money'
import {
  addItem,
  addTicket,
  deleteItem,
  updateItem,
  updateTicket,
  type Item,
  type ItemKind,
  type TicketMode,
  type TripDetail,
} from '../lib/trips'
import { dayLabel, daysText, itemLine, KINDS, MODES, SPANS_DAYS, ticketOf, type LegLine, type Mode } from '../lib/tripView'
import { FormMessage } from './AuthForm'
import { FormActions } from './FormActions'
import { TicketForm } from './TicketForm'

// "Chosen" is the default and stays silent: the dot already says estimated or confirmed (review 13 Nov).
const STATUS: Record<string, string | undefined> = { idea: 'Idea', booked: 'Booked', paid: 'Paid' }

const priceOf = (detail: TripDetail, item: Item) => {
  const current = detail.amounts.find((a) => a.item_id === item.id)?.current
  return current === null || current === undefined ? null : Number(current)
}

/**
 * One line of the notebook: a dot (green confirmed, mustard estimated, hollow no price), the name,
 * the amount. Tapping it opens the same form as when adding, to change or delete it.
 */
export function ItemRow({
  detail,
  item,
  viewer,
  mode,
  kinds,
  days,
  showDays = true,
  onChanged,
  onOpen,
}: {
  detail: TripDetail
  item: Item
  viewer: string | null
  mode: Mode
  kinds: ItemKind[]
  days: number
  showDays?: boolean
  onChanged: () => void
  onOpen?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const line = itemLine(detail, item, viewer, mode)
  const dot = !line.priced ? 'dot--none' : line.confirmed ? 'dot--confirmed' : 'dot--estimated'
  const meta = [KINDS[item.kind as ItemKind]?.label, showDays ? daysText(item) : null, item.note].filter(Boolean).join(' · ')

  if (editing) {
    const price = priceOf(detail, item)
    return (
      <li className="item-row item-row--editing">
        <ItemForm
          detail={detail}
          formId={`edit-${item.id}`}
          kinds={kinds.includes(item.kind as ItemKind) ? kinds : [item.kind as ItemKind, ...kinds]}
          days={days}
          initial={{
            kind: item.kind as ItemKind,
            name: item.name,
            day: item.day_number ? String(item.day_number) : '',
            endDay: item.end_day_number ? String(item.end_day_number) : '',
            price: price === null ? '' : String(price),
          }}
          submitLabel="Save"
          onSubmit={async (v) => {
            await updateItem({ id: item.id, ...v })
            setEditing(false)
            onChanged()
          }}
          onDelete={async () => {
            await deleteItem(item.id)
            onChanged()
          }}
          deleteName={item.name}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="item-row">
      <button
        type="button"
        className="item-row__tap"
        onClick={() => {
          setEditing(true)
          onOpen?.()
        }}
        aria-label={`Change ${item.name}`}
      >
        <i className={`dot ${dot}`} aria-hidden="true" />
        <span className="item-row__main">
          <span className="item-row__name">{item.name}</span>
          {meta && <span className="item-row__meta">{meta}</span>}
        </span>
        <span className="item-row__amount num">
          <b>{line.concernsViewer ? formatMoney(line.amount, detail.trip.currency) : 'Not yours'}</b>
          {STATUS[item.status] && <span className="item-row__status">{STATUS[item.status]}</span>}
        </span>
        <span className="item-row__chev" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}

type ItemValues = {
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

  // A ticket on the whole trip goes somewhere: it gets its own form, with its route.
  if (kind === 'transport' && placeId === null) {
    return (
      <div className="add-item">
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
      submitLabel="Add"
      onSubmit={async (v) => {
        await addItem({ tripId: detail.trip.id, placeId, ...v })
        onAdded()
      }}
      onCancel={onCancel}
    />
  )
}

function KindPicker({ kinds, kind, onKind }: { kinds: ItemKind[]; kind: ItemKind; onKind: (k: ItemKind) => void }) {
  return (
    <div className="kinds" role="radiogroup" aria-label="What is it?">
      {kinds.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={kind === k} className="kind" onClick={() => onKind(k)}>
          <span aria-hidden="true">{KINDS[k].icon}</span> {KINDS[k].label}
        </button>
      ))}
    </div>
  )
}

/** The fields of an item, for adding or changing it. */
function ItemForm({
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
    const amount = price.trim() ? Number(price.replace(/\s/g, '').replace(',', '.')) : null
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) found.price = 'Enter an amount, like 120.'
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
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <KindPicker kinds={kinds} kind={kind} onKind={setKind} />

      <div className={`field${errors.name ? ' field--error' : ''}`}>
        <label htmlFor={`${id}-name`} className="field__label">
          Name
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

      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} onDelete={onDelete} deleteName={deleteName} />
    </form>
  )
}

/**
 * The legs sitting in one gap of the route, drawn on the paper between two place sheets.
 * A round trip shows its price on the way out; the way back says it's included (counted once).
 * Tapping a leg opens its ticket, to change or delete it.
 */
export function RouteGap({
  detail,
  legs,
  viewer,
  mode,
  onChanged,
  onOpen,
}: {
  detail: TripDetail
  legs: LegLine[]
  viewer: string | null
  mode: Mode
  onChanged: () => void
  onOpen?: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null) // an item id
  if (legs.length === 0) return null
  return (
    <ul className="legs" aria-label="Travel">
      {legs.map(({ leg, item, roundTrip }) => {
        // The form opens where the ticket was tapped, in place of its first leg in this gap.
        if (editing === item.id && legs.find((l) => l.item.id === item.id)?.leg.id === leg.id) {
          return (
            <li key={leg.id} className="leg leg--editing">
              <TicketForm
                detail={detail}
                initial={ticketOf(detail, item, priceOf(detail, item))}
                submitLabel="Save"
                onSubmit={async (t) => {
                  await updateTicket(item.id, t)
                  setEditing(null)
                  onChanged()
                }}
                onDelete={async () => {
                  await deleteItem(item.id)
                  onChanged()
                }}
                deleteName="this ticket"
                deleteNote={roundTrip ? 'Both ways go, and its price comes out of the budget.' : undefined}
                onCancel={() => setEditing(null)}
              />
            </li>
          )
        }
        const isReturn = leg.leg_number === 2
        const line = itemLine(detail, item, viewer, mode)
        const dot = !line.priced ? 'dot--none' : line.confirmed ? 'dot--confirmed' : 'dot--estimated'
        const meta = [
          roundTrip ? (isReturn ? 'Included in the round trip' : '⇄ Round trip') : MODES[leg.mode as TicketMode]?.label,
          leg.via && `via ${leg.via}`,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <li key={leg.id} className="leg">
            <button
              type="button"
              className="leg__tap"
              onClick={() => {
                setEditing(item.id)
                onOpen?.()
              }}
              aria-label={`Change ${leg.from_name} → ${leg.to_name}`}
            >
              <span className="leg__icon" aria-hidden="true">
                {MODES[leg.mode as TicketMode]?.icon ?? '•'}
              </span>
              <span className="item-row__main">
                <span className="item-row__name">
                  {leg.from_name} → {leg.to_name}
                </span>
                <span className="item-row__meta">{meta}</span>
              </span>
              {!isReturn && (
                <span className="item-row__amount num">
                  <b>{line.concernsViewer ? formatMoney(line.amount, detail.trip.currency) : 'Not yours'}</b>
                  <span className="item-row__status">
                    <i className={`dot ${dot}`} aria-hidden="true" /> {STATUS[item.status]}
                  </span>
                </span>
              )}
              <span className="item-row__chev" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
