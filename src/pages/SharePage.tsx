import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { NoConnection } from '../components/PhoneApp'
import { SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { explainAuthError } from '../lib/authForm'
import { sharedPost } from '../lib/pwa'
import { shelve, todayIso } from '../lib/shelf'
import { sourceOf } from '../lib/toTry'
import { addToTry, listTrips, type TripCard } from '../lib/trips'
import { useSaving } from '../lib/useSaving'

/**
 * A post shared to Voyage Fare from the phone's Share menu (Android; mockup pwa-v5, 15 Nov):
 * the link is in, pick the trip (the next one first), the place, a name, done → To try.
 */
export function SharePage() {
  const [params] = useSearchParams()
  const shared = useMemo(() => sharedPost(params), [params])
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripCard[]>()
  const [loadError, setLoadError] = useState<string>()
  const [offline, setOffline] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    listTrips()
      .then((t) => {
        if (!active) return
        setTrips(t)
        setOffline(false)
      })
      .catch((e) => {
        if (!active) return
        if (!navigator.onLine) setOffline(true)
        else setLoadError(explainAuthError(e).message)
      })
    return () => {
      active = false
    }
  }, [attempt])

  // The next trip first, then the others to come, the dreams; past trips last.
  const ordered = useMemo(() => {
    if (!trips) return []
    const shelf = shelve(trips, todayIso())
    return [...(shelf.featured ? [shelf.featured] : []), ...shelf.coming, ...shelf.dreams, ...shelf.past]
  }, [trips])

  return (
    <div className="page">
      <main className="share-page">
        {loadError && <FormMessage tone="error">{loadError}</FormMessage>}
        {offline && <NoConnection onRetry={() => setAttempt((n) => n + 1)} />}
        {!loadError && !offline && trips === undefined && <Loading />}
        {trips && ordered.length === 0 && (
          <SketchBox tape="mustard" className="share-sheet" seed={23}>
            <h1 className="share-sheet__title">To try</h1>
            <p className="empty__lead">Start a trip first: a restaurant to try is kept with one of its places.</p>
            <Link to="/trips/new" className="button button--primary">
              + Start a trip
            </Link>
          </SketchBox>
        )}
        {ordered.length > 0 && (
          <ShareForm
            trips={ordered}
            link={shared.link}
            name={shared.name}
            onDone={(tripId, placeId) => navigate(`/trips/${tripId}#place-${placeId}`)}
            onCancel={() => navigate('/trips')}
          />
        )}
      </main>
    </div>
  )
}

function ShareForm({
  trips,
  link,
  name: sharedName,
  onDone,
  onCancel,
}: {
  trips: TripCard[]
  link: string | null
  name: string | null
  onDone: (tripId: string, placeId: string) => void
  onCancel: () => void
}) {
  const source = sourceOf(link)
  const [tripId, setTripId] = useState(trips[0].id)
  const trip = trips.find((t) => t.id === tripId) ?? trips[0]
  const [placeId, setPlaceId] = useState<string | null>(trip.places.length === 1 ? trip.places[0].id : null)
  const [name, setName] = useState(sharedName ?? source?.name ?? '')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { busy, run } = useSaving()

  function pickTrip(id: string) {
    setTripId(id)
    const places = trips.find((t) => t.id === id)?.places ?? []
    setPlaceId(places.length === 1 ? places[0].id : null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!placeId) found.place = 'Pick the place it’s in.'
    if (!name.trim()) found.name = 'Give it a name, like “El Cielo”.'
    setErrors(found)
    if (Object.keys(found).length || !placeId) return
    await run(async () => {
      await addToTry({ placeId, name: name.trim(), link, note: note.trim() || null, amount: null })
      onDone(trip.id, placeId)
    }, setFormError)
  }

  return (
    <SketchBox tape="mustard" className="share-sheet" seed={23}>
      <form onSubmit={submit} noValidate className="add-item">
        <h1 className="share-sheet__title">
          To try
          {source && <small className="hand">shared from {source.label}</small>}
        </h1>
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        {source && link && (
          <p className="pasted">
            <i className={`source__badge source__badge--${source.kind}`} aria-hidden="true">
              {source.badge}
            </i>
            <span>
              <b>{source.label}</b>
              <span className="pasted__link">{source.handle ?? link.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </span>
          </p>
        )}
        {trips.length > 1 && (
          <div className="field" role="radiogroup" aria-labelledby="share-trip">
            <span id="share-trip" className="field__label">
              Which trip?
            </span>
            <div className="chips">
              {trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={t.id === trip.id}
                  onClick={() => pickTrip(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={`field${errors.place ? ' field--error' : ''}`} role="radiogroup" aria-labelledby="share-where">
          <span id="share-where" className="field__label">
            Where?
          </span>
          {trip.places.length === 0 ? (
            <p className="field__hint">
              {trip.name} has no places yet: <Link to={`/trips/${trip.id}`}>add one first</Link>.
            </p>
          ) : (
            <div className="chips">
              {trip.places.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={p.id === placeId}
                  onClick={() => setPlaceId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {errors.place && <p className="field__error">{errors.place}</p>}
        </div>
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor="share-name" className="field__label">
            Name
          </label>
          <input
            id="share-name"
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <p className="field__error">{errors.name}</p>}
        </div>
        <div className="field">
          <label htmlFor="share-note" className="field__label">
            A note <span className="field__optional">(optional)</span>
          </label>
          <input id="share-note" className="field__input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="add-item__actions">
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy || trip.places.length === 0}>
            Add to To try
          </button>
        </div>
      </form>
    </SketchBox>
  )
}
