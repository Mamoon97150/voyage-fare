import { NavLink } from 'react-router'
import { useAdmin } from '../lib/useAdmin'

/**
 * The bar at the bottom of "Your trips" (build 8½, mockup menus-home-v6): Your trips · Someday · Me,
 * like the one inside a trip. A mustard dot on Me when an admin has new messages.
 */
export function HomeNav() {
  const admin = useAdmin()
  return (
    <nav className="trip-nav home-nav" aria-label="Main">
      {/* On a computer, the menu is a column: Voyage Fare on top (16 Nov). */}
      <span className="home-nav__brand" aria-hidden="true">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        Voyage Fare
      </span>
      <NavLink to="/trips" end>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="1.5" />
          <path d="M9 4v16M12 9h4M12 12h4" />
        </svg>
        Your trips
      </NavLink>
      <NavLink to="/someday">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l2.2 5.6L20 9.3l-4.4 3.8 1.4 5.9L12 16l-5 3 1.4-5.9L4 9.3l5.8-.7z" />
        </svg>
        Someday
      </NavLink>
      <NavLink to="/me" className="home-nav__me">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="9" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
        Me
        {admin && admin.fresh > 0 && <i className="home-nav__dot" aria-label={`${admin.fresh} new for Admin`} />}
      </NavLink>
    </nav>
  )
}
