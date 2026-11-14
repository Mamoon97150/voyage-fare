import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FormMessage } from '../AuthForm'
import { SketchBox } from '../Sketch'
import { explainAuthError } from '../../lib/authForm'
import { leaveTrip, deleteTrip, type TripDetail } from '../../lib/trips'

/** Only the person who created the trip can delete it; it asks once and says what goes. */
export function DeleteTrip({ detail, owner }: { detail: TripDetail; owner: boolean }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const name = detail.trip.name

  async function remove() {
    setBusy(true)
    setError(undefined)
    try {
      await deleteTrip(detail.trip.id)
      navigate('/trips', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <SketchBox weight="light" dashed className="form__sheet settings__danger" seed={74}>
      <h2 className="sheet-title">Delete the trip</h2>
      {!owner ? (
        <p className="field__hint">Only the person who created this trip can delete it.</p>
      ) : confirming ? (
        <div className="confirm-delete">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <p className="field__hint">
            Everything in {name} goes: places, items, tickets, for everyone on it. This can’t be undone.
          </p>
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </button>
            <button type="button" className="button button--danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : `Yes, delete ${name}`}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="link-button add-item__delete" onClick={() => setConfirming(true)}>
          Delete {name}
        </button>
      )}
    </SketchBox>
  )
}

/** For someone invited: leave the trip, and go back to being a name on the notebook. */
export function LeaveTrip({ detail }: { detail: TripDetail }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function leave() {
    setBusy(true)
    setError(undefined)
    try {
      await leaveTrip(detail.trip.id)
      navigate('/trips', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <SketchBox weight="light" dashed className="form__sheet settings__danger" seed={75}>
      <h2 className="sheet-title">Leave the trip</h2>
      {confirming ? (
        <div className="confirm-delete">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <p className="field__hint">
            You won’t see {detail.trip.name} any more. You stay a name on the trip: your share and what you paid don’t
            change. To come back, ask for a new link.
          </p>
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setConfirming(false)} disabled={busy}>
              Stay
            </button>
            <button type="button" className="button button--danger" onClick={leave} disabled={busy}>
              {busy ? 'Leaving…' : 'Yes, leave the trip'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="link-button add-item__delete" onClick={() => setConfirming(true)}>
          Leave {detail.trip.name}
        </button>
      )}
    </SketchBox>
  )
}
