import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AccountMenu } from '../components/AccountMenu'
import { FormMessage } from '../components/AuthForm'
import { Sketch, SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { explainAuthError } from '../lib/authForm'
import { listTrips, type TripSummary } from '../lib/trips'
import { formatDates, plural } from '../lib/tripText'

/** "Your trips": every trip you're on, newest first. Amounts come with the budget bar. */
export function Trips() {
  const [trips, setTrips] = useState<TripSummary[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    listTrips()
      .then((t) => active && setTrips(t))
      .catch((e) => active && setError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="page">
      <header className="app-header">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span className="app-header__name">Voyage Fare</span>
        <span className="app-header__account">
          <AccountMenu />
        </span>
      </header>
      <main className="trips">
        <div className="trips__head">
          <h1 className="trips__title">Your trips</h1>
          {trips && trips.length > 0 && (
            <Link to="/trips/new" className="button button--primary button--small">
              + New trip
            </Link>
          )}
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {!error && trips === undefined && <Loading />}
        {trips?.length === 0 && (
          <SketchBox tape="green" className="empty">
            <Sketch name="no-trips" width={240} />
            <h2 className="empty__title">No trips yet</h2>
            <p className="hand empty__note">the first page is the hardest</p>
            <Link to="/trips/new" className="button button--primary button--wide">
              + New trip
            </Link>
          </SketchBox>
        )}
        {trips && trips.length > 0 && (
          <ul className="tripcards">
            {trips.map((t, i) => (
              <li key={t.id}>
                <Link to={`/trips/${t.id}`} className="tripcard-link">
                  <SketchBox weight="light" className="tripcard" seed={41 + i}>
                    <b className="tripcard__name">{t.name}</b>
                    <span className="tripcard__meta">
                      {[
                        formatDates(t.start_date, t.end_date) ?? 'Planning · no dates yet',
                        t.places ? plural(t.places, 'place') : null,
                        t.nights ? plural(t.nights, 'night') : null,
                        plural(t.travellers, 'traveller'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </SketchBox>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
