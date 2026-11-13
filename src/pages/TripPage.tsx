import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Sketch, SketchBox } from '../components/Sketch'
import { TripBudget } from '../components/TripBudget'
import { TripNav } from '../components/TripNav'
import { AddPlace } from '../components/trip/AddPlace'
import { AddItem } from '../components/trip/ItemForm'
import { ItemRow } from '../components/trip/ItemRow'
import { PlaceForm } from '../components/trip/PlaceForm'
import { RouteGap } from '../components/trip/RouteGap'
import { TripTopBar } from '../components/trip/TripTopBar'
import { Loading } from '../lib/auth'
import { hintSeen, markHintSeen } from '../lib/hints'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { formatWhole } from '../lib/money'
import { getTrip, type TripDetail } from '../lib/trips'
import { formatDates, plural } from '../lib/tripText'
import {
  budgetView,
  groupPlaceItems,
  hasLegs,
  isSolo,
  legsAfter,
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
  const [editingPlace, setEditingPlace] = useState<string | null>(null)
  // Tapping a row opens it for changes: say so once, until the first time it's used (review 13 Nov).
  const [tapHint, setTapHint] = useState(() => !hintSeen('tap-to-change'))

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
        <TripTopBar title="Trip" />
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
        <TripTopBar title="Trip" />
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
  // Tickets with a route are drawn between the places, not listed again here.
  const wholeTrip = items.filter((i) => !i.place_id && !hasLegs(detail, i))

  const reload = () => void load()
  const opened = () => {
    markHintSeen('tap-to-change')
    setTapHint(false)
  }
  const added = () => {
    setAdding(null)
    reload()
  }

  return (
    <div className="screen screen--trip">
      <TripTopBar title={trip.name} tripId={trip.id} travellers={travellers} userId={session?.user.id} />
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
        {tapHint && items.length > 0 && (
          <p className="tap-hint">
            <span className="hand">tap anything to change it</span>
          </p>
        )}
        {places.length === 0 ? (
          <SketchBox tape="mustard" className="empty" seed={21}>
            <Sketch name="empty-trip" width={200} />
            <h2 className="empty__title">Add your first place</h2>
            <p className="hand empty__note">where does the trip begin?</p>
            <AddPlace tripId={trip.id} position={1} onAdded={() => void load()} first />
          </SketchBox>
        ) : (
          <>
            <RouteGap detail={detail} legs={legsAfter(detail, null)} viewer={viewer} mode={shownMode} onChanged={reload} onOpen={opened} />
            {places.map((place, i) => {
              const placeItems = items.filter((it) => it.place_id === place.id)
              return (
                <Fragment key={place.id}>
                  <section aria-labelledby={`place-${place.id}`}>
                    <SketchBox weight="light" className="place" seed={31 + i}>
                      <header className="place__head">
                        <span className="place__pin" aria-hidden="true">
                          {i + 1}
                        </span>
                        <h2 id={`place-${place.id}`} className="place__name">
                          {place.name}
                          <small>{place.nights ? plural(place.nights, 'night') : 'nights not set'}</small>
                        </h2>
                        <span className="place__total num">
                          {formatWhole(placeTotal(detail, place, viewer, shownMode), trip.currency)}
                        </span>
                        {editingPlace !== place.id && (
                          <button
                            type="button"
                            className="place__edit"
                            onClick={() => {
                              setEditingPlace(place.id)
                              opened()
                            }}
                            aria-label={`Change ${place.name}`}
                          >
                            Edit
                          </button>
                        )}
                      </header>
                      {editingPlace === place.id && (
                        <PlaceForm
                          place={place}
                          itemCount={placeItems.length}
                          onDone={() => {
                            setEditingPlace(null)
                            reload()
                          }}
                          onCancel={() => setEditingPlace(null)}
                        />
                      )}
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
                                kinds={KINDS_FOR_PLACE}
                                days={days}
                                onChanged={reload}
                                onOpen={opened}
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
                    </SketchBox>
                  </section>
                  <RouteGap detail={detail} legs={legsAfter(detail, place.id)} viewer={viewer} mode={shownMode} onChanged={reload} onOpen={opened} />
                </Fragment>
              )
            })}

            <section aria-labelledby="whole-trip">
              <SketchBox weight="light" dashed className="place place--trip" seed={29}>
                <header className="place__head">
                  <h2 id="whole-trip" className="place__name">
                    Whole trip
                    <small>tickets, insurance, car…</small>
                  </h2>
                </header>
                {wholeTrip.length > 0 && (
                  <ul className="item-list">
                    {wholeTrip.map((it) => (
                      <ItemRow
                        key={it.id}
                        detail={detail}
                        item={it}
                        viewer={viewer}
                        mode={shownMode}
                        kinds={KINDS_FOR_TRIP}
                        days={days}
                        onChanged={reload}
                        onOpen={opened}
                      />
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
              </SketchBox>
            </section>

            {/* One pattern for every "add" on the page: a row that opens the form (review 13 Nov, #4). */}
            {adding === 'place' ? (
              <SketchBox weight="light" className="form__sheet" seed={22 + places.length}>
                <h2 className="sheet-title">Add a place</h2>
                <AddPlace tripId={trip.id} position={places.length + 1} onAdded={added} first />
                <button type="button" className="link-button screen__skip" onClick={() => setAdding(null)}>
                  Cancel
                </button>
              </SketchBox>
            ) : (
              <button type="button" className="add-row" onClick={() => setAdding('place')}>
                <span className="add-row__plus" aria-hidden="true">
                  +
                </span>
                Add a place
              </button>
            )}
          </>
        )}
      </div>
      <TripNav tripId={trip.id} solo={solo} />
    </div>
  )
}
