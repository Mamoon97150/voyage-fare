import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AiProblem, Reading, WhereItGoes } from '../components/AiReading'
import { FormMessage } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { planBooking, priceNow } from '../lib/bookingEmail'
import { Loading } from '../lib/auth'
import { formatMoney } from '../lib/money'
import { canPaste } from '../lib/pwa'
import { fetchRate } from '../lib/rates'
import {
  applyBooking,
  foundIn,
  markTripMail,
  readBooking,
  type FoundBooking,
  type Item,
  type TripDetail,
} from '../lib/trips'
import { formatDates } from '../lib/tripText'
import { useSaving } from '../lib/useSaving'
import { useTrip } from '../lib/useTrip'

/*
 * "Paste a booking email" (build 8 step 5a, mockup ai-reading-v5 screens 3–4), /trips/:id/booking-email.
 * Paste the confirmation → Claude reads it → which line it goes on (Not this one / a new line) and
 * what changes → one tap marks it booked. Nothing is saved before that tap.
 * ?mail=<id> (step 5b): a forwarded email from "To review", already read on the server.
 */

const NEW = 'new'

export function BookingEmail() {
  const { tripId = '' } = useParams()
  const { detail, loadError } = useTrip(tripId)
  if (detail === undefined && !loadError) return <Loading />
  if (loadError || !detail || detail.trip.is_demo)
    return (
      <Shell back={`/trips/${tripId}`} title="Paste a booking email">
        <FormMessage tone="error">{loadError ?? 'This trip isn’t here.'}</FormMessage>
      </Shell>
    )
  return <BookingEmailFor detail={detail} />
}

function Shell({
  back,
  title,
  sub,
  children,
}: {
  back: string
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="screen import">
      <header className="screen__top">
        <Link to={back} className="screen__back" aria-label="Back">
          ‹
        </Link>
        <div className="screen__heading">
          <h1 className="screen__title">{title}</h1>
          {sub && <p className="screen__sub">{sub}</p>}
        </div>
      </header>
      <div className="screen__body">{children}</div>
    </div>
  )
}

function BookingEmailFor({ detail }: { detail: TripDetail }) {
  const back = `/trips/${detail.trip.id}`
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mail = detail.mails?.find((m) => m.id === params.get('mail'))
  const forwarded = mail ? foundIn(mail) : null
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [found, setFound] = useState<FoundBooking | null>(null)

  if (forwarded && mail)
    return <Found detail={detail} found={forwarded} mailId={mail.id} onBack={() => navigate(back)} />
  if (params.get('mail'))
    return (
      <Shell back={back} title="From the email">
        <FormMessage tone="info">This email was already checked.</FormMessage>
      </Shell>
    )
  if (found) return <Found detail={detail} found={found} onBack={() => setFound(null)} />

  async function read() {
    setReading(true)
    setError(null)
    try {
      setFound(await readBooking(text))
    } catch (e) {
      setError(e)
    } finally {
      setReading(false)
    }
  }

  return (
    <Shell back={back} title="Paste a booking email" sub={detail.trip.name}>
      {error !== null && <AiProblem error={error} />}
      <SketchBox tape="mustard" className="import__sheet" seed={84}>
        <label htmlFor="booking-email">
          <b>The confirmation email</b>
        </label>
        <p className="ai-offer__lead">
          From the hotel, the airline, Booking… Open it, select all, copy, paste here. It finds the line and marks it
          booked.
        </p>
        <div className="import__paste">
          <textarea
            id="booking-email"
            className="field__input import__answer"
            placeholder="Paste the email…"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
          />
          {canPaste() && (
            <button
              type="button"
              className="paste-button import__paste-button"
              onClick={() =>
                void navigator.clipboard
                  .readText()
                  .then((t) => setText(t))
                  .catch(() => {})
              }
            >
              <span aria-hidden="true">📋</span> Paste
            </button>
          )}
        </div>
        <WhereItGoes short />
        {reading ? (
          <Reading />
        ) : (
          <div className="add-item__actions">
            <Link to={back} className="button button--quiet">
              Cancel
            </Link>
            <button
              type="button"
              className="button button--primary"
              disabled={!text.trim()}
              onClick={() => void read()}
            >
              Read it
            </button>
          </div>
        )}
      </SketchBox>
      <p className="hand import__hint">nothing is saved before you check it</p>
    </Shell>
  )
}

const placeOf = (detail: TripDetail, item: Item) => detail.places.find((p) => p.id === item.place_id)?.name ?? null

/** Which option gets booked: the chosen one, else the one named in the email, else a new one. */
function optionNote(detail: TripDetail, item: Item, name: string | null): string {
  const options = detail.options.filter((o) => o.item_id === item.id)
  const chosen = options.find((o) => o.is_chosen)
  if (chosen) return options.length > 1 ? `${chosen.name} (chosen)` : item.status
  const same = name ? options.find((o) => o.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined
  if (same) return `books ${same.name}`
  return options.length ? `adds ${name ?? 'it'} as an option` : item.status
}

function Found({
  detail,
  found,
  mailId,
  onBack,
}: {
  detail: TripDetail
  found: FoundBooking
  /** From "To review": marked done once saved, or dropped. */
  mailId?: string
  onBack: () => void
}) {
  const navigate = useNavigate()
  const plan = useMemo(() => planBooking(detail, found), [detail, found])
  const [target, setTarget] = useState<string>(plan.match?.id ?? NEW)
  const [picking, setPicking] = useState(false)
  const item = detail.items.find((i) => i.id === target) ?? null
  const trip = detail.trip.currency
  const currency =
    found.currency?.toUpperCase() && /^[A-Z]{3}$/.test(found.currency.toUpperCase())
      ? found.currency.toUpperCase()
      : trip
  const [rate, setRate] = useState<number | null | undefined>(currency === trip ? 1 : undefined)
  const [attempt, setAttempt] = useState(0)
  const { busy, run } = useSaving()
  const [saveError, setSaveError] = useState<string>()

  useEffect(() => {
    if (currency === trip || found.price === null) return
    let active = true
    void fetchRate(currency, trip).then((r) => active && setRate(r))
    return () => {
      active = false
    }
  }, [currency, trip, found.price, attempt])

  if (!found.is_booking)
    return (
      <Shell back={`/trips/${detail.trip.id}`} title="From the email">
        <FormMessage tone="error">
          This doesn’t look like a booking confirmation. Paste the email that confirms the booking (with its number).
        </FormMessage>
        <button type="button" className="button button--quiet button--wide" onClick={onBack}>
          Back to the text
        </button>
      </Shell>
    )

  const before = item ? priceNow(detail, item) : null
  const paid = item?.status === 'paid'
  const link = found.link && /^https?:\/\//i.test(found.link) ? found.link : null
  const dates = found.start_date ? formatDates(found.start_date, found.end_date ?? found.start_date) : null
  const needsRate = found.price !== null && currency !== trip
  const notes = [...plan.notes]
  if (
    item &&
    before &&
    found.price !== null &&
    (before.currency !== currency || Math.abs(before.amount - found.price) >= 0.01)
  )
    notes.push(
      `The price was ${formatMoney(before.amount, before.currency)}${item.status === 'chosen' || !item.actual_amount ? ' (estimated)' : ''}. The email says ${formatMoney(found.price, currency)}: it takes the email’s.`,
    )
  if (paid) notes.push('This line is already paid: it stays paid. Only the confirmation number and link are added.')

  async function save() {
    setSaveError(undefined)
    await run(async () => {
      await applyBooking({
        tripId: detail.trip.id,
        itemId: item?.id ?? null,
        kind: plan.kind,
        name: plan.name,
        placeId: item ? null : plan.placeId,
        dayNumber: item ? null : plan.dayNumber,
        optionName: plan.optionName,
        amount: paid ? null : found.price,
        currency: paid ? null : currency,
        rate: paid || found.price === null ? null : (rate ?? null),
        ref: found.confirmation,
        link,
      })
      if (mailId) await markTripMail(mailId, 'done')
      navigate(`/trips/${detail.trip.id}`, {
        state: { note: `From the email: ${item?.name ?? plan.name} is ${paid ? 'paid' : 'booked'}.` },
      })
    }, setSaveError)
  }

  return (
    <div className="screen import">
      <header className="screen__top">
        <button type="button" className="screen__back" aria-label="Back to the text" onClick={onBack}>
          ‹
        </button>
        <div className="screen__heading">
          <h1 className="screen__title">From the email</h1>
          <p className="screen__sub">check, then save</p>
        </div>
      </header>
      <div className="screen__body">
        {saveError && <FormMessage tone="error">{saveError}</FormMessage>}
        <SketchBox tape="mustard" className="import__sheet" seed={85}>
          <p className="import__kicker">{item ? 'It goes on this line' : 'Not in the trip yet'}</p>
          <div className="booking-match">
            <span>
              <b>{item?.name ?? plan.name}</b>
              <small>
                {item
                  ? [placeOf(detail, item), optionNote(detail, item, plan.optionName)].filter(Boolean).join(' · ')
                  : [detail.places.find((p) => p.id === plan.placeId)?.name ?? 'the whole trip', 'a new line'].join(
                      ' · ',
                    )}
              </small>
            </span>
            <button type="button" className="link-button" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
              {item ? 'Not this one' : 'Pick a line'}
            </button>
          </div>
          {picking && (
            <div className="field">
              <label className="field__label" htmlFor="booking-line">
                Which line?
              </label>
              <select
                id="booking-line"
                className="field__input"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setPicking(false)
                }}
              >
                <option value={NEW}>A new line: {plan.name}</option>
                {plan.choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {placeOf(detail, c) ? ` · ${placeOf(detail, c)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <dl className="booking-found">
            <div>
              <dt>Status</dt>
              <dd className="booking-found__status">{paid ? 'Paid' : 'Booked'}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd className="num">
                {found.price === null ? (
                  <span className="booking-found__none">not in the email</span>
                ) : (
                  <>
                    {before && notes.some((n) => n.startsWith('The price was')) && !paid && (
                      <s className="booking-found__was">{formatMoney(before.amount, before.currency)}</s>
                    )}
                    {formatMoney(found.price, currency)}
                  </>
                )}
              </dd>
            </div>
            {dates && (
              <div>
                <dt>Dates</dt>
                <dd>{dates}</dd>
              </div>
            )}
            <div>
              <dt>Confirmation</dt>
              <dd>{found.confirmation ?? <span className="booking-found__none">not in the email</span>}</dd>
            </div>
            {link && (
              <div>
                <dt>Booking link</dt>
                <dd className="booking-found__link">{link.replace(/^https?:\/\//, '')}</dd>
              </div>
            )}
          </dl>
          {needsRate && rate === null && (
            <p className="form-message form-message--error" role="alert">
              We couldn’t get today’s rate for {currency}. Check your connection, then{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setRate(undefined)
                  setAttempt((n) => n + 1)
                }}
              >
                try again
              </button>
              .
            </p>
          )}
          {notes.map((n) => (
            <p key={n} className="form-message form-message--info">
              {n}
            </p>
          ))}
          <div className="add-item__actions">
            {mailId ? (
              <button
                type="button"
                className="button button--quiet"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await markTripMail(mailId, 'dropped')
                    navigate(`/trips/${detail.trip.id}`)
                  }, setSaveError)
                }
              >
                Not for this trip
              </button>
            ) : (
              <button type="button" className="button button--quiet" onClick={onBack}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="button button--primary"
              disabled={busy || (needsRate && !rate)}
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : item ? (paid ? 'Add the details' : 'Mark it booked') : 'Add it, booked'}
            </button>
          </div>
        </SketchBox>
      </div>
    </div>
  )
}
