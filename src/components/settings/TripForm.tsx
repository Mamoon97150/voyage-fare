import { useState, type FormEvent } from 'react'
import { FormMessage } from '../AuthForm'
import { CityField } from '../CityField'
import { SketchBox } from '../Sketch'
import { explainAuthError } from '../../lib/authForm'
import { amountForInput, parseAmount } from '../../lib/money'
import type { CityValue } from '../../lib/places'
import { updateTrip, type TripDetail } from '../../lib/trips'

/** Name, dates, leaving from, and the target: one form, one Save. */
export function TripForm({ detail, onSaved }: { detail: TripDetail; onSaved: () => void }) {
  const { trip } = detail
  const [name, setName] = useState(trip.name)
  const [noDates, setNoDates] = useState(!trip.start_date)
  const [start, setStart] = useState(trip.start_date ?? '')
  const [end, setEnd] = useState(trip.end_date ?? '')
  const [home, setHome] = useState<CityValue>({
    name: trip.home_city ?? '',
    country: null,
    latitude: trip.home_latitude,
    longitude: trip.home_longitude,
  })
  const [target, setTarget] = useState(amountForInput(trip.target_amount))
  const [scope, setScope] = useState<'per_person' | 'total'>(trip.target_scope === 'total' ? 'total' : 'per_person')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string }>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give the trip a name.'
    if (!noDates) {
      if (!start || !end) found.dates = 'Choose both days, or tick “Dates not decided yet”.'
      else if (end < start) found.dates = 'The trip ends before it starts.'
    }
    const amount = target.trim() ? parseAmount(target) : null
    if (target.trim() && amount === null) found.target = 'Enter an amount, like 2 500.'
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await updateTrip(trip.id, {
        name: name.trim(),
        startDate: noDates ? null : start,
        endDate: noDates ? null : end,
        homeCity: home.name.trim() || null,
        homeLatitude: home.name.trim() ? home.latitude : null,
        homeLongitude: home.name.trim() ? home.longitude : null,
        targetAmount: amount,
        targetScope: scope,
      })
      setMessage({ tone: 'info', text: 'Saved.' })
      onSaved()
    } catch (error) {
      setMessage({ tone: 'error', text: explainAuthError(error as { message?: string }).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="settings__form">
      <SketchBox weight="light" className="form__sheet" seed={71}>
        <h2 className="sheet-title">The trip</h2>
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor="settings-name" className="field__label">
            Name
          </label>
          <input
            id="settings-name"
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'settings-name-error' : undefined}
          />
          {errors.name && (
            <p id="settings-name-error" className="field__error">
              {errors.name}
            </p>
          )}
        </div>
        <fieldset className={`dates${errors.dates ? ' field--error' : ''}`}>
          <legend className="field__label">Dates</legend>
          {!noDates && (
            <div className="row2">
              <label className="field">
                <span className="field__hint">From</span>
                <input type="date" className="field__input" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__hint">To</span>
                <input type="date" className="field__input" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={noDates} onChange={(e) => setNoDates(e.target.checked)} />
            Dates not decided yet
          </label>
          {errors.dates && <p className="field__error">{errors.dates}</p>}
        </fieldset>
        <CityField
          id="settings-home"
          label="Leaving from"
          value={home}
          onChange={setHome}
          placeholder="St Martin"
          hint="Where the trip starts and ends."
        />
      </SketchBox>

      <SketchBox weight="light" className="form__sheet" seed={72}>
        <h2 className="sheet-title">Budget</h2>
        <div className={`field${errors.target ? ' field--error' : ''}`}>
          <label htmlFor="settings-target" className="field__label">
            Target
          </label>
          <div className="field__box">
            <input
              id="settings-target"
              className="field__input num"
              inputMode="decimal"
              placeholder="No target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={errors.target ? true : undefined}
              aria-describedby={errors.target ? 'settings-target-error' : undefined}
            />
            <span className="field__unit">{trip.currency}</span>
          </div>
          {errors.target && (
            <p id="settings-target-error" className="field__error">
              {errors.target}
            </p>
          )}
          <div className="switch" role="radiogroup" aria-label="Target for">
            <button type="button" role="radio" aria-checked={scope === 'per_person'} onClick={() => setScope('per_person')}>
              Per person
            </button>
            <button type="button" role="radio" aria-checked={scope === 'total'} onClick={() => setScope('total')}>
              Whole trip
            </button>
          </div>
        </div>
      </SketchBox>

      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <button type="submit" className="button button--primary button--wide" disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'Saving…' : 'Save the trip'}
      </button>
    </form>
  )
}
