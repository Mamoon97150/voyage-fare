import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AI_QUESTIONS, aiTextSize, tripForAi } from '../../lib/aiText'
import { copyText } from '../../lib/clipboard'
import { useAuth } from '../../lib/authContext'
import { useDemo, useViewer } from '../../lib/demo'
import {
  duplicateTrip,
  getMoney,
  setShare,
  shareLink,
  shareUrl,
  stopShare,
  type ShareLink,
  type TripDetail,
  type TripMoney,
} from '../../lib/trips'
import { useSaving } from '../../lib/useSaving'
import { plural } from '../../lib/tripText'
import { SketchBox } from '../Sketch'

/*
 * The trip's menu ⋯ (build 8 step 1, mockup copy-for-ai-v5, 15 Nov): "Copy the trip for my AI" now;
 * Import from my AI, Duplicate and Share a link join it as build 8 goes on. Trip settings too.
 */

export function TripMenu({ detail }: { detail: TripDetail }) {
  const demo = useDemo()
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [again, setAgain] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  // Through a read-only share link, there's nothing to do with the trip: no menu.
  const hidden = Boolean(demo?.share)

  useEffect(() => {
    if (!open && !sheet && !again && !sharing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setSheet(false)
      setAgain(false)
      setSharing(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, sheet, again, sharing])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 5000)
    return () => clearTimeout(t)
  }, [copied])

  if (hidden) return null
  return (
    <div className="trip-menu" ref={box}>
      <button
        type="button"
        className={`trip-menu__button${open ? ' trip-menu__button--open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Trip menu"
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>
      {open && <div className="trip-menu__scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      {open && (
        <div className="trip-menu__list" role="menu">
          <SketchBox className="trip-menu__sheet" seed={41}>
            <button
              type="button"
              role="menuitem"
              className="trip-menu__item trip-menu__item--new"
              onClick={() => {
                setOpen(false)
                setSheet(true)
              }}
            >
              <i aria-hidden="true">✦</i>Copy the trip for my AI
            </button>
            {!demo && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => {
                    setOpen(false)
                    setSharing(true)
                  }}
                >
                  <i aria-hidden="true">↗</i>Share a read-only link
                </button>
                <Link
                  to={`/trips/${detail.trip.id}/settings#trip-address`}
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => setOpen(false)}
                >
                  <i aria-hidden="true">✉</i>Forward a booking
                </Link>
                <Link
                  to={`/trips/${detail.trip.id}/booking-email`}
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => setOpen(false)}
                >
                  <i aria-hidden="true">📋</i>Paste a booking email
                </Link>
                <Link
                  to={`/trips/${detail.trip.id}/import`}
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => setOpen(false)}
                >
                  <i aria-hidden="true">⇣</i>Import from my AI
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => {
                    setOpen(false)
                    setAgain(true)
                  }}
                >
                  <i aria-hidden="true">⧉</i>Start a new trip from this one
                </button>
                <hr className="trip-menu__rule" />
                <Link
                  to={`/trips/${detail.trip.id}/settings`}
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => setOpen(false)}
                >
                  <i aria-hidden="true">⚙</i>Trip settings
                </Link>
              </>
            )}
          </SketchBox>
        </div>
      )}
      {sheet && (
        <CopyForAi
          detail={detail}
          onClose={() => setSheet(false)}
          onCopied={() => {
            setSheet(false)
            setCopied(true)
          }}
        />
      )}
      {again && <NewTripFromThis detail={detail} onClose={() => setAgain(false)} />}
      {sharing && <ShareSheet detail={detail} onClose={() => setSharing(false)} />}
      {copied && (
        <div className="copied-note" role="status">
          <b>Copied</b>
          <p>Open Claude, ChatGPT or any AI, and paste it in a new chat.</p>
          <p className="hand">it doesn’t change anything here: your AI just reads it</p>
        </div>
      )}
    </div>
  )
}

/** The sheet: two switches, a question if you want one, a peek, and one button. */
function CopyForAi({ detail, onClose, onCopied }: { detail: TripDetail; onClose: () => void; onCopied: () => void }) {
  const { session } = useAuth()
  const viewer = useViewer(detail, session?.user.id)
  const [whoPaid, setWhoPaid] = useState(true)
  const [realNames, setRealNames] = useState(true)
  const [question, setQuestion] = useState<string | null>(null)
  const [money, setMoney] = useState<TripMoney | null>(null)
  const [moneyReady, setMoneyReady] = useState(false)
  const [error, setError] = useState<string>()
  const solo = detail.travellers.length <= 1

  // Who owes whom comes from Who paid's settlement.
  useEffect(() => {
    let active = true
    if (!solo)
      getMoney(detail.trip.id)
        .then((m) => active && setMoney(m))
        .catch(() => active && setMoney(null))
        .finally(() => active && setMoneyReady(true))
    return () => {
      active = false
    }
  }, [detail.trip.id, solo])

  const text = useMemo(
    () => tripForAi(detail, { whoPaid, realNames, viewer, money, question }),
    [detail, whoPaid, realNames, viewer, money, question],
  )
  const peek = text.split('\n').slice(0, 6).join('\n')
  const places = detail.places.length

  async function copy() {
    setError(undefined)
    if (await copyText(text)) onCopied()
    else setError('The phone didn’t allow copying. Try again, or press and hold to copy.')
  }

  return (
    <>
      <div className="trip-menu__scrim" aria-hidden="true" onClick={onClose} />
      <div className="copy-ai" role="dialog" aria-modal="true" aria-labelledby="copy-ai-title">
        <SketchBox tape="mustard" className="copy-ai__sheet" seed={42}>
          <button type="button" className="copy-ai__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          <h2 id="copy-ai-title" className="copy-ai__title">
            Copy the trip for my AI
          </h2>
          <p className="copy-ai__lead">
            The whole trip as text, to paste into Claude, ChatGPT or any AI. Nothing is sent from here: you choose where
            you paste it.
          </p>
          {!solo && (
            <Switch label="Who paid what" hint="payments and who owes whom" on={whoPaid} onChange={setWhoPaid} />
          )}
          <Switch label="Real names" hint="off: Traveller A, B, C…" on={realNames} onChange={setRealNames} />
          <p className="copy-ai__label" id="copy-ai-q">
            Add a question <span>(optional)</span>
          </p>
          <div className="chips" role="radiogroup" aria-labelledby="copy-ai-q">
            {AI_QUESTIONS.map((q) => (
              <button
                key={q.key}
                type="button"
                role="radio"
                className="chip"
                aria-checked={question === q.text}
                onClick={() => setQuestion(question === q.text ? null : q.text)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <pre className="copy-ai__peek" aria-label="The start of the text">
            {peek}
          </pre>
          <p className="copy-ai__size">
            {aiTextSize(text)} · {places} {places === 1 ? 'place' : 'places'}
          </p>
          {error && <p className="field__error">{error}</p>}
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={!solo && whoPaid && !moneyReady}
            onClick={() => void copy()}
          >
            {!solo && whoPaid && !moneyReady ? 'Adding who owes whom…' : 'Copy the trip'}
          </button>
        </SketchBox>
      </div>
    </>
  )
}

function Switch({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <button type="button" role="switch" aria-checked={on} className="copy-ai__switch" onClick={() => onChange(!on)}>
      <span>
        {label}
        <small>{hint}</small>
      </span>
      <span className={`toggle-pill${on ? ' toggle-pill--on' : ''}`} aria-hidden="true" />
    </button>
  )
}

/**
 * "Share a read-only link" (build 8 step 6, mockup share-link-v5): the link (made the first time),
 * Copy or Send it…, what it shows (prices, names), and turning it off.
 */
function ShareSheet({ detail, onClose }: { detail: TripDetail; onClose: () => void }) {
  const [link, setLink] = useState<ShareLink | null>()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  const tripId = detail.trip.id

  useEffect(() => {
    let active = true
    shareLink(tripId)
      .then((l) => active && setLink(l))
      .catch(() => active && setError('The link isn’t available right now.'))
    return () => {
      active = false
    }
  }, [tripId])

  const url = link ? shareUrl(link.token) : ''
  const canSend = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const change = (prices: boolean, names: boolean) => {
    if (!link) return
    const before = link
    setLink({ ...link, show_prices: prices, show_names: names })
    void run(
      () => setShare(tripId, prices, names),
      (m) => {
        setLink(before)
        setError(m)
      },
    )
  }

  return (
    <>
      <div className="trip-menu__scrim" aria-hidden="true" onClick={onClose} />
      <div className="copy-ai" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <SketchBox tape="mustard" className="copy-ai__sheet" seed={92}>
          <button type="button" className="copy-ai__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          <h2 id="share-title" className="copy-ai__title">
            Share a read-only link
          </h2>
          <p className="copy-ai__lead">Anyone with the link sees the trip. They can’t change anything.</p>
          {error && <p className="field__error">{error}</p>}
          {link === undefined && !error && <p className="loading">Making the link…</p>}
          {link && (
            <>
              <div className="booking-match share__link">
                <b className="share__url">{url.replace(/^https?:\/\//, '')}</b>
                <button
                  type="button"
                  className="button button--quiet trip-address__copy"
                  onClick={() => void copyText(url).then((ok) => setCopied(ok))}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              {canSend && (
                <button
                  type="button"
                  className="button button--primary button--wide"
                  onClick={() =>
                    void navigator
                      .share({ title: detail.trip.name, text: `${detail.trip.name} on Voyage Fare`, url })
                      .catch(() => {})
                  }
                >
                  <span className="ai-icon" aria-hidden="true">
                    ↗
                  </span>
                  Send it…
                </button>
              )}
              <p className="copy-ai__label">What they see</p>
              <Switch
                label="Prices and the budget"
                hint="off: just the route, places, days and ideas"
                on={link.show_prices}
                onChange={(on) => change(on, link.show_names)}
              />
              <Switch
                label="Travellers’ names"
                hint="off: “Traveller 1”, “Traveller 2”"
                on={link.show_names}
                onChange={(on) => change(link.show_prices, on)}
              />
              <p className="share__never">
                Never in the link: <b>who paid what</b> and the balances, <b>booking numbers and files</b>, the trip’s
                email address.
              </p>
              <div className="share__acts">
                <button
                  type="button"
                  className="link-button share__off"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await stopShare(tripId)
                      onClose()
                    }, setError)
                  }
                >
                  Turn the link off
                </button>
                <button type="button" className="button button--quiet" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          )}
        </SketchBox>
      </div>
    </>
  )
}

/** "A new trip from this one" (mockup duplicate-v5): a name, who comes, the options or only what was chosen. */
function NewTripFromThis({ detail, onClose }: { detail: TripDetail; onClose: () => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { busy, run } = useSaving()
  const me = detail.travellers.find((t) => t.user_id && t.user_id === session?.user.id) ?? null
  const others = detail.travellers.filter((t) => t.id !== me?.id)
  const [name, setName] = useState(`${detail.trip.name} again`)
  const [coming, setComing] = useState<string[]>(others.map((t) => t.id))
  const [allOptions, setAllOptions] = useState(true)
  const [error, setError] = useState<string>()
  const lines = detail.items.filter((i) => i.status !== 'dropped').length
  const places = detail.places.length

  async function start() {
    setError(undefined)
    if (!name.trim()) {
      setError('Give the new trip a name.')
      return
    }
    await run(async () => {
      const id = await duplicateTrip({ tripId: detail.trip.id, name: name.trim(), travellers: coming, allOptions })
      onClose()
      navigate(`/trips/${id}`, {
        state: {
          note: `A new trip from ${detail.trip.name}: ${plural(places, 'place')}, ${plural(lines, 'line')}, all estimated. Add the dates when you know them.`,
        },
      })
    }, setError)
  }

  return (
    <>
      <div className="trip-menu__scrim" aria-hidden="true" onClick={onClose} />
      <div className="copy-ai" role="dialog" aria-modal="true" aria-labelledby="again-title">
        <SketchBox tape="mustard" className="copy-ai__sheet" seed={61}>
          <button type="button" className="copy-ai__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          <h2 id="again-title" className="copy-ai__title">
            A new trip from this one
          </h2>
          <p className="copy-ai__lead">
            Same places and lines, ready to plan again. Nothing changes in {detail.trip.name}.
          </p>
          <label className="copy-ai__label" htmlFor="again-name">
            Name
          </label>
          <input
            id="again-name"
            className="field__input again__name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {others.length > 0 && (
            <>
              <p className="copy-ai__label" id="again-who">
                Who comes
              </p>
              <div className="chips" role="group" aria-labelledby="again-who">
                {me && (
                  <button type="button" className="chip" aria-pressed="true" disabled>
                    {me.name} · you
                  </button>
                )}
                {others.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="chip"
                    aria-pressed={coming.includes(t.id)}
                    onClick={() => setComing((c) => (c.includes(t.id) ? c.filter((x) => x !== t.id) : [...c, t.id]))}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <Switch
            label="The options you compared"
            hint="off: only what you chose"
            on={allOptions}
            onChange={setAllOptions}
          />
          <div className="again__keeps">
            <p>
              <b>Comes along</b>places, nights, the route, lines and their days, prices, notes, links, To try, daily
              estimates, rooms
            </p>
            <p>
              <b>Starts fresh</b>dates, bookings and payments (all back to estimated), who paid, the invitations
            </p>
          </div>
          {error && <p className="field__error">{error}</p>}
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={busy}
            onClick={() => void start()}
          >
            {busy ? 'Starting it…' : 'Start the new trip'}
          </button>
        </SketchBox>
      </div>
    </>
  )
}
