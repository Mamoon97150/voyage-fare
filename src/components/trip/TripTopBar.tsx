import { Link } from 'react-router'
import type { Traveller, TripDetail } from '../../lib/trips'
import { TripMenu } from './TripMenu'
import { demoDefault, useDemo } from '../../lib/demo'

const SHOWN = 4

/**
 * The top of a trip, its notebook cover: back to all trips, the trip's name with its dates by hand,
 * and who's on it (mockup 1, Compare v4).
 * The initials open the trip settings (review 13 Nov: "3 travellers, but who?").
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
  /** The whole trip: shows the trip's menu ⋯ (build 8). */
  detail?: TripDetail
}) {
  const demo = useDemo()
  // With the trip menu ⋯ next to them, one initial fewer, so the name keeps its room on a phone.
  const shown = travellers?.slice(0, detail ? SHOWN - 1 : SHOWN) ?? []
  const more = (travellers?.length ?? 0) - shown.length
  return (
    <header className="screen__top">
      <Link to={demo ? '/' : '/trips'} className="screen__back" aria-label={demo ? 'Welcome page' : 'All trips'}>
        ‹
      </Link>
      <div className="screen__heading">
        <h1 className="screen__title screen__title--trip">{title}</h1>
        {subtitle && <p className="screen__sub">{subtitle}</p>}
      </div>
      {/* The demo has no settings: the initials are just who's on it. */}
      {demo && travellers && (
        <span className="avatars" aria-label={travellers.map((t) => t.name).join(', ')}>
          {shown.map((t) => (
            <span
              key={t.id}
              className={`avatar${t.id === (demo.seeAs ?? demoDefault({ travellers })) ? ' avatar--me' : ''}`}
              aria-hidden="true"
            >
              {t.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {more > 0 && (
            <span className="avatar avatar--more" aria-hidden="true">
              +{more}
            </span>
          )}
        </span>
      )}
      {!demo && tripId && travellers && (
        <Link
          to={`/trips/${tripId}/settings`}
          className="avatars"
          aria-label={`Trip settings: ${travellers.map((t) => t.name).join(', ')}`}
        >
          {shown.map((t) => (
            <span
              key={t.id}
              className={`avatar${t.user_id && t.user_id === userId ? ' avatar--me' : ''}`}
              aria-hidden="true"
            >
              {t.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {more > 0 && (
            <span className="avatar avatar--more" aria-hidden="true">
              +{more}
            </span>
          )}
        </Link>
      )}
      {detail && <TripMenu detail={detail} />}
    </header>
  )
}
