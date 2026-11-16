import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../lib/authContext'
import { isSolo } from '../lib/tripView'
import { useTrip } from '../lib/useTrip'
import { useWide } from '../lib/useWide'
import { HomeNav } from './HomeNav'
import { TripWideFrame } from './trip/TripWideFrame'

/*
 * The other pages on a computer (build 8½, 16 Nov): each page stays as it is; around it, the menu
 * on the left. A trip's own pages (settings, import, a booking email, the route) get the trip's
 * frame (its pages, its people and tools); the others (account, admin, a new trip) the main menu.
 * On a phone, nothing changes.
 */

export function WideHome({ children, size = 'narrow' }: { children: ReactNode; size?: 'narrow' | 'wide' }) {
  const wide = useWide()
  if (!wide) return <>{children}</>
  return (
    <div className={`page page--nav wide-home wide-home--${size}`}>
      {children}
      <HomeNav />
    </div>
  )
}

export function WideTrip({ children }: { children: ReactNode }) {
  const wide = useWide()
  const { tripId = '' } = useParams()
  if (!wide || !tripId) return <>{children}</>
  return <WideTripLoaded tripId={tripId}>{children}</WideTripLoaded>
}

function WideTripLoaded({ tripId, children }: { tripId: string; children: ReactNode }) {
  const { detail } = useTrip(tripId)
  const { session } = useAuth()
  // While it loads, or a trip that isn't there: the page alone says so.
  if (!detail) return <>{children}</>
  return (
    <TripWideFrame detail={detail} userId={session?.user.id} solo={isSolo(detail)}>
      <div className="wide-page">{children}</div>
    </TripWideFrame>
  )
}
