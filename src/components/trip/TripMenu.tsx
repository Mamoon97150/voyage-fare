import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AI_QUESTIONS, aiTextSize, tripForAi } from '../../lib/aiText'
import { copyText } from '../../lib/clipboard'
import { useAuth } from '../../lib/authContext'
import { useDemo, useViewer } from '../../lib/demo'
import { getMoney, type TripDetail, type TripMoney } from '../../lib/trips'
import { SketchBox } from '../Sketch'

/*
 * The trip's menu ⋯ (build 8 step 1, mockup copy-for-ai-v5, 15 Nov): "Copy the trip for my AI" now;
 * Import from my AI, Duplicate and Share a link join it as build 8 goes on. Trip settings too.
 */

export function TripMenu({ detail }: { detail: TripDetail }) {
  const demo = useDemo()
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open && !sheet) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setSheet(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, sheet])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 5000)
    return () => clearTimeout(t)
  }, [copied])

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
        ⋯
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
                <Link
                  to={`/trips/${detail.trip.id}/import`}
                  role="menuitem"
                  className="trip-menu__item"
                  onClick={() => setOpen(false)}
                >
                  <i aria-hidden="true">⇣</i>Import from my AI
                </Link>
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
      <span className={`switch${on ? ' switch--on' : ''}`} aria-hidden="true" />
    </button>
  )
}
