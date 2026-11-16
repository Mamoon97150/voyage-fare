import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { getTrip, isTripOwner, type TripDetail } from '../lib/trips'
import { DeleteTrip, LeaveTrip } from '../components/settings/DangerZone'
import { MainCurrency } from '../components/settings/MainCurrency'
import { TripForm } from '../components/settings/TripForm'
import { Travellers } from '../components/settings/Travellers'
import { TripAddress } from '../components/trip/TripAddress'
import { NewTripFromThis } from '../components/trip/TripMenu'
import { SketchBox } from '../components/Sketch'

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

  // From the trip's initials (#travellers): straight to who's coming, once the page has settled.
  const loaded = Boolean(detail)
  useEffect(() => {
    if (!loaded || window.location.hash !== '#travellers') return
    const t = setTimeout(() => document.getElementById('travellers')?.scrollIntoView?.({ block: 'start' }), 300)
    return () => clearTimeout(t)
  }, [loaded])

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
      {!detail.trip.is_demo && <TripAddress detail={detail} />}
      {!detail.trip.is_demo && <StartAgain detail={detail} />}
      {owner ? <DeleteTrip detail={detail} owner={owner} /> : <LeaveTrip detail={detail} />}
    </Screen>
  )
}

/** "Start a new trip from this one" (moved from the trip's ☰ menu, build 8½). */
function StartAgain({ detail }: { detail: TripDetail }) {
  // From "Your trips" → "From a trip you had" (?again=1): the sheet opens straight away.
  const [params] = useSearchParams()
  const [open, setOpen] = useState(params.get('again') === '1')
  return (
    <SketchBox weight="light" className="form__sheet start-again" seed={77}>
      <h2 className="sheet-title">Start a new trip from this one</h2>
      <p className="field__hint">Same places, lines and ideas, with fresh dates and payments. Nothing changes here.</p>
      <button type="button" className="button button--quiet" onClick={() => setOpen(true)}>
        ⧉ Start a new trip from this one
      </button>
      {open && <NewTripFromThis detail={detail} onClose={() => setOpen(false)} />}
    </SketchBox>
  )
}

function Screen({ tripId, name, children }: { tripId: string; name?: string; children: React.ReactNode }) {
  return (
    <div className="screen settings-page">
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
