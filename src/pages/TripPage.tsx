import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { CityField } from '../components/CityField'
import { emptyCity, type CityValue } from '../lib/places'
import { Sketch, SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { explainAuthError } from '../lib/authForm'
import { formatMoney, NO_AMOUNT } from '../lib/money'
import { addPlace, getTrip, type Place, type TripDetail } from '../lib/trips'
import { formatDates, plural } from '../lib/tripText'

/**
 * Inside a trip. For now (build 2, step 1): what the trip is, the places in order,
 * and adding a place. Items, the real budget bar and the map come next.
 */
export function TripPage() {
  const { tripId = '' } = useParams()
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    let active = true
    getTrip(tripId)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [tripId])

  if (loadError) {
    return (
      <div className="screen">
        <TopBar title="Trip" />
        <div className="screen__body">
          <FormMessage tone="error">{loadError}</FormMessage>
        </div>
      </div>
    )
  }
  if (detail === undefined) return <Loading />
  if (detail === null) {
    return (
      <div className="screen">
        <TopBar title="Trip" />
        <div className="screen__body">
          <h1 className="screen__lead">This trip isn’t here</h1>
          <p className="screen__intro">It was deleted, or it isn’t shared with you.</p>
          <Link to="/trips">Back to your trips</Link>
        </div>
      </div>
    )
  }

  const { trip, travellers, places } = detail
  const dates = formatDates(trip.start_date, trip.end_date) ?? 'Dates not decided'
  const meta = [dates, trip.home_city && `from ${trip.home_city}`, plural(travellers.length, 'traveller')]
    .filter(Boolean)
    .join(' · ')
  const target =
    trip.target_amount !== null
      ? `target ${formatMoney(trip.target_amount, trip.currency, trip.target_scope === 'total' ? 'total' : 'pp')}`
      : 'no target yet'

  function added(place: Place) {
    setDetail((d) => (d ? { ...d, places: [...d.places, place] } : d))
  }

  return (
    <div className="screen screen--trip">
      <TopBar title={trip.name} />
      <p className="screen__meta">{meta}</p>

      <section className="budget-line" aria-label="Budget">
        <p className="budget-line__figure num">
          {NO_AMOUNT} <small>your share</small>
        </p>
        <p className="budget-line__target num">{target}</p>
        <div className="budget-line__track" aria-hidden="true" />
        <p className="field__hint">Nothing priced yet.</p>
      </section>

      <div className="screen__body">
        {places.length === 0 ? (
          <SketchBox tape="mustard" className="empty" seed={21}>
            <Sketch name="empty-trip" width={200} />
            <h2 className="empty__title">Add your first place</h2>
            <p className="hand empty__note">where does the trip begin?</p>
            <AddPlace tripId={trip.id} position={1} onAdded={added} first />
          </SketchBox>
        ) : (
          <>
            <ol className="places">
              {places.map((p, i) => (
                <li key={p.id} className="place-sheet">
                  <span className="place-sheet__pin" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="place-sheet__name">
                    <b>{p.name}</b>
                    {p.country && <small>{p.country}</small>}
                  </span>
                  <span className="place-sheet__nights num">{p.nights ? plural(p.nights, 'night') : NO_AMOUNT}</span>
                </li>
              ))}
            </ol>
            <SketchBox className="form__sheet" seed={22 + places.length}>
              <h2 className="sheet-title">Add the next place</h2>
              <AddPlace tripId={trip.id} position={places.length + 1} onAdded={added} />
            </SketchBox>
          </>
        )}
      </div>
    </div>
  )
}

function TopBar({ title }: { title: string }) {
  return (
    <header className="screen__top">
      <Link to="/trips" className="round-button" aria-label="All trips">
        ‹
      </Link>
      <h1 className="screen__title screen__title--trip">{title}</h1>
    </header>
  )
}

function AddPlace({
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
