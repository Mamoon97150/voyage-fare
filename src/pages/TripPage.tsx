import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { CityField } from '../components/CityField'
import { Sketch, SketchBox } from '../components/Sketch'
import { TripBudget } from '../components/TripBudget'
import { AddItem, ItemRow } from '../components/TripItems'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { formatMoney } from '../lib/money'
import { emptyCity, type CityValue } from '../lib/places'
import { addPlace, getTrip, type Place, type TripDetail } from '../lib/trips'
import { formatDates, plural } from '../lib/tripText'
import {
  budgetView,
  groupPlaceItems,
  isSolo,
  KINDS_FOR_PLACE,
  KINDS_FOR_TRIP,
  placeTotal,
  tripDays,
  viewerOf,
  type Mode,
} from '../lib/tripView'

/**
 * Inside a trip (mockup: trip view v3). The budget bar stays at the top; each place is a
 * numbered sheet with its stay, its days and its ideas; whole-trip items have their own sheet.
 */
export function TripPage() {
  const { tripId = '' } = useParams()
  const { session } = useAuth()
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string>()
  const [mode, setMode] = useState<Mode>('mine')
  const [adding, setAdding] = useState<string | null>(null) // a place id, 'trip', or nothing

  const load = useCallback(
    () =>
      getTrip(tripId)
        .then((d) => setDetail(d))
        .catch((e) => setLoadError(explainAuthError(e).message)),
    [tripId],
  )

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

  const { trip, travellers, places, items } = detail
  const viewer = viewerOf(detail, session?.user.id)
  const solo = isSolo(detail)
  const shownMode: Mode = solo ? 'total' : mode
  const viewerName = travellers.find((t) => t.id === viewer)?.name ?? null
  const days = tripDays(detail)
  const meta = [
    formatDates(trip.start_date, trip.end_date) ?? 'Dates not decided',
    trip.home_city && `from ${trip.home_city}`,
    plural(travellers.length, 'traveller'),
  ]
    .filter(Boolean)
    .join(' · ')
  const wholeTrip = items.filter((i) => !i.place_id)

  const added = () => {
    setAdding(null)
    void load()
  }

  return (
    <div className="screen screen--trip">
      <TopBar title={trip.name} />
      <p className="screen__meta">{meta}</p>

      <TripBudget
        view={budgetView(detail, viewer, shownMode)}
        currency={trip.currency}
        mode={shownMode}
        onMode={setMode}
        viewerName={viewerName}
        solo={solo}
      />

      <div className="screen__body">
        {places.length === 0 ? (
          <SketchBox tape="mustard" className="empty" seed={21}>
            <Sketch name="empty-trip" width={200} />
            <h2 className="empty__title">Add your first place</h2>
            <p className="hand empty__note">where does the trip begin?</p>
            <AddPlace tripId={trip.id} position={1} onAdded={() => void load()} first />
          </SketchBox>
        ) : (
          <>
            {places.map((place, i) => {
              const placeItems = items.filter((it) => it.place_id === place.id)
              return (
                <section key={place.id} className="place" aria-labelledby={`place-${place.id}`}>
                  <header className="place__head">
                    <span className="place__pin" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h2 id={`place-${place.id}`} className="place__name">
                      {place.name}
                      <small>{place.nights ? plural(place.nights, 'night') : 'nights not set'}</small>
                    </h2>
                    <span className="place__total num">
                      {formatMoney(placeTotal(detail, place, viewer, shownMode), trip.currency)}
                    </span>
                  </header>
                  {groupPlaceItems(placeItems).map((group) => (
                    <div key={group.key} className="item-group">
                      <p className="item-group__label">{group.label}</p>
                      <ul className="item-list">
                        {group.items.map((it) => (
                          <ItemRow
                            key={it.id}
                            detail={detail}
                            item={it}
                            viewer={viewer}
                            mode={shownMode}
                            showDays={group.key === 'stay' || group.key === 'ideas'}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                  {adding === place.id ? (
                    <AddItem
                      detail={detail}
                      placeId={place.id}
                      kinds={KINDS_FOR_PLACE}
                      days={days}
                      onAdded={added}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <button type="button" className="add-row place__add" onClick={() => setAdding(place.id)}>
                      <span className="add-row__plus" aria-hidden="true">
                        +
                      </span>
                      Add to {place.name}
                    </button>
                  )}
                </section>
              )
            })}

            <section className="place place--trip" aria-labelledby="whole-trip">
              <header className="place__head">
                <h2 id="whole-trip" className="place__name">
                  Whole trip
                  <small>flights, insurance, car…</small>
                </h2>
              </header>
              {wholeTrip.length > 0 && (
                <ul className="item-list">
                  {wholeTrip.map((it) => (
                    <ItemRow key={it.id} detail={detail} item={it} viewer={viewer} mode={shownMode} />
                  ))}
                </ul>
              )}
              {adding === 'trip' ? (
                <AddItem
                  detail={detail}
                  placeId={null}
                  kinds={KINDS_FOR_TRIP}
                  days={days}
                  onAdded={added}
                  onCancel={() => setAdding(null)}
                />
              ) : (
                <button type="button" className="add-row place__add" onClick={() => setAdding('trip')}>
                  <span className="add-row__plus" aria-hidden="true">
                    +
                  </span>
                  Add to the whole trip
                </button>
              )}
            </section>

            <SketchBox className="form__sheet" seed={22 + places.length}>
              <h2 className="sheet-title">Add the next place</h2>
              <AddPlace tripId={trip.id} position={places.length + 1} onAdded={() => void load()} />
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

