import { useEffect, useState } from 'react'
import { hintSeen, markHintSeen } from '../../lib/hints'
import { getMyWelcome, type Traveller } from '../../lib/trips'

/**
 * A note slipped into the notebook for someone who joined by invitation (mockup invitations-v4,
 * step 3): handwritten, taped on, signed by whoever invited them. Shown once ("got it" puts it away).
 */
export function WelcomeNote({
  tripId,
  userId,
  createdBy,
  travellers,
}: {
  tripId: string
  userId?: string
  createdBy: string | null
  travellers: Traveller[]
}) {
  const key = `welcome:${tripId}:${userId}`
  const invited = Boolean(userId && userId !== createdBy)
  const [from, setFrom] = useState<string | null | undefined>(undefined)
  const [hidden, setHidden] = useState(() => hintSeen(key))

  useEffect(() => {
    if (!invited || hidden || !userId) return
    let active = true
    getMyWelcome(tripId, userId)
      .then((w) => {
        if (!active) return
        if (!w) return setFrom(undefined)
        setFrom(travellers.find((t) => t.user_id && t.user_id === w.invitedBy)?.name ?? null)
      })
      .catch(() => active && setFrom(undefined))
    return () => {
      active = false
    }
  }, [invited, hidden, tripId, userId, travellers])

  const me = travellers.find((t) => t.user_id && t.user_id === userId)
  if (!invited || hidden || from === undefined || !me) return null

  return (
    <aside className="welcome-note" aria-label="Welcome">
      <span className="tape tape--mustard" aria-hidden="true" />
      <p>
        Welcome aboard, {me.name}! Every amount here is <u>your</u> share. Add or change things like everyone
        {from ? ', I’ll see it.' : '.'}
      </p>
      {from && <p className="welcome-note__sign">— {from}</p>}
      <button
        type="button"
        className="welcome-note__got"
        onClick={() => {
          markHintSeen(key)
          setHidden(true)
        }}
      >
        got it ✓
      </button>
    </aside>
  )
}
