// The public demo trip (build 7, step 3, mockup demo-v5): a read-only copy of a real trip, opened
// from the welcome page without signing up. The trip itself says it's the demo (trips.is_demo).
import { createContext, useContext } from 'react'
import { useParams } from 'react-router'
import { getTrip, sharedTrip, type Trip, type TripDetail } from './trips'
import { viewerOf } from './tripView'

/** Where a trip's pages live: /demo for the demo, /trips/<id> otherwise. */
export const tripBase = (trip: Pick<Trip, 'id' | 'is_demo'>) => (trip.is_demo ? '/demo' : `/trips/${trip.id}`)

/** The demo can't be changed: forms, add rows and edit buttons are hidden. */
export const isReadOnly = (detail: Pick<TripDetail, 'trip'>) => detail.trip.is_demo

type Demo = {
  tripId: string
  /** Where its pages live: /demo, or /s/<token> for a read-only share link (build 8 step 6). */
  base: string
  /** A share link: the trip is loaded through it (names and prices as the link says). */
  share?: { token: string; showPrices: boolean }
  /** "See it as …": whose share the amounts are (a traveller id). */
  seeAs: string | null
  setSeeAs: (id: string) => void
}

export const DemoContext = createContext<Demo | null>(null)

export const useDemo = () => useContext(DemoContext)

/** The trip a page shows: the demo's inside /demo, the one in the address otherwise. */
export function useTripId(): string {
  const demo = useDemo()
  const { tripId = '' } = useParams()
  return demo?.tripId ?? tripId
}

/** Who "you" are: the signed-in person's traveller, or in the demo the one picked in "See it as". */
export function useViewer(detail: TripDetail | null | undefined, userId: string | undefined): string | null {
  const demo = useDemo()
  if (!detail) return null
  if (demo && detail.trip.is_demo) return demo.seeAs ?? demoDefault(detail)
  return viewerOf(detail, userId)
}

/** In the demo, you start as the first traveller (the one who planned it). */
export const demoDefault = (detail: Pick<TripDetail, 'travellers'>) =>
  [...detail.travellers].sort((a, b) => a.position - b.position)[0]?.id ?? null

/** Load the trip a page shows: through the share link when it's one, the usual way otherwise. */
export const loadTrip = (demo: Demo | null, tripId: string) =>
  demo?.share ? sharedTrip(demo.share.token) : getTrip(tripId)
