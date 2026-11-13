import { useState, type FormEvent } from 'react'
import { FormMessage } from '../AuthForm'
import { CityField } from '../CityField'
import { explainAuthError } from '../../lib/authForm'
import { emptyCity, type CityValue } from '../../lib/places'
import { addPlace, type Place } from '../../lib/trips'

export function AddPlace({
  tripId,
  position,
  onAdded,
  first = false,
}: {
  tripId: string
  position: number
  onAdded: (place: Place) => void
  first?: boolean
}) {
  const [city, setCity] = useState<CityValue>(emptyCity)
  const [nights, setNights] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!city.name.trim()) found.city = 'Type a city or an area.'
    const n = nights.trim() ? Number(nights) : 0
    if (!Number.isInteger(n) || n < 0 || n > 365) found.nights = 'A whole number of nights, like 3.'
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      const place = await addPlace({
        tripId,
        name: city.name.trim(),
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
        nights: n,
        position,
      })
      onAdded(place)
      setCity(emptyCity)
      setNights('')
    } catch (error) {
      setFormError(explainAuthError(error as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="add-place">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <CityField
        id={`place-${position}`}
        label="City or area"
        value={city}
        onChange={setCity}
        placeholder="Cartagena, Medellín…"
        error={errors.city}
        autoFocus={first}
      />
      <div className={`field field--short${errors.nights ? ' field--error' : ''}`}>
        <label htmlFor={`nights-${position}`} className="field__label">
          Nights
        </label>
        <input
          id={`nights-${position}`}
          className="field__input num"
          inputMode="numeric"
          placeholder="0"
          value={nights}
          onChange={(e) => setNights(e.target.value)}
          aria-invalid={errors.nights ? true : undefined}
          aria-describedby={errors.nights ? `nights-${position}-error` : undefined}
        />
        {errors.nights && (
          <p id={`nights-${position}-error`} className="field__error">
            {errors.nights}
          </p>
        )}
      </div>
      <button type="submit" className="button button--primary button--wide" disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'Adding…' : 'Add the place'}
      </button>
    </form>
  )
}
