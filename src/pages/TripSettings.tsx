import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { getTrip, isTripOwner, type TripDetail } from '../lib/trips'
import { DeleteTrip, LeaveTrip } from '../components/settings/DangerZone'
import { MainCurrency } from '../components/settings/MainCurrency'
import { TripForm } from '../components/settings/TripForm'
import { Travellers } from '../components/settings/Travellers'

/**
 * Trip settings (mockup 8): the trip, its budget, its travellers, and deleting it.
 * The main currency changes until the first payment (build 3). Invitations (build 6): each traveller
 * says where they stand, and "Invite" gives a link tied to that name.
 */
export function TripSettings() {
  const { tripId = '' } = useParams()
  const { session } = useAuth()
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [owner, setOwner] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([getTrip(tripId), session ? isTripOwner(tripId, session.user.id) : false])
      setDetail(d)
      setOwner(o)
    } catch (e) {
      setLoadError(explainAuthError(e as { message?: string }).message)
    }
  }, [tripId, session])

  useEffect(() => {
    let active = true
    Promise.all([getTrip(tripId), session ? isTripOwner(tripId, session.user.id) : false])
      .then(([d, o]) => {
        if (!active) return
        setDetail(d)
        setOwner(o)
      })
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [tripId, session])

  if (loadError) {
    return (
      <Screen tripId={tripId}>
        <FormMessage tone="error">{loadError}</FormMessage>
      </Screen>
    )
  }
  if (detail === undefined) return <Loading />
  if (detail === null) {
    return (
      <Screen tripId={tripId}>
        <p className="screen__intro">
          This trip isn’t here. <Link to="/trips">Back to your trips</Link>
        </p>
      </Screen>
    )
  }

  const reload = () => void load()

  return (
    <Screen tripId={tripId} name={detail.trip.name}>
      {/* Keyed on the currency: a change converts the target, so the form starts again from it. */}
      <TripForm key={detail.trip.currency} detail={detail} onSaved={reload} />
      <MainCurrency detail={detail} onChanged={reload} />
      <Travellers detail={detail} userId={session?.user.id} owner={owner} onChanged={reload} />
      {owner ? <DeleteTrip detail={detail} owner={owner} /> : <LeaveTrip detail={detail} />}
    </Screen>
  )
}

function Screen({ tripId, name, children }: { tripId: string; name?: string; children: React.ReactNode }) {
  return (
    <div className="screen">
      <header className="screen__top">
        <Link to={`/trips/${tripId}`} className="round-button" aria-label="Back to the trip">
          ‹
        </Link>
        <h1 className="screen__title">Trip settings</h1>
      </header>
      {name && <p className="screen__meta">{name}</p>}
      <div className="screen__body">{children}</div>
    </div>
  )
}
