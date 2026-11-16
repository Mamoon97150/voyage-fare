import { useState, type FormEvent } from 'react'
import { amountForInput, formatWhole, parseAmount } from '../../lib/money'
import {
  addToTry,
  deleteItem,
  setRestaurantDay,
  setVerdict,
  updateToTry,
  type Item,
  type Meal,
  type TripDetail,
  type Verdict,
} from '../../lib/trips'
import { dayDate, MEALS, placeDays, plannedOn, sourceOf, VERDICTS } from '../../lib/toTry'
import { useSaving } from '../../lib/useSaving'
import { canPaste, isIos } from '../../lib/pwa'
import { FormMessage } from '../AuthForm'
import { FormActions } from '../FormActions'
import { SketchBox } from '../Sketch'
import { FormTitle } from './ItemForm'

/*
 * The restaurant pool "To try" (mockup to-try-v5, 15 Nov): restaurants found on social media,
 * kept with a place but not a day. Their price doesn't count until they're put on a day.
 */

/** Where it was found: a small badge, and the account or site. A link opens the post again. */
export function SourceBadge({ link, asLink = true }: { link: string | null; asLink?: boolean }) {
  const source = sourceOf(link)
  if (!source || !link) return null
  const inner = (
    <>
      <i className={`source__badge source__badge--${source.kind}`} aria-hidden="true">
        {source.badge}
      </i>
      {source.handle ?? source.label}
    </>
  )
  return asLink ? (
    <a className="source" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open on ${source.label}`}>
      {inner}
    </a>
  ) : (
    <span className="source">{inner}</span>
  )
}

/** A whole price shown per person, the way you'd read a menu: "≈ 95 € each". */
const priceEach = (detail: TripDetail, item: Item) => {
  const option = detail.options.find((o) => o.item_id === item.id)
  if (!option || option.amount === null) return null
  const people = Math.max(detail.travellers.length, 1)
  return (Number(option.amount) * Number(option.rate)) / people
}

/** One restaurant in the pool: name, where it was found, a note, a price, and "Day ▾". */
export function ToTryRow({ detail, item, onChanged }: { detail: TripDetail; item: Item; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'day' | 'edit'>('view')
  const each = priceEach(detail, item)
  const readOnly = detail.trip.is_demo

  if (mode === 'edit')
    return (
      <li className="to-try to-try--editing">
        <ToTryForm
          detail={detail}
          placeId={item.place_id as string}
          item={item}
          onDone={() => {
            setMode('view')
            onChanged()
          }}
          onCancel={() => setMode('view')}
        />
      </li>
    )

  return (
    <li className="to-try">
      <span className="to-try__main">
        <button
          type="button"
          className="to-try__name"
          onClick={() => setMode('edit')}
          aria-label={`Change ${item.name}`}
        >
          <i className={`cat-dot cat-dot--${item.kind}`} aria-hidden="true" />
          {item.name}
        </button>
        <SourceBadge link={item.link} />
        {item.note && <span className="hand to-try__note">{item.note}</span>}
      </span>
      <span className="to-try__side">
        {each !== null && <span className="to-try__price num">≈ {formatWhole(each, detail.trip.currency)} each</span>}
        {!readOnly && (
          <button
            type="button"
            className={`day-button${mode === 'day' ? ' day-button--open' : ''}`}
            aria-expanded={mode === 'day'}
            aria-label={`Put ${item.name} on a day`}
            onClick={() => setMode(mode === 'day' ? 'view' : 'day')}
          >
            Day {mode === 'day' ? '▴' : '▾'}
          </button>
        )}
      </span>
      {mode === 'day' && (
        <DayPicker
          detail={detail}
          item={item}
          onDone={() => {
            setMode('view')
            onChanged()
          }}
          onCancel={() => setMode('view')}
        />
      )}
    </li>
  )
}

/** A place's To try: restaurants and activities with no day yet, filtered All · Eat · Do once both are there. */
export function ToTryList({ detail, items, onChanged }: { detail: TripDetail; items: Item[]; onChanged: () => void }) {
  const [show, setShow] = useState<'all' | 'restaurant' | 'activity'>('all')
  const both = items.some((i) => i.kind === 'restaurant') && items.some((i) => i.kind === 'activity')
  const shown = both && show !== 'all' ? items.filter((i) => i.kind === show) : items
  return (
    <>
      {both && (
        <div className="to-try-filter" role="radiogroup" aria-label="Show">
          {(
            [
              ['all', 'All'],
              ['restaurant', 'Eat'],
              ['activity', 'Do'],
            ] as const
          ).map(([k, word]) => (
            <button
              key={k}
              type="button"
              role="radio"
              className={`chip chip--pick cat--${k}`}
              aria-checked={show === k}
              onClick={() => setShow(k)}
            >
              {k !== 'all' && <i className={`cat-dot cat-dot--${k}`} aria-hidden="true" />}
              {word}
            </button>
          ))}
        </div>
      )}
      <ul className="item-list">
        {shown.map((it) => (
          <ToTryRow key={it.id} detail={detail} item={it} onChanged={onChanged} />
        ))}
      </ul>
    </>
  )
}

/** The place's days, each with its date and what's already on it; then lunch or dinner. */
function DayPicker({
  detail,
  item,
  onDone,
  onCancel,
}: {
  detail: TripDetail
  item: Item
  onDone: () => void
  onCancel: () => void
}) {
  const place = detail.places.find((p) => p.id === item.place_id)
  const days = place ? placeDays(detail, place) : []
  const [day, setDay] = useState<number | null>(null)
  const [meal, setMeal] = useState<Meal | null>(null)
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  if (!place) return null

  return (
    <div className="day-picker" role="group" aria-label={`Which day in ${place.name}?`}>
      <p className="day-picker__q">Which day in {place.name}?</p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="day-picker__days">
        {days.map((d, i) => {
          const planned = plannedOn(detail, place.id, d)
          return (
            <button
              key={d}
              type="button"
              className={`day-chip${planned ? ' day-chip--busy' : ''}`}
              aria-pressed={day === d}
              aria-label={`Day ${d}${planned ? `, ${planned} already` : ''}`}
              onClick={() => setDay(d)}
            >
              <b>{d}</b>
              {dayDate(detail.trip.start_date, d)}
              <small>{planned ? `● ${planned}` : i === 0 ? 'arrive' : 'free'}</small>
            </button>
          )
        })}
      </div>
      {item.kind === 'restaurant' && (
        <div className="day-picker__meals" role="radiogroup" aria-label="Meal">
          {MEALS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              className="chip"
              aria-checked={meal === key}
              onClick={() => setMeal(meal === key ? null : key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {item.kind === 'restaurant' && (
        <p className="hand day-picker__hint">a day already has a dinner? you’ll see it before you choose</p>
      )}
      <div className="add-item__actions">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={day === null || busy}
          onClick={() =>
            run(async () => {
              await setRestaurantDay(item.id, day, meal)
              onDone()
            }, setError)
          }
        >
          {day === null ? 'Pick a day' : `Put on day ${day}`}
        </button>
      </div>
    </div>
  )
}

/** "+ To try": from a link (the source, and sometimes the name, read from it), or changing one. */
export function ToTryForm({
  detail,
  placeId,
  item,
  onDone,
  onCancel,
}: {
  detail: TripDetail
  placeId: string
  item?: Item
  onDone: () => void
  onCancel: () => void
}) {
  const id = `to-try-${item?.id ?? placeId}`
  const people = Math.max(detail.travellers.length, 1)
  const startEach = item ? priceEach(detail, item) : null
  const [link, setLink] = useState(item?.link ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [where, setWhere] = useState(placeId)
  const [note, setNote] = useState(item?.note ?? '')
  const [kind, setKind] = useState<'restaurant' | 'activity'>(item?.kind === 'activity' ? 'activity' : 'restaurant')
  const [showPrice, setShowPrice] = useState(startEach !== null)
  const [price, setPrice] = useState(startEach !== null ? amountForInput(Math.round(startEach * 100) / 100) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { busy, run } = useSaving()
  const source = sourceOf(link.trim())
  const place = detail.places.find((p) => p.id === where)

  function pasted(value: string) {
    setLink(value)
    // Google Maps addresses carry the name: fill it in if nothing's typed yet.
    const found = sourceOf(value.trim())
    if (found?.name && !name.trim()) setName(found.name)
  }

  /** 📋 Paste (mockup pwa-v5): one tap after "Copy link" in Instagram, mainly for iPhones. */
  async function pasteLink() {
    try {
      const text = await navigator.clipboard.readText()
      const found = text.match(/https?:\/\/[^\s<>"]+/)?.[0]
      if (found) pasted(found)
      else setErrors((e) => ({ ...e, link: 'No link copied yet: in the post, tap ⋯ then Copy link.' }))
    } catch {
      setErrors((e) => ({ ...e, link: 'The phone didn’t allow pasting: press and hold in the box, then Paste.' }))
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give it a name, like “El Cielo”.'
    if (link.trim() && !source) found.link = 'Paste the whole address, starting with https://'
    const each = showPrice && price.trim() ? parseAmount(price) : null
    if (showPrice && price.trim() && each === null) found.price = 'Enter a price, like 30.'
    setErrors(found)
    if (Object.keys(found).length) return
    const entry = {
      placeId: where,
      name: name.trim(),
      link: link.trim() || null,
      note: note.trim() || null,
      amount: each === null ? null : Math.round(each * people * 100) / 100,
    }
    await run(async () => {
      if (item) await updateToTry({ id: item.id, ...entry })
      else await addToTry({ ...entry, kind })
      onDone()
    }, setFormError)
  }

  return (
    <SketchBox tape={item ? undefined : 'mustard'} className="to-try-form" seed={62}>
      <form onSubmit={submit} noValidate className="add-item">
        <FormTitle title="To try" note={place?.name} />
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <div className={`field${errors.link ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-link`} className="field__label">
            Link
          </label>
          <div className="link-row">
            <input
              id={`${id}-link`}
              className="field__input"
              inputMode="url"
              placeholder="Paste the post: Instagram, TikTok, Google Maps…"
              value={link}
              onChange={(e) => pasted(e.target.value)}
              aria-invalid={errors.link ? true : undefined}
            />
            {canPaste() && (
              <button type="button" className="paste-button" onClick={() => void pasteLink()}>
                <span aria-hidden="true">📋</span> Paste
              </button>
            )}
          </div>
          {errors.link && <p className="field__error">{errors.link}</p>}
          {!link && isIos(navigator.userAgent, navigator.maxTouchPoints) && (
            <p className="hand paste-hint">in Instagram: ⋯ → Copy link, then Paste here</p>
          )}
        </div>
        {source && (
          <p className="pasted">
            <i className={`source__badge source__badge--${source.kind}`} aria-hidden="true">
              {source.badge}
            </i>
            <span>
              <b>{source.label}</b>
              {source.handle ?? (source.name ? source.name : 'the name is yours to type')}
            </span>
          </p>
        )}
        {!item && (
          <div className="switch to-try-kind" role="radiogroup" aria-label="To eat or to do">
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'restaurant'}
              onClick={() => setKind('restaurant')}
            >
              To eat
            </button>
            <button type="button" role="radio" aria-checked={kind === 'activity'} onClick={() => setKind('activity')}>
              To do
            </button>
          </div>
        )}
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-name`} className="field__label">
            Name
          </label>
          <input
            id={`${id}-name`}
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <p className="field__error">{errors.name}</p>}
        </div>
        {detail.places.length > 1 && (
          <div className="field" role="radiogroup" aria-labelledby={`${id}-where`}>
            <span id={`${id}-where`} className="field__label">
              Where
            </span>
            <div className="chips">
              {[...detail.places]
                .sort((a, b) => a.position - b.position)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    className="chip"
                    aria-checked={where === p.id}
                    onClick={() => setWhere(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-note`} className="field__label">
            A note <span className="field__optional">(optional)</span>
          </label>
          <input id={`${id}-note`} className="field__input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {showPrice ? (
          <div className={`field${errors.price ? ' field--error' : ''}`}>
            <label htmlFor={`${id}-price`} className="field__label">
              A price, each
            </label>
            <div className="field__box">
              <input
                id={`${id}-price`}
                className="field__input num"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-invalid={errors.price ? true : undefined}
              />
              <span className="field__unit">{detail.trip.currency}</span>
            </div>
            {errors.price && <p className="field__error">{errors.price}</p>}
            <p className="field__hint">It counts in the budget once it’s on a day.</p>
          </div>
        ) : (
          <button type="button" className="link-button" onClick={() => setShowPrice(true)}>
            + A price, if you know it
          </button>
        )}
        <FormActions
          busy={busy}
          submitLabel={item ? 'Save' : 'Add to To try'}
          onCancel={onCancel}
          onDelete={
            item
              ? async () => {
                  await deleteItem(item.id)
                  onDone()
                }
              : undefined
          }
          deleteName={item?.name}
        />
      </form>
    </SketchBox>
  )
}

/** "♥ Loved it · Fine · Skip" on a restaurant once its day has come. */
export function VerdictChips({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { busy, run } = useSaving()
  const [error, setError] = useState<string>()
  return (
    <div className="verdicts" role="group" aria-label={`How was ${item.name}?`}>
      {VERDICTS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`verdict${key === 'loved' ? ' verdict--loved' : ''}`}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await setVerdict(item.id, key as Verdict)
              onChanged()
            }, setError)
          }
        >
          {label}
        </button>
      ))}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}

/** "Back to To try" in a restaurant's form: off the day, out of the budget, back in the pool. */
export function BackToTry({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { busy, run } = useSaving()
  const [error, setError] = useState<string>()
  if (
    item.kind !== 'restaurant' ||
    !item.place_id ||
    !item.day_number ||
    item.status === 'booked' ||
    item.status === 'paid'
  )
    return null
  return (
    <div className="back-to-try">
      <button
        type="button"
        className="link-button"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await setRestaurantDay(item.id, null)
            onChanged()
          }, setError)
        }
      >
        Back to To try
      </button>
      <span className="hand">takes it off the day</span>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}

/** The restaurants you loved, with their links: for a friend going there, or for next time. */
export function PlacesWeLoved({ detail }: { detail: TripDetail }) {
  const loved = detail.items.filter((i) => i.verdict === 'loved' && i.status !== 'dropped')
  if (loved.length === 0) return null
  const placeName = (id: string | null) => detail.places.find((p) => p.id === id)?.name
  return (
    <section aria-labelledby="loved-title">
      <SketchBox weight="light" className="loved-card" seed={65}>
        <header className="loved-card__head">
          <h2 id="loved-title">
            Places we loved <small>{loved.length}</small>
          </h2>
        </header>
        <ul className="loved-card__list">
          {loved.map((i) => (
            <li key={i.id}>
              <span>
                <span className="loved-card__name">
                  <span className="heart" aria-hidden="true">
                    ♥
                  </span>{' '}
                  {i.name}
                </span>
                <span className="loved-card__meta">
                  {[
                    placeName(i.place_id),
                    [i.meal, i.day_number ? `day ${i.day_number}` : null].filter(Boolean).join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <SourceBadge link={i.link} />
            </li>
          ))}
        </ul>
      </SketchBox>
    </section>
  )
}
