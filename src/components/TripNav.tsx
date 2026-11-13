import { NavLink } from 'react-router'

/**
 * The bar at the bottom of a trip (mockup 1): Trip · Compare · Budget · Who paid.
 * A solo trip has nobody to settle up with, so no "Who paid" (13 Nov rule).
 */
export function TripNav({ tripId, solo }: { tripId: string; solo: boolean }) {
  const base = `/trips/${tripId}`
  return (
    <nav className="trip-nav" aria-label="Trip">
      <NavLink to={base} end>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
        </svg>
        Trip
      </NavLink>
      <NavLink to={`${base}/compare`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="6" height="14" rx="1.5" />
          <rect x="14" y="5" width="6" height="14" rx="1.5" />
        </svg>
        Compare
      </NavLink>
      <NavLink to={`${base}/budget`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v8l6 5" />
        </svg>
        Budget
      </NavLink>
      {!solo && (
        <NavLink to={`${base}/who-paid`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h14l-3-3M20 15H6l3 3" />
          </svg>
          Who paid
        </NavLink>
      )}
    </nav>
  )
}
