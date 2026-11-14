import { useState, type FormEvent } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { hintSeen, markHintSeen } from '../../lib/hints'
import { amountForInput, formatMoney, parseAmount } from '../../lib/money'
import { useRate } from '../../lib/rates'
import {
  deleteDailyEstimate,
  saveDailyEstimate,
  setEstimateDays,
  type DailyEstimate,
  type TripDetail,
} from '../../lib/trips'
import { estimateDefaultDays, estimateLine, ESTIMATE_CATEGORIES, type Mode } from '../../lib/tripView'
import { plural } from '../../lib/tripText'
import { FormMessage } from '../AuthForm'
import { FormActions } from '../FormActions'
import { CurrencyPicker, RateField } from '../RateField'

/**
 * Daily estimates (build 6, mockup daily-estimates-v4): what isn't planned line by line,
 * "≈ Food & drinks · 30 € a day each × 4 days", always estimated. Tap one to change it.
 * When a place's nights change and the days no longer fit, the line says so, with a one-tap fix.
 */
export function EstimateRows({
  detail,
  placeId,
  viewer,
  mode,
  onChanged,
}: {
  detail: TripDetail
  placeId: string | null
  viewer: string | null
  mode: Mode
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const list = (detail.dailyEstimates ?? []).filter((e) => e.place_id === placeId)
  if (list.length === 0) return null
  return (
    <ul className="item-list estimates" aria-label="Daily estimates">
      {list.map((e) =>
        editing === e.id ? (
          <li key={e.id} className="item-row item-row--editing">
            <EstimateForm
              detail={detail}
              placeId={placeId}
              estimate={e}
              onDone={() => {
                setEditing(null)
                onChanged()
              }}
              onCancel={() => setEditing(null)}
            />
          </li>
        ) : (
          <EstimateRow key={e.id} detail={detail} estimate={e} viewer={viewer} mode={mode} onOpen={() => setEditing(e.id)} onChanged={onChanged} />
        ),
      )}
    </ul>
  )
}

function EstimateRow({
  detail,
  estimate,
  viewer,
  mode,
  onOpen,
  onChanged,
}: {
  detail: TripDetail
  estimate: DailyEstimate
  viewer: string | null
  mode: Mode
  onOpen: () => void
  onChanged: () => void
}) {
  const line = estimateLine(detail, estimate, viewer, mode)
  const currency = detail.trip.currency
  const keptKey = `estimate-days:${estimate.id}:${estimate.days}:${line.expectedDays}`
  const [kept, setKept] = useState(() => hintSeen(keptKey))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const flagged = line.mismatch && !kept && line.expectedDays !== null
  const where = estimate.place_id ? detail.places.find((p) => p.id === estimate.place_id) : null
  const each = formatMoney(Number(estimate.amount), estimate.currency)

  async function fix() {
    if (line.expectedDays === null) return
    setBusy(true)
    setError(undefined)
    try {
      await setEstimateDays(estimate.id, line.expectedDays)
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
      setBusy(false)
    }
  }

  return (
    <li className="item-row estimate-row">
      <button type="button" className="item-row__tap" onClick={onOpen} aria-label={`Change ${estimate.label}`}>
        <i className="dot dot--estimated" aria-hidden="true" />
        <span className="item-row__main">
          <span className="item-row__name">
            <span className="estimate-row__approx" aria-hidden="true">
              ≈{' '}
            </span>
            {estimate.label}
          </span>
          <span className="estimate-row__calc">
            {each} a day each ×{' '}
            {flagged ? <span className="circled">{plural(estimate.days, 'day')}</span> : plural(estimate.days, 'day')}
          </span>
        </span>
        <span className="item-row__amount num">
          <b>{line.amount === null ? '—' : formatMoney(Math.round(line.amount), currency)}</b>
          <span className="item-row__status item-row__status--estimated">Estimated</span>
        </span>
        <span className="item-row__chev" aria-hidden="true">
          ›
        </span>
      </button>
      {flagged && (
        <div className="estimate-row__check">
          <p className="estimate-row__note">
            ↑ {where ? `${where.name} has ${plural(line.expectedDays!, 'night')} now` : `the trip is ${plural(line.expectedDays!, 'day')} now`}
          </p>
          <div className="estimate-row__fix">
            <button type="button" className="button button--small" onClick={fix} disabled={busy}>
              Make it {plural(line.expectedDays!, 'day')}
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => {
                markHintSeen(keptKey)
                setKept(true)
              }}
            >
              Keep {estimate.days}
            </button>
          </div>
          {error && <FormMessage tone="error">{error}</FormMessage>}
        </div>
      )}
    </li>
  )
}

/** Add or change a daily estimate: what for, a name, an amount a day each, days, who. */
export function EstimateForm({
  detail,
  placeId,
  estimate,
  onDone,
  onCancel,
}: {
  detail: TripDetail
  placeId: string | null
  estimate?: DailyEstimate
  onDone: () => void
  onCancel: () => void
}) {
  const { trip, travellers } = detail
  const id = `estimate-${estimate?.id ?? placeId ?? 'trip'}`
  const place = placeId ? detail.places.find((p) => p.id === placeId) : null
  const defaultDays = estimateDefaultDays(detail, placeId)
  const startPeople = estimate
    ? (detail.estimatePeople ?? []).filter((p) => p.daily_estimate_id === estimate.id).map((p) => p.traveller_id as string)
    : travellers.map((t) => t.id)
  const [category, setCategory] = useState(estimate?.category ?? 'food')
  const [label, setLabel] = useState(estimate?.label ?? 'Food & drinks')
  const [amount, setAmount] = useState(estimate ? amountForInput(Number(estimate.amount)) : '')
  const [days, setDays] = useState(String(estimate?.days ?? (defaultDays || '')))
  const [people, setPeople] = useState<string[]>(startPeople.length ? startPeople : travellers.map((t) => t.id))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const rate = useRate(trip.currency, estimate?.currency ?? trip.currency, estimate ? Number(estimate.rate) : 1)

  const perDay = parseAmount(amount)
  const dayCount = /^\d+$/.test(days.trim()) ? Number(days.trim()) : null
  const unit = perDay !== null && rate.rate !== null ? perDay * rate.rate : null
  const total = unit !== null && dayCount ? Math.round(unit * 100) / 100 * dayCount * people.length : null

  function pickCategory(key: string) {
    // A name that still says the last category follows the new one.
    const before = ESTIMATE_CATEGORIES.find((c) => c.key === category)
    const next = ESTIMATE_CATEGORIES.find((c) => c.key === key)
    if (next && before && (label.trim() === '' || label === before.suggestion)) setLabel(next.suggestion)
    setCategory(key)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!label.trim()) found.label = 'Give it a name, like “Food”.'
    if (perDay === null) found.amount = 'Enter an amount a day, like 30.'
    if (!dayCount || dayCount < 1) found.days = 'How many days? At least 1.'
    const foreign = rate.currency !== trip.currency
    if (foreign && rate.rate === null) found.rate = `What’s the rate? 1 ${rate.currency} is how many ${trip.currency}?`
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await saveDailyEstimate({
        id: estimate?.id ?? null,
        tripId: trip.id,
        placeId,
        category,
        label: label.trim(),
        amount: perDay!,
        currency: rate.currency,
        rate: foreign ? rate.rate! : 1,
        days: dayCount!,
        travellers: people.length === travellers.length ? [] : people,
      })
      onDone()
    } catch (e) {
      setFormError(explainAuthError(e as { message?: string }).message)
      setBusy(false)
    }
  }

  const toggle = (tid: string) => {
    const next = people.includes(tid) ? people.filter((x) => x !== tid) : [...people, tid]
    if (next.length) setPeople(next)
  }

  return (
    <form onSubmit={submit} noValidate className="estimate-form">
      <h3 className="sheet-title">
        Daily estimate <small className="sheet-title__note">{place ? place.name : 'whole trip'}</small>
      </h3>
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <div className="field" role="radiogroup" aria-labelledby={`${id}-for`}>
        <span id={`${id}-for`} className="field__label">
          For
        </span>
        <div className="chips">
          {ESTIMATE_CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={category === c.key} aria-pressed={category === c.key} className="chip" onClick={() => pickCategory(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`field${errors.label ? ' field--error' : ''}`}>
        <label htmlFor={`${id}-label`} className="field__label">
          Name
        </label>
        <input id={`${id}-label`} className="field__input" value={label} onChange={(e) => setLabel(e.target.value)} aria-invalid={errors.label ? true : undefined} />
        {errors.label && <p className="field__error">{errors.label}</p>}
      </div>
      <div className="estimate-form__row">
        <div className={`field${errors.amount ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-amount`} className="field__label">
            A day, each
          </label>
          <div className="field__box">
            <input
              id={`${id}-amount`}
              className="field__input num"
              inputMode="decimal"
              placeholder="30"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={errors.amount ? true : undefined}
            />
            <CurrencyPicker id={`${id}-currency`} rate={rate} />
          </div>
          {errors.amount && <p className="field__error">{errors.amount}</p>}
        </div>
        <div className={`field${errors.days ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-days`} className="field__label">
            Days
          </label>
          <input
            id={`${id}-days`}
            className="field__input num"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-invalid={errors.days ? true : undefined}
          />
          {errors.days && <p className="field__error">{errors.days}</p>}
        </div>
      </div>
      {defaultDays > 0 && (
        <p className="hand estimate-form__days">
          {place ? `= the ${plural(defaultDays, 'night')} in ${place.name}` : `= the ${plural(defaultDays, 'day')} of the trip`}
        </p>
      )}
      <RateField id={`${id}-rate`} rate={rate} amount={perDay} error={errors.rate} />
      {travellers.length > 1 && (
        <div className="field" role="group" aria-labelledby={`${id}-who`}>
          <span id={`${id}-who`} className="field__label">
            Who
          </span>
          <div className="chips">
            {travellers.map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={people.includes(t.id)} onClick={() => toggle(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="estimate-form__sum">
        <span className="hand">
          {perDay === null ? '…' : formatMoney(perDay, rate.currency)} × {plural(dayCount ?? 0, 'day')}
          {travellers.length > 1 ? ` × ${plural(people.length, 'person', 'people')}` : ''}
        </span>
        <b className="num">{total === null ? '—' : formatMoney(Math.round(total), trip.currency)}</b>
      </div>
      <FormActions
        busy={busy}
        submitLabel={estimate ? 'Save' : 'Add'}
        onCancel={onCancel}
        onDelete={
          estimate
            ? async () => {
                await deleteDailyEstimate(estimate.id)
                onDone()
              }
            : undefined
        }
        deleteName={estimate?.label}
      />
    </form>
  )
}
