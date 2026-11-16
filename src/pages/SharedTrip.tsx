import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Loading } from '../lib/auth'
import { explainAuthError } from '../lib/authForm'
import { DemoContext } from '../lib/demo'
import { sharedTrip, type TripDetail } from '../lib/trips'
import { Budget } from './Budget'
import { Compare } from './Compare'
import { RoutePage } from './RoutePage'
import { TripPage } from './TripPage'

/*
 * A trip seen through its read-only share link (build 8 step 6, mockup share-link-v5), /s/<token>.
 * The same pages as the demo, read-only, without an account: Trip, Route, Compare, and Budget when
 * the link shows prices. Never Who paid. A link turned off, or one that never existed: one page.
 */
export function SharedTrip() {
  const { token = '' } = useParams()
  const [detail, setDetail] = useState<TripDetail | null>()
  const [error, setError] = useState<string>()
  const [seeAs, setSeeAs] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    sharedTrip(token)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [token])

  const value = useMemo(
    () =>
      detail
        ? {
            tripId: detail.trip.id,
            seeAs,
            setSeeAs,
            base: `/s/${token}`,
            share: { token, showPrices: detail.shared?.showPrices ?? true },
          }
        : null,
    [detail, seeAs, token],
  )

  if (error)
    return (
      <div className="page">
        <FormMessage tone="error">{error}</FormMessage>
      </div>
    )
  if (detail === null) return <LinkOff />
  if (!value) return <Loading />
  return (
    <DemoContext.Provider value={value}>
      <Routes>
        <Route index element={<TripPage />} />
        <Route path="compare" element={<Compare />} />
        {value.share.showPrices && <Route path="budget" element={<Budget />} />}
        <Route path="route" element={<RoutePage />} />
        <Route path="*" element={<TripPage />} />
      </Routes>
    </DemoContext.Provider>
  )
}

/** Turned off, or never existed: the same page, nothing about any trip. */
function LinkOff() {
  return (
    <div className="screen link-off">
      <div className="screen__body link-off__body">
        <p className="hand">this page is closed</p>
        <h1 className="link-off__title">This link doesn’t work any more</h1>
        <p className="link-off__lead">The person who shared it turned it off. Ask them for a new one.</p>
        <Link to="/" className="button button--quiet">
          What’s Voyage Fare?
        </Link>
      </div>
    </div>
  )
}
