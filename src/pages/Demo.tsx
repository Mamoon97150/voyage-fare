import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Loading } from '../lib/auth'
import { explainAuthError } from '../lib/authForm'
import { DemoContext } from '../lib/demo'
import { getDemoTripId } from '../lib/trips'
import { Budget } from './Budget'
import { Compare } from './Compare'
import { RoutePage } from './RoutePage'
import { TripPage } from './TripPage'
import { WhoPaid } from './WhoPaid'

/**
 * The demo trip (build 7, step 3, mockup demo-v5): a real trip, the names changed, read-only and
 * open without signing up. The same pages as a trip, under /demo; "See it as" is shared by them.
 */
export function Demo() {
  const [tripId, setTripId] = useState<string | null>()
  const [error, setError] = useState<string>()
  const [seeAs, setSeeAs] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getDemoTripId()
      .then((id) => active && setTripId(id))
      .catch((e) => active && setError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => (tripId ? { tripId, seeAs, setSeeAs, base: '/demo' } : null), [tripId, seeAs])

  if (error || tripId === null)
    return (
      <div className="page">
        <FormMessage tone="error">{error ?? 'The demo isn’t open right now.'}</FormMessage>
        <Link to="/">Back to the welcome page</Link>
      </div>
    )
  if (!value) return <Loading />
  return (
    <DemoContext.Provider value={value}>
      <Routes>
        <Route index element={<TripPage />} />
        <Route path="compare" element={<Compare />} />
        <Route path="budget" element={<Budget />} />
        <Route path="who-paid" element={<WhoPaid />} />
        <Route path="route" element={<RoutePage />} />
      </Routes>
    </DemoContext.Provider>
  )
}
