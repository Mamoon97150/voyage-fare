import { useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../lib/authContext'
import { deviceOf, pageOf } from '../lib/feedback'
import { sendFeedback, type FeedbackKind } from '../lib/trips'
import { useSaving } from '../lib/useSaving'
import { FormMessage } from './AuthForm'
import { SketchBox } from './Sketch'

/*
 * "Send feedback" (build 8, mockup feedback-admin-v5): a sheet instead of the email app. What
 * kind, the message, what goes with it (the page, the phone), and whether we may write back.
 */

const KINDS: [FeedbackKind, string][] = [
  ['broken', 'Something’s broken'],
  ['unclear', 'Something’s unclear'],
  ['idea', 'An idea'],
  ['love', 'I love it'],
]

/** The trip's name on a trip page, read from its title (the menu doesn't know the trip). */
const tripTitle = () => document.querySelector('.screen__title--trip')?.textContent?.trim() || null

export function FeedbackSheet({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { session } = useAuth()
  const location = useLocation()
  const [kind, setKind] = useState<FeedbackKind | null>(null)
  const [message, setMessage] = useState('')
  const [canReply, setCanReply] = useState(true)
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  const page = pageOf(location.pathname, tripTitle())
  const device = deviceOf(navigator.userAgent)
  const email = session?.user.email

  async function send() {
    if (!kind) return setError('What kind of message is it?')
    if (!message.trim()) return setError('Write a few words first.')
    setError(undefined)
    await run(async () => {
      await sendFeedback({ kind, message, page, device, canReply })
      onSent()
    }, setError)
  }

  return (
    <>
      <div className="trip-menu__scrim" aria-hidden="true" onClick={onClose} />
      <div className="copy-ai" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <SketchBox tape="mustard" className="copy-ai__sheet" seed={81}>
          <button type="button" className="copy-ai__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          <h2 id="feedback-title" className="copy-ai__title">
            Send feedback
          </h2>
          <p className="copy-ai__lead">Something broken, unclear, or an idea? Djamina reads every message.</p>
          <div className="chips" role="radiogroup" aria-label="What kind">
            {KINDS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                className="chip"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="visually-hidden" htmlFor="feedback-message">
            Your message
          </label>
          <textarea
            id="feedback-message"
            className="field__input feedback__message"
            placeholder="What happened, or what would help?"
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="feedback__attached">
            Sent with it: the page you’re on (<b>{page}</b>), your phone and browser ({device}). Nothing else.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={canReply}
            className="copy-ai__switch"
            onClick={() => setCanReply(!canReply)}
          >
            <span>
              You can write back to me
              <small>{email ? `at ${email}` : 'by email'}</small>
            </span>
            <span className={`switch${canReply ? ' switch--on' : ''}`} aria-hidden="true" />
          </button>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <button
            type="button"
            className="button button--primary button--wide feedback__send"
            disabled={busy}
            onClick={() => void send()}
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </SketchBox>
      </div>
    </>
  )
}
