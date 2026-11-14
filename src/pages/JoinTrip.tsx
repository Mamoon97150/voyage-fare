import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { acceptInvitation, getInvitationPreview, type InvitationPreview } from '../lib/trips'
import { formatDates } from '../lib/tripText'

/**
 * The page an invitation link opens (mockup invitations-v4, step 2): whose trip it is and
 * who you are on it, then sign up or sign in, and you land on the trip as that traveller.
 * Nothing of the trip's money shows before you're in.
 */
export function JoinTrip() {
  const { token = '' } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<InvitationPreview | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const signedIn = Boolean(session)

  useEffect(() => {
    if (session === undefined) return
    let active = true
    getInvitationPreview(token)
      .then((p) => active && setPreview(p))
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [token, session])

  if (loadError) return <Shell><FormMessage tone="error">{loadError}</FormMessage></Shell>
  if (session === undefined || preview === undefined) return <Loading />
  if (preview === null) {
    return (
      <Shell>
        <Notice title="This link doesn’t work">
          Check you copied the whole link, or ask for a new one.
        </Notice>
      </Shell>
    )
  }
  // Opening the link again once in: just open the trip.
  if (preview.state === 'joined') return <Navigate to={`/trips/${preview.trip_id}`} replace />

  const who = preview.invited_by_name ?? 'Someone'
  if (preview.state !== 'open') {
    const why =
      preview.state === 'used'
        ? 'Someone already joined the trip with this link.'
        : 'This invitation was cancelled or has expired.'
    return (
      <Shell>
        <Notice title="This invitation doesn’t work any more">
          {why} Ask {who} for a new one.
        </Notice>
      </Shell>
    )
  }

  const next = encodeURIComponent(`/join/${token}`)
  const dates = formatDates(preview.start_date, preview.end_date)
  const where = preview.places.join(', ')

  async function join() {
    setBusy(true)
    setError(undefined)
    try {
      const tripId = await acceptInvitation(token)
      navigate(`/trips/${tripId}`, { replace: true })
    } catch (e) {
      setBusy(false)
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <Shell>
      <SketchBox tape="mustard" className="join__sheet" seed={41}>
        <p className="join__kicker">{who} invited you to</p>
        <h1 className="join__title">{preview.trip_name}</h1>
        {(dates || where) && <p className="join__meta">{[dates, where].filter(Boolean).join(' · ')}</p>}
        <div className="join__you">
          <span className="avatar" aria-hidden="true">
            {preview.traveller_name.slice(0, 1).toUpperCase()}
          </span>
          <p className="join__hand">on this trip, you are</p>
          <b>{preview.traveller_name}</b>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {signedIn ? (
          <button type="button" className="button button--primary button--wide" onClick={join} disabled={busy}>
            {busy ? 'Joining…' : `Join as ${preview.traveller_name}`}
          </button>
        ) : (
          <>
            <Link to={`/sign-up?next=${next}`} className="button button--primary button--wide">
              Create my account
            </Link>
            <Link to={`/sign-in?next=${next}`} className="button button--quiet button--wide">
              I already have an account
            </Link>
          </>
        )}
        <p className="join__small">
          Not {preview.traveller_name}? Ask {who} for your own link.
        </p>
      </SketchBox>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <Link to="/" className="auth__brand">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span>Voyage Fare</span>
      </Link>
      <main className="auth__page join">{children}</main>
    </div>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SketchBox tape="mustard" className="join__sheet" seed={42}>
      <h1 className="join__title join__title--small">{title}</h1>
      <p className="join__meta">{children}</p>
      <Link to="/" className="button button--quiet button--wide">
        Go to Voyage Fare
      </Link>
    </SketchBox>
  )
}
