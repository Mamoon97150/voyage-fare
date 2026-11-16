import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  aroundName,
  askedFor,
  detailsFor,
  eachOf,
  LOCAL_MODES,
  nearOf,
  NO_DETAILS,
  rentalDays,
  totalOf,
  type ItemDetails,
  type LocalMode,
} from '../../lib/itemDetails'
import { amountForInput, formatWhole, NO_AMOUNT, parseAmount } from '../../lib/money'
import { MEALS } from '../../lib/toTry'
import {
  addItem,
  addTicket,
  addToTry,
  setItemDetails,
  setPackageCover,
  type ItemKind,
  type Meal,
  type TripDetail,
} from '../../lib/trips'
import { dayLabel, kindLabel, SPANS_DAYS } from '../../lib/tripView'
import { FormMessage } from '../AuthForm'
import { CityField } from '../CityField'
import { rememberedSpots, searchSpots, type CityValue } from '../../lib/places'
import { FormActions } from '../FormActions'
import { CoversPicker } from './Packages'
import { TicketForm } from './TicketForm'
import { useSaving } from '../../lib/useSaving'

export type ItemValues = {
  kind: ItemKind
  name: string
  dayNumber: number | null
  endDayNumber: number | null
  /** The whole price (a price per person is already multiplied). */
  amount: number | null
  /** A package's covered lines (build 6). */
  covers?: string[]
  /** The kind's own answers (build 8¾). */
  details: ItemDetails
  /** A restaurant or an activity with no day yet: it goes to To try (kinds-v6). */
  toTry: boolean
}

/** Add something to a place or to the whole trip. A price is optional: without one, it's an idea. */
export function AddItem({
  detail,
  placeId,
  kinds,
  days,
  placeDays,
  startKind,
  startDay,
  onAdded,
  onCancel,
}: {
  detail: TripDetail
  placeId: string | null
  kinds: ItemKind[]
  days: number
  /** The place's own days, for a restaurant's "When". */
  placeDays?: number[]
  /** From the place card: "Where we sleep", "+ What we do", "+ Where we eat" on a day. */
  startKind?: ItemKind
  startDay?: number
  onAdded: () => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<ItemKind>(startKind ?? kinds[0])
  const id = placeId ?? 'trip'
  const place = placeId ? detail.places.find((p) => p.id === placeId) : null
  const title = (
    <FormTitle title={place ? `Add to ${place.name}` : 'Add to the whole trip'} note="no price yet? it stays an idea" />
  )

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
      placeDays={placeDays}
      near={nearOf(place)}
      kind={kind}
      onKind={setKind}
      title={title}
      initial={startDay ? { ...EMPTY, kind, day: String(startDay) } : undefined}
      adding={placeId !== null}
      submitLabel="Add"
      onSubmit={async ({ covers, details, toTry, ...v }) => {
        let newId: string
        if (toTry && placeId && (v.kind === 'restaurant' || v.kind === 'activity')) {
          newId = await addToTry({ placeId, name: v.name, link: null, note: null, amount: v.amount, kind: v.kind })
        } else {
          newId = await addItem({ tripId: detail.trip.id, placeId, ...v })
        }
        if (hasDetails(details)) await setItemDetails(newId, details)
        if (v.kind === 'package' && covers?.length) await setPackageCover(newId, covers)
        onAdded()
      }}
      onCancel={onCancel}
    />
  )
}

const EMPTY = { kind: 'other' as ItemKind, name: '', day: '', endDay: '', price: '' }
const hasDetails = (d: ItemDetails) =>
  Object.entries(d).some(([k, v]) => (k === 'price_per_person' ? v === true : v !== null && v !== undefined))

function KindPicker({ kinds, kind, onKind }: { kinds: ItemKind[]; kind: ItemKind; onKind: (k: ItemKind) => void }) {
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
            className={`chip chip--pick cat--${k}`}
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

/** A question answered in one tap: "Booking needed? Yes · No" (tap again to leave it unsaid). */
function YesNo({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  return (
    <div className="yes-no" role="radiogroup" aria-label={label}>
      <span className="yes-no__label">{label}</span>
      <span className="yes-no__chips">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            className="chip chip--pick"
            onClick={() => onChange(value === v ? null : v)}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </span>
    </div>
  )
}

/** The fields of an item, for adding or changing it: the same basics, then the kind's own questions. */
export function ItemForm({
  detail,
  formId,
  kinds,
  days,
  placeDays = [],
  initial,
  kind: controlledKind,
  onKind,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  foldKind = false,
  deleteName,
  options,
  nameLabel,
  title,
  people = Math.max(detail.travellers.length, 1),
  adding = false,
  near = null,
}: {
  detail: TripDetail
  formId: string
  kinds: ItemKind[]
  days: number
  placeDays?: number[]
  initial?: {
    kind: ItemKind
    name: string
    day: string
    endDay: string
    price: string
    covers?: string[]
    details?: ItemDetails
  }
  kind?: ItemKind
  onKind?: (k: ItemKind) => void
  submitLabel: string
  onSubmit: (values: ItemValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  /** Changing a line (line-sheet-v6): its kind shown, the choices only on "Change what it is". */
  foldKind?: boolean
  deleteName?: string
  /** Several options: the price is the chosen one's, changed on Compare (shown instead of the field). */
  options?: { text: string; link: string | null }
  /** "What you're deciding" once the line shows the chosen option's name instead. */
  nameLabel?: string
  /** Shown at the top (adding: "Add to Cartagena"). */
  title?: ReactNode
  /** Who shares it: what a price per person is multiplied by. */
  people?: number
  /** Adding in a place: no day for a restaurant or an activity means To try. */
  adding?: boolean
  /** The place's position: its spots are searched first (maps-v6). */
  near?: { latitude: number; longitude: number } | null
}) {
  const startDetails = initial?.details ?? NO_DETAILS
  const [ownKind, setOwnKind] = useState<ItemKind>(initial?.kind ?? kinds[0])
  const kind = controlledKind ?? ownKind
  const inPlace = kinds.includes('housing')
  const asked = askedFor(kind, inPlace)
  const [showKinds, setShowKinds] = useState(false)
  const setKind = onKind ?? setOwnKind
  const [name, setName] = useState(initial?.name ?? '')
  const [day, setDay] = useState(initial?.day ?? '')
  const [endDay, setEndDay] = useState(initial?.endDay ?? '')
  // A price saved per person comes back per person.
  const [price, setPrice] = useState(() => {
    const saved = initial?.price ? parseAmount(initial.price) : null
    // A restaurant's price always reads per person, even one saved as a total before.
    const each = startDetails.price_per_person || (initial?.kind === 'restaurant' && people > 1)
    return saved !== null && each ? amountForInput(eachOf(saved, people)) : (initial?.price ?? '')
  })
  const [perPerson, setPerPerson] = useState(initial?.details ? startDetails.price_per_person : true)
  const [d, setD] = useState<ItemDetails>(startDetails)
  const [where, setWhere] = useState<CityValue>({
    name: startDetails.location_name ?? '',
    country: null,
    latitude: startDetails.latitude ?? null,
    longitude: startDetails.longitude ?? null,
  })
  const [deposit, setDeposit] = useState(startDetails.deposit === null ? '' : amountForInput(startDetails.deposit))
  const [covers, setCovers] = useState<string[]>(initial?.covers ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { busy, run } = useSaving()
  const id = formId
  const currency = detail.trip.currency
  const spans = SPANS_DAYS.includes(kind)
  const set = <K extends keyof ItemDetails>(k: K, v: ItemDetails[K]) => setD((x) => ({ ...x, [k]: v }))

  const around = kind === 'transport' && inPlace
  const rental = kind === 'car_rental'
  const restaurant = kind === 'restaurant'
  // A restaurant is always guessed per person ("About how much, per person"); alone, there's no choice.
  const pricedEach = asked.perPerson && people > 1 && (restaurant || perPerson)
  const typed = price.trim() ? parseAmount(price) : null
  const whole = typed === null ? null : pricedEach ? totalOf(typed, people) : typed
  const nameOptional = around || rental
  const label = nameLabel ?? (rental ? 'Company' : 'Name')
  const useDayChips = restaurant && placeDays.length > 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim() && !nameOptional) found.name = 'Give it a name.'
    if (price.trim() && typed === null) found.price = 'Enter an amount, like 120 or 1 200,50.'
    const held = asked.deposit && deposit.trim() ? parseAmount(deposit) : null
    if (asked.deposit && deposit.trim() && held === null) found.deposit = 'Enter an amount, like 300.'
    const start = day ? Number(day) : null
    const end = spans && endDay ? Number(endDay) : null
    if (end !== null && (start === null || end < start)) found.endDay = 'Pick a last day after the first one.'
    setErrors(found)
    if (Object.keys(found).length) return

    const details = detailsFor(kind, inPlace, {
      ...d,
      price_per_person: pricedEach,
      deposit: held,
      meal: start === null ? null : d.meal,
      location_name: where.name,
      latitude: where.latitude,
      longitude: where.longitude,
    })
    const finalName =
      name.trim() ||
      (around ? aroundName(d.local_mode, d.from_place ?? '', d.to_place ?? '') : rental ? 'Car rental' : '')
    await run(async () => {
      await onSubmit({
        kind,
        name: finalName,
        dayNumber: start,
        endDayNumber: end,
        amount: whole,
        covers: kind === 'package' ? covers : undefined,
        details,
        toTry: adding && start === null && (restaurant || kind === 'activity'),
      })
    }, setFormError)
  }

  const dayOptions = Array.from({ length: days }, (_, i) => i + 1)
  const dayLabels = (n: number) => dayLabel(n, detail.trip.start_date)

  const daySelect = (
    fieldLabel: string,
    value: string,
    onChange: (v: string) => void,
    idPart: string,
    empty: string,
  ) => (
    <div className={`field${idPart === 'end' && errors.endDay ? ' field--error' : ''}`}>
      <label htmlFor={`${id}-${idPart}`} className="field__label">
        {fieldLabel}
      </label>
      <select
        id={`${id}-${idPart}`}
        className="field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={idPart === 'end' && errors.endDay ? true : undefined}
        aria-describedby={idPart === 'end' && errors.endDay ? `${id}-end-error` : undefined}
      >
        <option value="">{empty}</option>
        {dayOptions.map((n) => (
          <option key={n} value={n}>
            {dayLabels(n)}
          </option>
        ))}
      </select>
      {idPart === 'end' && errors.endDay && (
        <p id={`${id}-end-error`} className="field__error">
          {errors.endDay}
        </p>
      )}
    </div>
  )

  const textField = (
    k: 'duration' | 'food_kind' | 'from_place' | 'to_place',
    fieldLabel: string,
    placeholder: string,
    optional = true,
  ) => (
    <div className="field">
      <label htmlFor={`${id}-${k}`} className="field__label">
        {fieldLabel} {optional && <span className="field__optional">(optional)</span>}
      </label>
      <input
        id={`${id}-${k}`}
        className="field__input"
        value={d[k] ?? ''}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)}
      />
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="add-item">
      {title}
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      {foldKind && !showKinds ? (
        <div className="kind-now">
          <i className={`cat-dot cat-dot--${kind}`} aria-hidden="true" />
          <b>{kindLabel(kind, inPlace).label}</b>
          <button type="button" className="link-button" onClick={() => setShowKinds(true)}>
            Change what it is
          </button>
        </div>
      ) : (
        <KindPicker kinds={kinds} kind={kind} onKind={setKind} />
      )}

      {!around && (
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-name`} className="field__label">
            {label} {nameOptional && <span className="field__optional">(optional)</span>}
          </label>
          <input
            id={`${id}-name`}
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={PLACEHOLDERS[kind] ?? 'Rosario islands'}
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
      )}

      {around && (
        <>
          <div className="row2">
            {textField('from_place', 'From', 'Naha', false)}
            {textField('to_place', 'To', 'Zamami', false)}
          </div>
          <div className="field">
            <span className="field__label" id={`${id}-mode`}>
              How
            </span>
            <div className="when-chips" role="radiogroup" aria-labelledby={`${id}-mode`}>
              {LOCAL_MODES.map(([k, word]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={d.local_mode === k}
                  className="chip chip--pick"
                  onClick={() => set('local_mode', d.local_mode === k ? null : (k as LocalMode))}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {days > 0 && useDayChips && (
        <div className="field">
          <span className="field__label" id={`${id}-when`}>
            When
          </span>
          <div className="when-chips" role="radiogroup" aria-labelledby={`${id}-when`}>
            <button
              type="button"
              role="radio"
              aria-checked={day === ''}
              className="chip chip--pick"
              onClick={() => setDay('')}
            >
              No day yet{adding ? ': To try' : ''}
            </button>
            {placeDays.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={day === String(n)}
                className="chip chip--pick"
                onClick={() => setDay(String(n))}
              >
                Day {n}
              </button>
            ))}
          </div>
          {day !== '' && (
            <div className="when-chips meal-chips" role="radiogroup" aria-label="Meal">
              {MEALS.map(([k, word]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={d.meal === k}
                  className="chip chip--pick"
                  onClick={() => set('meal', d.meal === k ? null : (k as Meal))}
                >
                  {word}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {days > 0 && !useDayChips && (
        <div className={spans || asked.time ? 'row2' : undefined}>
          {rental
            ? daySelect('Pick up', day, setDay, 'day', 'No day yet')
            : daySelect(spans ? 'From' : 'Day', day, setDay, 'day', 'No day yet')}
          {spans && daySelect(rental ? 'Drop off' : 'Until', endDay, setEndDay, 'end', '—')}
          {asked.time && (
            <div className="field">
              <label htmlFor={`${id}-time`} className="field__label">
                Time <span className="field__optional">(optional)</span>
              </label>
              <input
                id={`${id}-time`}
                type="time"
                className="field__input"
                value={d.start_time ?? ''}
                onChange={(e) => set('start_time', e.target.value || null)}
              />
            </div>
          )}
        </div>
      )}
      {adding && day === '' && (kind === 'activity' || (restaurant && !useDayChips)) && (
        <p className="hand form-note">no day yet: it waits in To try</p>
      )}

      {rental && (
        <div className="row2">
          {textField('from_place', 'Pick-up place', 'Naha airport')}
          {textField('to_place', 'Drop-off place', 'same place')}
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
            {restaurant && people > 1 ? 'About how much, per person' : rental ? 'Price for the rental' : 'Price'}
          </label>
          {asked.perPerson && !restaurant && people > 1 && (
            <div className="switch price-switch" role="radiogroup" aria-label="The price is">
              <button type="button" role="radio" aria-checked={perPerson} onClick={() => setPerPerson(true)}>
                Per person
              </button>
              <button type="button" role="radio" aria-checked={!perPerson} onClick={() => setPerPerson(false)}>
                For everyone
              </button>
            </div>
          )}
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
              {priceHint({ whole, typed, pricedEach, people, currency, rental, day, endDay })}
            </p>
          )}
        </div>
      )}

      {asked.where && (
        <CityField
          id={`${id}-where`}
          label="Where (optional)"
          value={where}
          onChange={setWhere}
          placeholder="search it, or paste a Google Maps link"
          search={(q, signal) => searchSpots(q, near, signal)}
          known={(q) => rememberedSpots(q, near)}
          readLinks
          looking="looking for it nearby…"
          hint={where.name && where.latitude === null ? 'Not on the map: pick it from the list to pin it.' : undefined}
        />
      )}

      {asked.booking && (
        <YesNo
          label={restaurant ? 'Reservation needed?' : 'Booking needed?'}
          value={d.needs_booking}
          onChange={(v) => set('needs_booking', v)}
        />
      )}
      {asked.duration && textField('duration', 'How long', '2 h')}
      {asked.food && textField('food_kind', 'The kind of food', 'kaiseki, tapas…')}
      {asked.insurance && (
        <YesNo
          label="Insurance included?"
          value={d.insurance_included}
          onChange={(v) => set('insurance_included', v)}
        />
      )}
      {asked.deposit && (
        <div className={`field${errors.deposit ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-deposit`} className="field__label">
            Deposit <span className="field__optional">(held, given back)</span>
          </label>
          <div className="field__box">
            <input
              id={`${id}-deposit`}
              className="field__input num"
              inputMode="decimal"
              placeholder={NO_AMOUNT}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              aria-invalid={errors.deposit ? true : undefined}
            />
            <span className="field__unit">{currency}</span>
          </div>
          {errors.deposit ? (
            <p className="field__error">{errors.deposit}</p>
          ) : (
            <p className="field__hint">Not in the budget: it comes back.</p>
          )}
        </div>
      )}

      {kind === 'package' && (
        <CoversPicker
          detail={detail}
          value={covers}
          onChange={setCovers}
          packageId={formId.startsWith('edit-') ? formId.slice(5) : undefined}
        />
      )}

      <FormActions
        busy={busy}
        submitLabel={submitLabel}
        onCancel={onCancel}
        onDelete={onDelete}
        deleteName={deleteName}
      />
    </form>
  )
}

const PLACEHOLDERS: Partial<Record<ItemKind, string>> = {
  housing: 'Casa Lola',
  transport: 'Ferry',
  package: 'Agency package',
  activity: 'Fushimi Inari at dawn',
  restaurant: 'Kikunoi',
  car_rental: 'Times Car Rental',
}

/** Under the price: what it makes ("× 2 = 50 €", "4 days · ≈ 52 € a day"), or the usual hint. */
function priceHint({
  whole,
  typed,
  pricedEach,
  people,
  currency,
  rental,
  day,
  endDay,
}: {
  whole: number | null
  typed: number | null
  pricedEach: boolean
  people: number
  currency: string
  rental: boolean
  day: string
  endDay: string
}): string {
  if (typed !== null && pricedEach) return `× ${people} travellers = ${formatWhole(whole, currency)}`
  if (typed !== null && rental) {
    const n = rentalDays(day ? Number(day) : null, endDay ? Number(endDay) : null)
    if (n && n > 1) return `${n} days · ≈ ${formatWhole(typed / n, currency)} a day`
  }
  if (pricedEach) return 'Per person, your best guess. No price yet? Leave it empty: it stays an idea.'
  return 'The whole price, your best guess. No price yet? Leave it empty: it stays an idea.'
}
