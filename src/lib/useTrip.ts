import { useCallback, useEffect, useState } from 'react'
import { explainAuthError } from './authForm'
import { getTrip, type TripDetail } from './trips'

/**
 * Load a whole trip for a page, and reload it after a change (code review, 14 Nov: it was
 * written out on each page). detail: undefined while loading, null when the trip isn't there.
 */
export function useTrip(tripId: string) {
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string>()

  const load = useCallback(
    () =>
      getTrip(tripId)
        .then(setDetail)
        .catch((e) => setLoadError(explainAuthError(e).message)),
    [tripId],
  )

  useEffect(() => {
    let active = true
    getTrip(tripId)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [tripId])

  return { detail, loadError, load }
}
