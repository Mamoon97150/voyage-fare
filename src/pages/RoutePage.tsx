import { Fragment, useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { RouteMap } from '../components/RouteMap'
import { MissingNote } from '../components/trip/RouteCard'
import { Loading } from '../lib/auth'
import { useTrip } from '../lib/useTrip'
import { useAuth } from '../lib/authContext'
import { formatWhole } from '../lib/money'
import { routeOf } from '../lib/route'
import { plural, shortDay } from '../lib/tripText'
import { legsAfter, MODES, placeTotal, viewerOf } from '../lib/tripView'
import type { TicketMode } from '../lib/trips'

const day = (iso: string | null) => (iso ? shortDay(iso) : null)

/**
 * The big route map (mockup route-map-v4, step 2): zoom and drag, and under it the stops in order,
 * with their nights and your share there. A stop opens its sheet on the trip page.
 */
export function RoutePage() {
  const { tripId = '' } = useParams()
  const { session } = useAuth()
  const { detail, loadError: error } = useTrip(tripId)

  const route = useMemo(() => (detail ? routeOf(detail) : null), [detail])

  if (error) return <Shell tripId={tripId}><FormMessage tone="error">{error}</FormMessage></Shell>
  if (detail === null) {
    return (
      <Shell tripId={tripId}>
        <p className="screen__intro">
          This trip isn’t here. <Link to="/trips">Back to your trips</Link>
        </p>
      </Shell>
    )
  }
  if (detail === undefined || !route) return <Loading />

  const viewer = viewerOf(detail, session?.user.id)
  const currency = detail.trip.currency
  const via = (afterPlaceId: string | null) =>
    legsAfter(detail, afterPlaceId)
      .filter((l) => l.leg.via)
      .map((l) => `${MODES[l.leg.mode as TicketMode]?.icon ?? '•'} via ${l.leg.via}`)

  return (
    <Shell tripId={tripId}>
      {route.pinned.length > 0 ? (
        <RouteMap route={route} big height={330} />
      ) : (
        <p className="screen__intro">No place on the map yet: pick the cities from the suggestions.</p>
      )}
      <MissingNote names={route.missing.map((p) => p.name)} />
      <ol className="stops">
        {route.home && (
          <li className="stops__row">
            <span className="stops__n stops__n--home" aria-hidden="true">
              ⌂
            </span>
            <span>
              {route.home.name} {day(detail.trip.start_date) && <small>leaving {day(detail.trip.start_date)}</small>}
            </span>
            <span />
          </li>
        )}
        {via(null).map((v) => (
          <li key={`v-start-${v}`} className="stops__via">
            {v}
          </li>
        ))}
        {route.stops.map((s) => {
          const total = placeTotal(detail, s.place, viewer, 'mine')
          return (
            <Fragment key={s.place.id}>
              <li className="stops__row">
                <span className={s.at ? 'stops__n' : 'stops__n stops__n--off'} aria-hidden="true">
                  {s.n}
                </span>
                <Link to={`/trips/${tripId}#place-${s.place.id}`} className="stops__name">
                  {s.place.name} <small>{s.place.nights ? plural(s.place.nights, 'night') : 'nights not set'}</small>
                </Link>
                <small className="num">{total === null ? '' : formatWhole(total, currency)}</small>
              </li>
              {via(s.place.id).map((v) => (
                <li key={`v-${s.place.id}-${v}`} className="stops__via">
                  {v}
                </li>
              ))}
            </Fragment>
          )
        })}
        {route.home && (
          <li className="stops__row">
            <span className="stops__n stops__n--home" aria-hidden="true">
              ⌂
            </span>
            <span>
              {route.home.name} {day(detail.trip.end_date) ? <small>home {day(detail.trip.end_date)}</small> : <small>home</small>}
            </span>
            <span />
          </li>
        )}
      </ol>
    </Shell>
  )
}

function Shell({ tripId, children }: { tripId: string; children: React.ReactNode }) {
  return (
    <div className="screen">
      <header className="screen__top">
        <Link to={`/trips/${tripId}`} className="round-button" aria-label="Back to the trip">
          ‹
        </Link>
        <h1 className="screen__title">The route</h1>
      </header>
      <div className="screen__body route-page">{children}</div>
    </div>
  )
}
