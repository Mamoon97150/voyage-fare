import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { TripDetail } from '../../lib/trips'
import { tripSubtitle } from '../../lib/tripText'
import { TripNav } from '../TripNav'
import { TripTools, TripTopBar } from './TripTopBar'

/**
 * A trip's page on a computer (build 8½, mockup desktop-v6): the trip and its pages on the left,
 * the page in the middle, the trip's people and tools on top right. The trip page itself adds a
 * third column; Compare, Budget and Who paid use this one.
 */
export function TripWideFrame({
  detail,
  userId,
  solo,
  children,
}: {
  detail: TripDetail
  userId?: string
  solo: boolean
  children: ReactNode
}) {
  return (
    <div className="screen screen--trip trip-wide trip-wide--two">
      <aside className="trip-wide__side">
        <WideBrand />
        <TripTopBar title={detail.trip.name} subtitle={tripSubtitle(detail.trip, detail.travellers.length)} />
        <TripNav tripId={detail.trip.id} solo={solo} />
      </aside>
      <div className="trip-wide__main">
        <div className="trip-wide__bar">
          <TripTools tripId={detail.trip.id} travellers={detail.travellers} userId={userId} detail={detail} />
        </div>
        {children}
      </div>
    </div>
  )
}

/** Voyage Fare and its compass, on top of the left column (16 Nov): back to your trips. */
export function WideBrand() {
  return (
    <Link to="/trips" className="wide-brand" aria-label="Voyage Fare: your trips">
      <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
      <span>Voyage Fare</span>
    </Link>
  )
}
