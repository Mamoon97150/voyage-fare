import { Link } from 'react-router'
import type { Traveller } from '../../lib/trips'

const SHOWN = 4

/**
 * The top of a trip: back to all trips, the trip's name, and who's on it (mockup 1).
 * The initials open the trip settings (review 13 Nov: "3 travellers, but who?").
 */
export function TripTopBar({
  title,
  tripId,
  travellers,
  userId,
}: {
  title: string
  tripId?: string
  travellers?: Traveller[]
  userId?: string
}) {
  const shown = travellers?.slice(0, SHOWN) ?? []
  const more = (travellers?.length ?? 0) - shown.length
  return (
    <header className="screen__top">
      <Link to="/trips" className="round-button" aria-label="All trips">
        ‹
      </Link>
      <h1 className="screen__title screen__title--trip">{title}</h1>
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
