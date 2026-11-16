import { Link } from 'react-router'
import type { Traveller, TripDetail } from '../../lib/trips'
import { TripShare } from './TripMenu'
import { demoDefault, useDemo } from '../../lib/demo'

const SHOWN = 4

/**
 * The top of a trip, its notebook cover: back to all trips, the trip's name with its dates by hand,
 * and who's on it (mockup 1, Compare v4).
 * Then the trip's people and tools together (build 8½, menus-home-v6): the initials (who's coming,
 * + invite, in Trip settings), ↗ Share and ⚙ Trip settings. The ☰ menu is gone.
 */
export function TripTopBar({
  title,
  subtitle,
  tripId,
  travellers,
  userId,
  detail,
}: {
  title: string
  /** By hand under the name: dates, where from, how many (Compare v4: the notebook's cover). */
  subtitle?: string
  tripId?: string
  travellers?: Traveller[]
  userId?: string
  /** The whole trip: shows ↗ Share and ⚙ next to the initials (build 8½). */
  detail?: TripDetail
}) {
  const demo = useDemo()
  return (
    <header className="screen__top">
      <Link to={demo ? '/' : '/trips'} className="screen__back" aria-label={demo ? 'Welcome page' : 'All trips'}>
        ‹
      </Link>
      <div className="screen__heading">
        <h1 className="screen__title screen__title--trip">{title}</h1>
        {subtitle && <p className="screen__sub">{subtitle}</p>}
      </div>
      {travellers && <TripTools tripId={tripId} travellers={travellers} userId={userId} detail={detail} />}
    </header>
  )
}

/**
 * The trip's people and tools (build 8½, menus-home-v6): the initials (who's coming, + invite),
 * ↗ Share and ⚙ Trip settings. Top right of the phone; on a computer, on top of the third column.
 */
export function TripTools({
  tripId,
  travellers,
  userId,
  detail,
}: {
  tripId?: string
  travellers: Traveller[]
  userId?: string
  detail?: TripDetail
}) {
  const demo = useDemo()
  // With ↗ and ⚙ next to them, two initials fewer, so the name keeps its room on a phone.
  const shown = travellers.slice(0, detail ? SHOWN - 2 : SHOWN)
  const more = travellers.length - shown.length
  const initials = (me: (t: Traveller) => boolean) => (
    <>
      {shown.map((t) => (
        <span key={t.id} className={`avatar${me(t) ? ' avatar--me' : ''}`} aria-hidden="true">
          {t.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {more > 0 && (
        <span className="avatar avatar--more" aria-hidden="true">
          +{more}
        </span>
      )}
    </>
  )
  return (
    <span className="trip-tools">
      {/* The demo has no settings: the initials are just who's on it. */}
      {demo ? (
        <span className="avatars" aria-label={travellers.map((t) => t.name).join(', ')}>
          {initials((t) => t.id === (demo.seeAs ?? demoDefault({ travellers })))}
        </span>
      ) : (
        tripId && (
          <Link
            to={`/trips/${tripId}/settings#travellers`}
            className="avatars"
            aria-label={`Who’s coming: ${travellers.map((t) => t.name).join(', ')}`}
          >
            {initials((t) => Boolean(t.user_id && t.user_id === userId))}
          </Link>
        )
      )}
      {detail && <TripShare detail={detail} />}
      {detail && !demo && tripId && (
        <Link to={`/trips/${tripId}/settings`} className="round-button trip-tools__settings" aria-label="Trip settings">
          ⚙
        </Link>
      )}
    </span>
  )
}
