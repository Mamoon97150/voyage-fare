import { Link } from 'react-router'
import type { Traveller } from '../../lib/trips'

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
}: {
  title: string
  /** By hand under the name: dates, where from, how many (Compare v4: the notebook's cover). */
  subtitle?: string
  tripId?: string
  travellers?: Traveller[]
  userId?: string
}) {
  const shown = travellers?.slice(0, SHOWN) ?? []
  const more = (travellers?.length ?? 0) - shown.length
  return (
    <header className="screen__top">
      <Link to="/trips" className="screen__back" aria-label="All trips">
        ‹
      </Link>
      <div className="screen__heading">
        <h1 className="screen__title screen__title--trip">{title}</h1>
        {subtitle && <p className="screen__sub">{subtitle}</p>}
      </div>
      {tripId && travellers && (
        <Link
          to={`/trips/${tripId}/settings`}
          className="avatars"
          aria-label={`Trip settings: ${travellers.map((t) => t.name).join(', ')}`}
        >
          {shown.map((t) => (
            <span key={t.id} className={`avatar${t.user_id && t.user_id === userId ? ' avatar--me' : ''}`} aria-hidden="true">
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
    </header>
  )
}
