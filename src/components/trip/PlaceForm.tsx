import { useState, type FormEvent } from 'react'
import { FormMessage } from '../AuthForm'
import { CityField } from '../CityField'
import { FormActions } from '../FormActions'
import type { CityValue } from '../../lib/places'
import { deletePlace, updatePlace, type Place } from '../../lib/trips'
import { useSaving } from '../../lib/useSaving'

/**
 * Change a place's name and nights, or delete it with what's in it. The name is a city picker
 * (16 Nov): a place that isn't on the map yet shows suggestions as soon as it opens.
 */
export function PlaceForm({
  place,
  itemCount,
  onDone,
  onCancel,
}: {
  place: Place
  itemCount: number
  onDone: () => void
  onCancel: () => void
}) {
  const [city, setCity] = useState<CityValue>({
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
  })
  const offMap = place.latitude === null
  const [nights, setNights] = useState(String(place.nights))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { busy, run } = useSaving()
  const id = `place-edit-${place.id}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!city.name.trim()) found.name = 'Give the place a name.'
    const n = nights.trim() ? Number(nights) : 0
    if (!Number.isInteger(n) || n < 0 || n > 365) found.nights = 'A whole number of nights, like 3.'
    setErrors(found)
    if (Object.keys(found).length) return
    await run(async () => {
      await updatePlace(place.id, {
        name: city.name.trim(),
        nights: n,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
      })
      onDone()
    }, setFormError)
  }

  const goesWith =
    itemCount === 0 ? 'nothing else' : itemCount === 1 ? 'the 1 thing in it' : `the ${itemCount} things in it`

  return (
    <form onSubmit={submit} noValidate className="add-item">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <CityField
        id={`${id}-name`}
        label="Name"
        value={city}
        onChange={setCity}
        error={errors.name}
        suggestNow={offMap}
        hint={offMap && city.latitude === null ? 'Not on the map yet: pick it from the list.' : undefined}
      />
      <div className={`field field--short${errors.nights ? ' field--error' : ''}`}>
        <label htmlFor={`${id}-nights`} className="field__label">
          Nights
        </label>
        <input
          id={`${id}-nights`}
          className="field__input num"
          inputMode="numeric"
          value={nights}
          onChange={(e) => setNights(e.target.value)}
          aria-invalid={errors.nights ? true : undefined}
          aria-describedby={errors.nights ? `${id}-nights-error` : undefined}
        />
        {errors.nights && (
          <p id={`${id}-nights-error`} className="field__error">
            {errors.nights}
          </p>
        )}
      </div>

      <FormActions
        busy={busy}
        submitLabel="Save"
        onCancel={onCancel}
        onDelete={async () => {
          await deletePlace(place.id)
          onDone()
        }}
        deleteName={place.name}
        deleteNote={`${place.name} and ${goesWith} go. Tickets after it move up in the route. This can’t be undone.`}
      />
    </form>
  )
}
