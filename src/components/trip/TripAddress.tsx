import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { copyText } from '../../lib/clipboard'
import { foundIn, markTripMail, tripMailAddress, type TripDetail, type TripMail } from '../../lib/trips'
import { formatMoney } from '../../lib/money'
import { useSaving } from '../../lib/useSaving'
import { FormMessage } from '../AuthForm'
import { SketchBox } from '../Sketch'

/*
 * The trip's email address (build 8 step 5b, mockup ai-reading-v5 screens 7–8): in Trip settings,
 * the address to forward bookings to; on the trip, "To review" with what was forwarded.
 */

export function TripAddress({ detail }: { detail: TripDetail }) {
  const [address, setAddress] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  const names = detail.travellers.filter((t) => t.user_id).map((t) => t.name)

  useEffect(() => {
    let active = true
    tripMailAddress(detail.trip.id)
      .then((a) => {
        if (!active) return
        setAddress(a)
        if (window.location.hash === '#trip-address')
          // after the page has settled (the sketched boxes draw themselves first)
          setTimeout(() => document.getElementById('trip-address')?.scrollIntoView?.({ block: 'start' }), 300)
      })
      .catch(() => active && setError('The address isn’t available right now.'))
    return () => {
      active = false
    }
  }, [detail.trip.id])

  return (
    <SketchBox weight="light" className="form__sheet trip-address" seed={89}>
      <section id="trip-address" aria-label="The trip’s email address">
        <p className="import__kicker">The trip’s email address</p>
        <h2 className="ai-offer__title">Forward your bookings here</h2>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {address && (
          <div className="booking-match trip-address__box">
            <b className="trip-address__address">{address}</b>
            <button
              type="button"
              className="button button--quiet trip-address__copy"
              onClick={() => void copyText(address).then((ok) => setCopied(ok))}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
        <ol className="trip-address__steps">
          <li>Open the confirmation email (hotel, airline, Booking…).</li>
          <li>
            <b>Forward</b> it to this address.
          </li>
          <li>
            It shows up in <b>To review</b> at the top of the trip.
          </li>
        </ol>
        <p className="ai-who">
          Only emails <b>from the travellers’ own addresses</b>
          {names.length ? ` (${names.join(', ')})` : ''}, the ones they sign in with, are read. Others are ignored. Each
          one is read by <b>Claude</b> (Anthropic); we keep what it found, not the email.
        </p>
        {renewing ? (
          <div className="trip-address__renew">
            <p className="ai-offer__lead">The old address stops working. Forwarding to it won’t reach the trip.</p>
            <div className="add-item__actions">
              <button type="button" className="button button--quiet" onClick={() => setRenewing(false)}>
                Keep this one
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setAddress(await tripMailAddress(detail.trip.id, true))
                    setCopied(false)
                    setRenewing(false)
                  }, setError)
                }
              >
                Get a new address
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" className="button button--quiet button--wide" onClick={() => setRenewing(true)}>
              Get a new address
            </button>
            <p className="hand trip-address__hint">if it leaked: the old one stops working</p>
          </>
        )}
      </section>
    </SketchBox>
  )
}

const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

/** One line about what the AI found in a forwarded email. */
function summary(mail: TripMail): string {
  const f = foundIn(mail)
  if (mail.problem === 'not_booking') return 'not a booking confirmation'
  if (mail.problem === 'paused') return 'not read yet: AI reading is paused'
  if (mail.problem === 'too_long') return 'too long to read'
  if (!f || mail.problem) return 'couldn’t be read'
  return [
    'Booked',
    f.price !== null && f.currency ? formatMoney(f.price, f.currency) : null,
    f.confirmation ? `#${f.confirmation}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "To review", at the top of the trip: forwarded emails nobody has checked yet. */
export function ToReview({ detail, onChanged }: { detail: TripDetail; onChanged: () => void }) {
  const { run } = useSaving()
  const [error, setError] = useState<string>()
  const mails = detail.mails ?? []
  if (!mails.length) return null
  return (
    <div className="screen__body screen__body--note">
      <SketchBox tape="mustard" className="to-review" seed={90}>
        <section aria-label="To review">
          <p className="import__kicker">To review · {mails.length}</p>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <ul className="to-review__list">
            {mails.map((m) => {
              const f = foundIn(m)
              const readable = f && !m.problem
              return (
                <li key={m.id} className="booking-match">
                  <span>
                    <b>{readable ? (f.name ?? f.provider ?? m.subject) : (m.subject ?? 'A forwarded email')}</b>
                    <small>
                      forwarded by {m.forwarder ?? 'a traveller'} · {when.format(new Date(m.received_at))} ·{' '}
                      {summary(m)}
                    </small>
                  </span>
                  <span className="to-review__acts">
                    {readable && (
                      <Link to={`/trips/${detail.trip.id}/booking-email?mail=${m.id}`} className="link-button">
                        Check
                      </Link>
                    )}
                    <button
                      type="button"
                      className="link-button to-review__drop"
                      onClick={() =>
                        void run(async () => {
                          await markTripMail(m.id, 'dropped')
                          onChanged()
                        }, setError)
                      }
                    >
                      {readable ? 'Not for this trip' : 'Remove'}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="hand">nothing goes in until someone checks it</p>
        </section>
      </SketchBox>
    </div>
  )
}
