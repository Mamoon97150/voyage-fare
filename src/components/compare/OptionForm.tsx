import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { amountForInput, NO_AMOUNT, parseAmount } from '../../lib/money'
import { detailsOf, type OptionDetails, type Way } from '../../lib/options'
import type { ItemKind, OptionInput, TicketMode, TripOption } from '../../lib/trips'
import { useRate } from '../../lib/rates'
import { MODES } from '../../lib/tripView'
import { FormMessage } from '../AuthForm'
import { FormActions } from '../FormActions'
import { CurrencyPicker, RateField } from '../RateField'

const STAY_TYPES = ['Hotel', 'Apartment', 'House', 'Guesthouse', 'Hostel', 'Room']

/**
 * Add or change one candidate (mockup 10's form for journeys, mockup 2's details for stays).
 * Only the name is needed; the price can wait (it's then an idea, shown with a dash).
 */
export function OptionForm({
  kind,
  roundTrip,
  defaultMode,
  currency,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  kind: ItemKind
  roundTrip: boolean
  defaultMode: TicketMode
  currency: string
  initial?: TripOption
  submitLabel: string
  onSubmit: (input: OptionInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const d0: OptionDetails = initial ? detailsOf(initial) : {}
  const journey = kind === 'transport'
  const stay = kind === 'housing'
  const [name, setName] = useState(initial?.name ?? '')
  const [two, setTwo] = useState(Boolean(d0.prices))
  const [price, setPrice] = useState(amountForInput(initial?.amount === undefined ? null : initial.amount === null ? null : Number(initial.amount)))
  const [priceOut, setPriceOut] = useState(amountForInput(d0.prices?.[0]))
  const [priceBack, setPriceBack] = useState(amountForInput(d0.prices?.[1]))
  const [mode, setMode] = useState<TicketMode>(d0.mode ?? defaultMode)
  const [out, setOut] = useState<Way>(d0.out ?? {})
  const [back, setBack] = useState<Way>(d0.back ?? {})
  const [bag, setBag] = useState<boolean | undefined>(d0.bag)
  const [refundable, setRefundable] = useState<boolean | undefined>(d0.refundable)
  const [type, setType] = useState(d0.type ?? '')
  const [looks, setLooks] = useState(d0.looks ?? 0)
  const [location, setLocation] = useState(d0.location ?? '')
  const [breakfast, setBreakfast] = useState<boolean | undefined>(d0.breakfast)
  const [freeCancellation, setFreeCancellation] = useState<boolean | undefined>(d0.freeCancellation)
  const [note, setNote] = useState(initial?.note ?? '')
  const [link, setLink] = useState(initial?.link ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const id = initial?.id ?? 'new'
  const rate = useRate(currency, initial?.currency ?? currency, initial ? Number(initial.rate) : 1)
  const plane = journey && mode === 'plane'

  /** What's typed so far, for the "≈ in the trip's currency" line. */
  const typedAmount = () => {
    if (journey && roundTrip && two) {
      const a = parseAmount(priceOut)
      const b = parseAmount(priceBack)
      return a !== null && b !== null ? a + b : null
    }
    return parseAmount(price)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = journey ? 'Who runs it? An airline, a bus company…' : 'Give it a name.'
    let amount: number | null = null
    let prices: [number, number] | undefined
    if (journey && roundTrip && two) {
      const a = priceOut.trim() ? parseAmount(priceOut) : null
      const b = priceBack.trim() ? parseAmount(priceBack) : null
      if (priceOut.trim() && a === null) found.priceOut = 'Enter an amount, like 890.'
      if (priceBack.trim() && b === null) found.priceBack = 'Enter an amount, like 800.'
      if (a !== null && b !== null) {
        prices = [a, b]
        amount = a + b
      } else if (a !== null || b !== null) found.priceBack = 'Both tickets need a price, or neither for now.'
    } else {
      amount = price.trim() ? parseAmount(price) : null
      if (price.trim() && amount === null) found.price = 'Enter an amount, like 1 200 or 1 200,50.'
    }
    const foreign = rate.currency !== currency
    if (foreign && amount !== null && rate.rate === null)
      found.rate = rate.unreadable ? 'That rate doesn’t look right: type it like 1,1531.' : `What’s the rate? 1 ${rate.currency} is how many ${currency}?`
    setErrors(found)
    if (Object.keys(found).length) return

    const clean = (w: Way): Way | undefined => {
      const v: Way = {}
      for (const [k, val] of Object.entries(w)) if (val !== '' && val !== undefined) (v as Record<string, unknown>)[k] = typeof val === 'string' ? val.trim() : val
      return Object.keys(v).length ? v : undefined
    }
    const details: OptionDetails = journey
      ? {
          mode,
          ...(prices ? { prices } : {}),
          ...(clean(out) ? { out: clean(out) } : {}),
          ...(roundTrip && clean(back) ? { back: clean(back) } : {}),
          ...(plane && bag !== undefined ? { bag } : {}),
          ...(refundable !== undefined ? { refundable } : {}),
        }
      : stay
        ? {
            ...(type.trim() ? { type: type.trim() } : {}),
            ...(looks ? { looks } : {}),
            ...(location.trim() ? { location: location.trim() } : {}),
            ...(breakfast !== undefined ? { breakfast } : {}),
            ...(freeCancellation !== undefined ? { freeCancellation } : {}),
          }
        : {}

    setBusy(true)
    try {
      await onSubmit({
        name: name.trim(),
        amount,
        currency: foreign && rate.rate !== null ? rate.currency : currency,
        rate: foreign && rate.rate !== null ? rate.rate : 1,
        details,
        link: link.trim() || null,
        note: note.trim() || null,
      })
    } catch (error) {
      setBusy(false)
      setFormError(explainAuthError(error as { message?: string }).message)
    }
  }

  const text = (key: string, label: string, value: string, set: (v: string) => void, extra: Record<string, unknown> = {}) => (
    <div className={`field${errors[key] ? ' field--error' : ''}`}>
      <label htmlFor={`${id}-${key}`} className="field__label">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        className="field__input"
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        {...extra}
      />
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="field__error">
          {errors[key]}
        </p>
      )}
    </div>
  )

  const money = (key: string, label: string, value: string, set: (v: string) => void) => (
    <div className={`field${errors[key] ? ' field--error' : ''}`}>
      <label htmlFor={`${id}-${key}`} className="field__label">
        {label}
      </label>
      <div className="field__box">
        <input
          id={`${id}-${key}`}
          className="field__input num"
          inputMode="decimal"
          placeholder={NO_AMOUNT}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        />
        <CurrencyPicker id={`${id}-${key}-currency`} rate={rate} label={`${label}: currency`} />
      </div>
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="field__error">
          {errors[key]}
        </p>
      )}
    </div>
  )

  const yesNo = (key: string, label: string, value: boolean | undefined, set: (v: boolean | undefined) => void) => (
    <div className="yesno" role="radiogroup" aria-label={label}>
      <span className="yesno__label">{label}</span>
      {(['Yes', 'No'] as const).map((answer) => {
        const v = answer === 'Yes'
        return (
          <button
            key={answer}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => set(value === v ? undefined : v)}
            id={`${id}-${key}-${answer}`}
          >
            {answer}
          </button>
        )
      })}
    </div>
  )

  const wayFields = (label: string, way: Way, set: (w: Way) => void, key: string) => (
    <fieldset className="way-fields">
      <legend className="sheet-title">{label}</legend>
      {plane && (
        <div className="row2">
          {text(`${key}-from`, 'From airport', way.fromAirport ?? '', (v) => set({ ...way, fromAirport: v.toUpperCase() }), { placeholder: 'SXM', maxLength: 4 })}
          {text(`${key}-to`, 'To airport', way.toAirport ?? '', (v) => set({ ...way, toAirport: v.toUpperCase() }), { placeholder: 'CTG', maxLength: 4 })}
        </div>
      )}
      <div className="row3">
        {text(`${key}-leaves`, 'Leaves', way.leaves ?? '', (v) => set({ ...way, leaves: v }), { type: 'time' })}
        {text(`${key}-arrives`, 'Arrives', way.arrives ?? '', (v) => set({ ...way, arrives: v }), { type: 'time' })}
        <div className="field">
          <label htmlFor={`${id}-${key}-stops`} className="field__label">
            Stops
          </label>
          <select
            id={`${id}-${key}-stops`}
            className="field__input"
            value={way.stops === undefined ? '' : String(way.stops)}
            onChange={(e) => set({ ...way, stops: e.target.value === '' ? undefined : Number(e.target.value) })}
          >
            <option value="">—</option>
            <option value="0">Direct</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </div>
      </div>
      {(way.stops ?? 0) > 0 && text(`${key}-via`, 'Via', way.via ?? '', (v) => set({ ...way, via: v }), { placeholder: 'Panama' })}
    </fieldset>
  )

  return (
    <form onSubmit={submit} noValidate className="option-form">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      {text('name', journey ? 'Airline or company' : stay ? 'Name of the place' : 'Name', name, setName, {
        autoFocus: true,
        placeholder: journey ? 'Copa' : stay ? 'Casa Lola' : 'Rosario islands',
      })}

      {journey && (
        <div className="field">
          <label htmlFor={`${id}-mode`} className="field__label">
            By
          </label>
          <select id={`${id}-mode`} className="field__input" value={mode} onChange={(e) => setMode(e.target.value as TicketMode)}>
            {(Object.keys(MODES) as TicketMode[]).map((m) => (
              <option key={m} value={m}>
                {MODES[m].icon} {MODES[m].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {journey && roundTrip && (
        <div className="switch" role="radiogroup" aria-label="Tickets">
          <button type="button" role="radio" aria-checked={!two} onClick={() => setTwo(false)}>
            One round trip
          </button>
          <button type="button" role="radio" aria-checked={two} onClick={() => setTwo(true)}>
            Two one-ways
          </button>
        </div>
      )}

      {journey && roundTrip && two ? (
        <div className="row2">
          {money('priceOut', 'Price out', priceOut, setPriceOut)}
          {money('priceBack', 'Price back', priceBack, setPriceBack)}
        </div>
      ) : (
        money('price', journey ? 'Price for everyone' : 'Price', price, setPrice)
      )}
      <RateField id={`${id}-rate`} rate={rate} amount={typedAmount()} error={errors.rate} />

      {journey && (
        <>
          {wayFields(roundTrip ? 'Out' : 'The journey', out, setOut, 'out')}
          {roundTrip && wayFields('Back', back, setBack, 'back')}
          {plane && yesNo('bag', 'Checked bag included', bag, setBag)}
          {yesNo('refundable', 'Refundable', refundable, setRefundable)}
        </>
      )}

      {stay && (
        <>
          {text('type', 'Type', type, setType, { list: `${id}-types`, placeholder: 'Apartment' })}
          <datalist id={`${id}-types`}>
            {STAY_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <div className="looks" role="radiogroup" aria-label="Looks, 1 to 5">
            <span className="yesno__label">Looks</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={looks === n}
                aria-label={`${n} out of 5`}
                className={n <= looks ? 'looks__star looks__star--on' : 'looks__star'}
                onClick={() => setLooks(looks === n ? 0 : n)}
              >
                ★
              </button>
            ))}
          </div>
          {text('location', 'Location, in your words', location, setLocation, { placeholder: 'Great area, lots of stairs' })}
          {yesNo('breakfast', 'Breakfast', breakfast, setBreakfast)}
          {yesNo('cancel', 'Free cancellation', freeCancellation, setFreeCancellation)}
        </>
      )}

      {text('note', 'Note', note, setNote, { placeholder: journey ? 'Short stop, good times' : 'Why it’s on the list' })}
      {text('link', 'Link', link, setLink, { type: 'url', placeholder: 'https://…', inputMode: 'url' })}

      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} onDelete={onDelete} deleteName={initial?.name} />
    </form>
  )
}
