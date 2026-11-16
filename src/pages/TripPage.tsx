import { Fragment, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Sketch, SketchBox } from '../components/Sketch'
import { TripBudget } from '../components/TripBudget'
import { TripNav } from '../components/TripNav'
import { AddPlace } from '../components/trip/AddPlace'
import { EstimateForm, EstimateRows } from '../components/trip/DailyEstimates'
import { AddItem } from '../components/trip/ItemForm'
import { ItemRow } from '../components/trip/ItemRow'
import { PlacesWeLoved, ToTryForm, ToTryList } from '../components/trip/ToTry'
import { DayPrompts, WhereWeSleep } from '../components/trip/PlacePrompts'
import { DayMap } from '../components/trip/DayMap'
import { dayMap, kmText } from '../lib/dayMap'
import { PlaceForm } from '../components/trip/PlaceForm'
import { RouteGap } from '../components/trip/RouteGap'
import { RouteCard } from '../components/trip/RouteCard'
import { TripTopBar } from '../components/trip/TripTopBar'
import { WelcomeNote } from '../components/trip/WelcomeNote'
import { ToReview } from '../components/trip/TripAddress'
import { Loading } from '../lib/auth'
import { isToTry, placeDays } from '../lib/toTry'
import { needsStay } from '../lib/itemDetails'
import { useTrip } from '../lib/useTrip'
import { isReadOnly, useTripId, useViewer } from '../lib/demo'
import { DemoStrip, YourTurn } from '../components/DemoParts'
import { hintSeen, markHintSeen } from '../lib/hints'
import { useAuth } from '../lib/authContext'
import { formatWhole } from '../lib/money'
import { plural, tripSubtitle } from '../lib/tripText'
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
  type Mode,
} from '../lib/tripView'

/**
 * Inside a trip (mockup: trip view v3). The budget bar stays at the top; each place is a
 * numbered sheet with its stay, its days and its ideas; whole-trip items have their own sheet.
 */
export function TripPage() {
  const tripId = useTripId()
  const { session } = useAuth()
  const { detail, loadError, load } = useTrip(tripId)
  const viewer = useViewer(detail, session?.user.id)
  const [mode, setMode] = useState<Mode>('mine')
  const [adding, setAdding] = useState<string | null>(null) // a place id, 'trip', or nothing
  const [editingPlace, setEditingPlace] = useState<string | null>(null)
  // Day maps opened (maps-v6): closed by default, so the page doesn't get longer.
  const [openMaps, setOpenMaps] = useState<Set<string>>(new Set())
  const toggleMap = (key: string) =>
    setOpenMaps((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  // Tapping a row opens it for changes: say so once, until the first time it's used (review 13 Nov).
  const [tapHint, setTapHint] = useState(() => !hintSeen('tap-to-change'))

  // Coming from the route map's list of stops (#place-…): go to that place's sheet.
  const loaded = detail !== undefined && detail !== null
  useEffect(() => {
    if (!loaded || !window.location.hash.startsWith('#place-')) return
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.({ block: 'start' })
  }, [loaded])

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
  const readOnly = isReadOnly(detail)
  const solo = isSolo(detail)
  const shownMode: Mode = solo ? 'total' : mode
  const viewerName = travellers.find((t) => t.id === viewer)?.name ?? null
  const days = tripDays(detail)
  const meta = tripSubtitle(trip, travellers.length)
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
      <TripTopBar
        title={trip.name}
        subtitle={meta}
        tripId={trip.id}
        travellers={travellers}
        userId={session?.user.id}
        detail={detail}
      />
      <DemoStrip detail={detail} />
      <ImportedNote />
      {!readOnly && <ToReview detail={detail} onChanged={reload} />}
      {!readOnly && (
        <WelcomeNote tripId={trip.id} userId={session?.user.id} createdBy={trip.created_by} travellers={travellers} />
      )}

      <TripBudget
        view={budgetView(detail, viewer, shownMode)}
        currency={trip.currency}
        mode={shownMode}
        onMode={setMode}
        viewerName={viewerName}
        mineLabel={readOnly && viewerName ? `${viewerName}’s share` : undefined}
        solo={solo}
      />

      <div className="screen__body">
        <RouteCard detail={detail} />
        {tapHint && !readOnly && items.length > 0 && (
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
            <RouteGap
              detail={detail}
              legs={legsAfter(detail, null)}
              viewer={viewer}
              mode={shownMode}
              onChanged={reload}
              onOpen={opened}
            />
            {places.map((place, i) => {
              const placeItems = items.filter((it) => it.place_id === place.id)
              const ownDays = placeDays(detail, place)
              const addHere = (kind: 'housing' | 'activity' | 'restaurant', day?: number) =>
                setAdding(`${kind}:${place.id}:${day ?? ''}`)
              const addingHere = (kind: string, day?: number) => adding === `${kind}:${place.id}:${day ?? ''}`
              const inlineAdd = (kind: 'housing' | 'activity' | 'restaurant', day?: number) => (
                <AddItem
                  detail={detail}
                  placeId={place.id}
                  kinds={KINDS_FOR_PLACE}
                  days={days}
                  placeDays={ownDays}
                  startKind={kind}
                  startDay={day}
                  onAdded={added}
                  onCancel={() => setAdding(null)}
                />
              )
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
                          <small>
                            {place.nights ? plural(place.nights, 'night') : 'nights not set'}
                            {placeItems.some((it) => isToTry(it, detail.options)) &&
                              ` · ${placeItems.filter((it) => isToTry(it, detail.options)).length} to try`}
                          </small>
                        </h2>
                        <span className="place__total num">
                          {formatWhole(placeTotal(detail, place, viewer, shownMode), trip.currency)}
                          {placeItems.some((it) => it.package_id && it.status !== 'dropped') && (
                            <small className="place__plus">+ package</small>
                          )}
                        </span>
                        {!readOnly && editingPlace !== place.id && (
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
                      {needsStay(placeItems, place.id, place.nights) &&
                        !readOnly &&
                        (addingHere('housing') ? (
                          inlineAdd('housing')
                        ) : (
                          <WhereWeSleep onAdd={() => addHere('housing')} />
                        ))}
                      {groupPlaceItems(placeItems, trip.start_date, readOnly ? [] : ownDays, detail.options).map(
                        (group) => {
                          const view = group.day !== undefined ? dayMap(detail, place, group.day, group.items) : null
                          const mapKey = `${place.id}:${group.day}`
                          const mapOpen = view !== null && view.stops.length > 0 && openMaps.has(mapKey)
                          const pinOf = (it: (typeof group.items)[number]) =>
                            !mapOpen || it.status === 'dropped'
                              ? undefined
                              : (view.stops.find((s) => s.item.id === it.id)?.n ??
                                (view.unplaced.includes(it) ? ('?' as const) : undefined))
                          return (
                            <div key={group.key} className="item-group">
                              <p className="item-group__label">
                                {group.label}
                                {group.key === 'to-try' && <span className="hand item-group__note">no day yet</span>}
                                {view && view.stops.length > 0 && (
                                  <button
                                    type="button"
                                    className="map-toggle"
                                    aria-expanded={mapOpen}
                                    aria-label={`Map of ${group.label}`}
                                    onClick={() => toggleMap(mapKey)}
                                  >
                                    ⌖ Map {mapOpen ? '▴' : `· ${view.stops.length}`}
                                  </button>
                                )}
                              </p>
                              {mapOpen && (
                                <>
                                  <DayMap view={view} label={`Map of ${group.label}`} />
                                  {view.km !== null && (
                                    <p className="hand day-map__note">
                                      {view.stay ? '⌂ → ' : ''}
                                      {view.stops.map((s) => s.n).join(' → ')} · {kmText(view.km)}
                                    </p>
                                  )}
                                </>
                              )}
                              {group.key === 'to-try' ? (
                                <ToTryList detail={detail} items={group.items} onChanged={reload} />
                              ) : (
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
                                      pin={pinOf(it)}
                                    />
                                  ))}
                                </ul>
                              )}
                              {group.day !== undefined &&
                                !readOnly &&
                                (addingHere('activity', group.day) ? (
                                  inlineAdd('activity', group.day)
                                ) : addingHere('restaurant', group.day) ? (
                                  inlineAdd('restaurant', group.day)
                                ) : (
                                  <DayPrompts
                                    items={placeItems}
                                    placeId={place.id}
                                    day={group.day}
                                    onAdd={(kind) => addHere(kind, group.day)}
                                  />
                                ))}
                            </div>
                          )
                        },
                      )}
                      <EstimateRows
                        detail={detail}
                        placeId={place.id}
                        viewer={viewer}
                        mode={shownMode}
                        onChanged={reload}
                      />
                      {adding === place.id ? (
                        <AddItem
                          detail={detail}
                          placeId={place.id}
                          kinds={KINDS_FOR_PLACE}
                          days={days}
                          placeDays={ownDays}
                          onAdded={added}
                          onCancel={() => setAdding(null)}
                        />
                      ) : adding === `to-try:${place.id}` ? (
                        <ToTryForm detail={detail} placeId={place.id} onDone={added} onCancel={() => setAdding(null)} />
                      ) : adding === `estimate:${place.id}` ? (
                        <EstimateForm
                          detail={detail}
                          placeId={place.id}
                          onDone={added}
                          onCancel={() => setAdding(null)}
                        />
                      ) : readOnly ? null : (
                        <div className="place__adds">
                          <button type="button" className="add-row place__add" onClick={() => setAdding(place.id)}>
                            <span className="add-row__plus" aria-hidden="true">
                              +
                            </span>
                            Add to {place.name}
                          </button>
                          <button
                            type="button"
                            className="add-row place__add"
                            onClick={() => setAdding(`to-try:${place.id}`)}
                          >
                            <span className="add-row__plus" aria-hidden="true">
                              +
                            </span>
                            To try
                          </button>
                          <button
                            type="button"
                            className="add-row place__add"
                            onClick={() => setAdding(`estimate:${place.id}`)}
                          >
                            <span className="add-row__plus" aria-hidden="true">
                              +
                            </span>
                            Daily estimate
                          </button>
                        </div>
                      )}
                    </SketchBox>
                  </section>
                  <RouteGap
                    detail={detail}
                    legs={legsAfter(detail, place.id)}
                    viewer={viewer}
                    mode={shownMode}
                    onChanged={reload}
                    onOpen={opened}
                  />
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
                <EstimateRows detail={detail} placeId={null} viewer={viewer} mode={shownMode} onChanged={reload} />
                {adding === 'trip' ? (
                  <AddItem
                    detail={detail}
                    placeId={null}
                    kinds={KINDS_FOR_TRIP}
                    days={days}
                    onAdded={added}
                    onCancel={() => setAdding(null)}
                  />
                ) : adding === 'estimate:trip' ? (
                  <EstimateForm detail={detail} placeId={null} onDone={added} onCancel={() => setAdding(null)} />
                ) : readOnly ? null : (
                  <div className="place__adds">
                    <button type="button" className="add-row place__add" onClick={() => setAdding('trip')}>
                      <span className="add-row__plus" aria-hidden="true">
                        +
                      </span>
                      Add to the whole trip
                    </button>
                    <button type="button" className="add-row place__add" onClick={() => setAdding('estimate:trip')}>
                      <span className="add-row__plus" aria-hidden="true">
                        +
                      </span>
                      Daily estimate
                    </button>
                  </div>
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
            ) : readOnly ? null : (
              <button type="button" className="add-row" onClick={() => setAdding('place')}>
                <span className="add-row__plus" aria-hidden="true">
                  +
                </span>
                Add a place
              </button>
            )}
            <PlacesWeLoved detail={detail} />
            <YourTurn detail={detail} />
          </>
        )}
      </div>
      <TripNav tripId={trip.id} solo={solo} />
    </div>
  )
}

/** Back from "Import from my AI" or "A new trip from this one": what happened, in one note. */
function ImportedNote() {
  const location = useLocation()
  const note = (location.state as { note?: string } | null)?.note
  if (!note) return null
  return (
    <div className="screen__body screen__body--note">
      <p className="form-message form-message--info" role="status">
        {note}
      </p>
    </div>
  )
}
