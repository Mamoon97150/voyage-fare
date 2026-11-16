import { useCallback, useEffect, useState } from 'react'
import { explainAuthError } from './authForm'
import { loadTrip, useDemo } from './demo'
import type { TripDetail } from './trips'

/**
 * Load a whole trip for a page, and reload it after a change (code review, 14 Nov: it was
 * written out on each page). detail: undefined while loading, null when the trip isn't there.
 */
export function useTrip(tripId: string) {
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string>()
  const demo = useDemo()

  const load = useCallback(
    () =>
      loadTrip(demo, tripId)
        .then(setDetail)
        .catch((e) => setLoadError(explainAuthError(e).message)),
    [demo, tripId],
  )

  useEffect(() => {
    let active = true
    loadTrip(demo, tripId)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [demo, tripId])

  return { detail, loadError, load }
}
