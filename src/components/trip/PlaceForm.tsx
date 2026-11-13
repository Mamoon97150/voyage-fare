import { useState, type FormEvent } from 'react'
import { FormMessage } from '../AuthForm'
import { FormActions } from '../FormActions'
import { explainAuthError } from '../../lib/authForm'
import { deletePlace, updatePlace, type Place } from '../../lib/trips'

/** Change a place's name and nights, or delete it with what's in it. */
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
  const [name, setName] = useState(place.name)
  const [nights, setNights] = useState(String(place.nights))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const id = `place-edit-${place.id}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give the place a name.'
    const n = nights.trim() ? Number(nights) : 0
    if (!Number.isInteger(n) || n < 0 || n > 365) found.nights = 'A whole number of nights, like 3.'
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await updatePlace(place.id, { name: name.trim(), nights: n })
      onDone()
    } catch (error) {
      setBusy(false)
      setFormError(explainAuthError(error as { message?: string }).message)
    }
  }

  const goesWith =
    itemCount === 0 ? 'nothing else' : itemCount === 1 ? 'the 1 thing in it' : `the ${itemCount} things in it`

  return (
    <form onSubmit={submit} noValidate className="add-item">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <div className="row2">
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
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
          {errors.name && (
            <p id={`${id}-name-error`} className="field__error">
              {errors.name}
            </p>
          )}
        </div>
        <div className={`field${errors.nights ? ' field--error' : ''}`}>
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
