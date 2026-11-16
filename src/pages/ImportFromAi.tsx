import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AiProblem, Reading, WhereItGoes } from '../components/AiReading'
import { FormMessage } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import {
  AI_REQUEST,
  asJson,
  parseAiAnswer,
  planImport,
  sameName,
  type ParsedAnswer,
  type Preview,
} from '../lib/aiImport'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { copyText } from '../lib/clipboard'
import { formatMoney } from '../lib/money'
import { canPaste } from '../lib/pwa'
import { fetchRate } from '../lib/rates'
import { AiError } from '../lib/aiError'
import { createTrip, deleteTrip, importLines, readTrip, type TripDetail } from '../lib/trips'
import { formatDates, plural } from '../lib/tripText'
import { useTrip } from '../lib/useTrip'
import { useSaving } from '../lib/useSaving'

/*
 * "Import from my AI" (build 8 step 2, mockup import-ai-v5, 15 Nov). /trips/import makes a new trip,
 * /trips/:tripId/import adds to one. Ask, paste, preview; nothing is saved before the preview.
 * Not in our format? "Read it for me" (step 5a, mockup ai-reading-v5): Claude turns it into our
 * format through the ai-read server function, then the same preview.
 */

const ESTIMATED = 'Everything is estimated: mark what’s booked as you go.'

export function ImportNewTrip() {
  return <ImportFromAi target={null} />
}

export function ImportIntoTrip() {
  const { tripId = '' } = useParams()
  const { detail, loadError } = useTrip(tripId)
  if (loadError) return <ImportShell title="Import from my AI" back="/trips" error={loadError} />
  if (detail === undefined) return <Loading />
  if (detail === null || detail.trip.is_demo)
    return <ImportShell title="Import from my AI" back="/trips" error="This trip isn’t here." />
  return <ImportFromAi target={detail} />
}

function ImportShell({ title, back, error }: { title: string; back: string; error: string }) {
  return (
    <div className="screen">
      <header className="screen__top">
        <Link to={back} className="screen__back" aria-label="Back">
          ‹
        </Link>
        <div className="screen__heading">
          <h1 className="screen__title">{title}</h1>
        </div>
      </header>
      <div className="screen__body">
        <FormMessage tone="error">{error}</FormMessage>
      </div>
    </div>
  )
}

function ImportFromAi({ target }: { target: TripDetail | null }) {
  const [answer, setAnswer] = useState('')
  const [parsed, setParsed] = useState<ParsedAnswer | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reading, setReading] = useState(false)
  const [aiError, setAiError] = useState<unknown>(null)
  const [readByAi, setReadByAi] = useState(false)
  const back = target ? `/trips/${target.trip.id}` : '/trips/new'
  const title = target ? `Add to ${target.trip.name}` : 'Bring it from my AI'

  if (parsed)
    return (
      <PreviewStep parsed={parsed} target={target} title={title} readByAi={readByAi} onBack={() => setParsed(null)} />
    )

  async function readIt() {
    setReading(true)
    setAiError(null)
    try {
      const found = parseAiAnswer(await readTrip(answer))
      if (!found) throw new AiError('nothing', 'We couldn’t find a trip in this text: places, nights, hotels or ideas.')
      setReadByAi(true)
      setParsed(found)
    } catch (e) {
      setAiError(e)
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="screen import">
      <header className="screen__top">
        <Link to={back} className="screen__back" aria-label="Back">
          ‹
        </Link>
        <div className="screen__heading">
          <h1 className="screen__title">{title}</h1>
          <p className="screen__sub">two steps, then a preview</p>
        </div>
      </header>
      <div className="screen__body">
        {notFound && (
          <SketchBox className="import__sheet ai-offer" seed={81}>
            <p className="import__kicker">Not in our format</p>
            <h2 className="ai-offer__title">Your AI answered in its own words</h2>
            <p className="ai-offer__lead">
              Voyage Fare can read it for you and turn it into lines. You check everything in the preview before
              anything is saved.
            </p>
            {aiError !== null && <AiProblem error={aiError} />}
            {reading ? (
              <Reading />
            ) : (
              <button type="button" className="button button--primary button--wide" onClick={() => void readIt()}>
                <span className="ai-icon" aria-hidden="true">
                  ✎
                </span>
                Read it for me
              </button>
            )}
            <WhereItGoes />
            <CopyRequest again />
          </SketchBox>
        )}
        <SketchBox tape="mustard" className="import__sheet" seed={53}>
          <ol className="import__steps">
            <li>
              <span className="import__n" aria-hidden="true">
                1
              </span>
              <div>
                <b>Ask your AI</b>
                <p>Copy this request and paste it at the end of the chat where you planned the trip.</p>
                <CopyRequest again={false} />
              </div>
            </li>
            <li>
              <span className="import__n" aria-hidden="true">
                2
              </span>
              <div>
                <label htmlFor="ai-answer">
                  <b>Paste its answer</b>
                </label>
                <p>All of it, even if there’s text around: we find the trip inside.</p>
                <div className="import__paste">
                  <textarea
                    id="ai-answer"
                    className="field__input import__answer"
                    placeholder="Paste your AI’s answer…"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value)
                      setNotFound(false)
                      setAiError(null)
                    }}
                  />
                  {canPaste() && (
                    <button
                      type="button"
                      className="paste-button import__paste-button"
                      onClick={() =>
                        void navigator.clipboard
                          .readText()
                          .then((t) => {
                            setAnswer(t)
                            setNotFound(false)
                            setAiError(null)
                          })
                          .catch(() => {})
                      }
                    >
                      <span aria-hidden="true">📋</span> Paste
                    </button>
                  )}
                </div>
              </div>
            </li>
          </ol>
          <div className="add-item__actions">
            <Link to={back} className="button button--quiet">
              Cancel
            </Link>
            <button
              type="button"
              className="button button--primary"
              disabled={!answer.trim()}
              onClick={() => {
                const found = parseAiAnswer(answer)
                setReadByAi(false)
                if (found) setParsed(found)
                else setNotFound(true)
              }}
            >
              See what it gives
            </button>
          </div>
        </SketchBox>
        <p className="hand import__hint">nothing is saved before the preview</p>
      </div>
    </div>
  )
}

function CopyRequest({ again }: { again: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="button button--quiet import__copy"
      onClick={() => void copyText(AI_REQUEST).then((ok) => setCopied(ok))}
    >
      {copied ? '✓ Copied: paste it in your AI' : again ? 'Copy the request again' : 'Copy the request'}
    </button>
  )
}

function PreviewStep({
  parsed,
  target,
  title,
  readByAi,
  onBack,
}: {
  parsed: ParsedAnswer
  target: TripDetail | null
  title: string
  readByAi: boolean
  onBack: () => void
}) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { busy, run } = useSaving()
  const [error, setError] = useState<string>()
  const currency = target?.trip.currency ?? parsed.trip.currency ?? 'EUR'
  const me = (session?.user.user_metadata?.first_name as string | undefined)?.trim() || 'Me'
  const others = parsed.trip.travellers.filter((n) => !sameName(n, me))
  const people = target ? target.travellers.length : 1 + others.length

  // Today's rate for each other currency (once, for the preview and the save).
  const currencies = useMemo(() => {
    const all = [...parsed.places.flatMap((p) => p.lines), ...parsed.tickets].flatMap((l) =>
      l.options.map((o) => o.currency ?? currency),
    )
    return [...new Set(all)].filter((c) => c !== currency)
  }, [parsed, currency])
  const [rates, setRates] = useState<Record<string, number | null> | null>(currencies.length ? null : {})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!currencies.length) return
    let active = true
    Promise.all(currencies.map(async (c) => [c, await fetchRate(c, currency)] as const)).then(
      (pairs) => active && setRates(Object.fromEntries(pairs)),
    )
    return () => {
      active = false
    }
  }, [currencies, currency, attempt])

  const preview: Preview | null = useMemo(
    () => (rates ? planImport(parsed, target, currency, people, rates) : null),
    [parsed, target, currency, people, rates],
  )

  async function save() {
    if (!preview) return
    setError(undefined)
    await run(async () => {
      if (target) {
        await importLines(target.trip.id, asJson(preview.payload))
        navigate(`/trips/${target.trip.id}`, {
          state: {
            note: `Added from your AI: ${preview.newPlaces ? `${plural(preview.newPlaces, 'place')}, ` : ''}${plural(preview.newLines, 'line')}. ${ESTIMATED}`,
          },
        })
        return
      }
      const id = await createTrip({
        name: parsed.trip.name ?? 'My trip',
        me,
        travellers: others,
        startDate: parsed.trip.start,
        endDate: parsed.trip.end && parsed.trip.start && parsed.trip.end >= parsed.trip.start ? parsed.trip.end : null,
        homeCity: parsed.trip.from,
        homeLatitude: null,
        homeLongitude: null,
        currency,
        targetAmount: null,
        targetScope: 'per_person',
      })
      try {
        await importLines(id, asJson(preview.payload))
      } catch (e) {
        // All or nothing: no half trip left behind.
        await deleteTrip(id).catch(() => {})
        throw e
      }
      navigate(`/trips/${id}`, {
        state: {
          note: `Added from your AI: ${plural(preview.newPlaces, 'place')}, ${plural(preview.newLines, 'line')}. ${ESTIMATED}`,
        },
      })
    }, setError)
  }

  const nothingNew = preview && !preview.newLines && !preview.newPlaces
  const button = target
    ? nothingNew
      ? 'Nothing new to add'
      : `Add ${[preview?.newLines ? plural(preview.newLines, 'line') : null, preview?.newPlaces ? plural(preview.newPlaces, 'place') : null].filter(Boolean).join(' and ')}`
    : 'Create the trip'

  return (
    <div className="screen import">
      <header className="screen__top">
        <button type="button" className="screen__back" aria-label="Back to the answer" onClick={onBack}>
          ‹
        </button>
        <div className="screen__heading">
          <h1 className="screen__title">{target ? title : 'What your AI gave'}</h1>
          <p className="screen__sub">{target ? 'only what’s new' : 'check, then create it'}</p>
        </div>
      </header>
      <div className="screen__body">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {!target && (
          <SketchBox tape="mustard" className="import__cover" seed={54}>
            <p className="import__kicker">A new trip</p>
            <h2 className="import__name">{parsed.trip.name ?? 'My trip'}</h2>
            <p className="import__meta">
              {[
                formatDates(parsed.trip.start, parsed.trip.end) ?? 'no dates yet',
                parsed.trip.from ? `from ${parsed.trip.from}` : null,
                [me, ...others].join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {readByAi && (
              <p className="ai-mark">
                <span aria-hidden="true">✎</span> read by AI · check the prices
              </p>
            )}
            {preview && (
              <p className="import__counts">
                <span>
                  <b>{preview.newPlaces}</b>
                  {preview.newPlaces === 1 ? 'place' : 'places'}
                </span>
                <span>
                  <b>{preview.newLines}</b>
                  {preview.newLines === 1 ? 'line' : 'lines'}
                </span>
                {preview.each !== null && (
                  <span>
                    <b className="num">≈ {formatMoney(preview.each, currency)}</b>
                    {people > 1 ? 'each' : 'in all'}
                  </span>
                )}
              </p>
            )}
          </SketchBox>
        )}
        {!preview && <p className="loading">Getting today’s rates…</p>}
        {preview &&
          preview.places.map((p) => (
            <section key={p.name} className="import__place" aria-label={p.name}>
              <h3>
                {p.name}
                {target && p.isNew && <span className="import__tag import__tag--new">new place</span>}
                <small>{target && !p.isNew ? 'already in the trip' : plural(p.nights, 'night')}</small>
              </h3>
              <Lines lines={p.lines} showTags={Boolean(target)} />
            </section>
          ))}
        {preview && preview.tickets.length > 0 && (
          <section className="import__place" aria-label="Tickets">
            <h3>
              Tickets<small>getting there and around</small>
            </h3>
            <Lines lines={preview.tickets} showTags={Boolean(target)} />
          </section>
        )}
        {preview && (
          <div className="import__notes">
            {preview.missingRates.length > 0 && (
              <p className="form-message form-message--error" role="alert">
                We couldn’t get today’s rate for {preview.missingRates.join(', ')}. Check your connection, then{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setRates(null)
                    setAttempt((n) => n + 1)
                  }}
                >
                  try again
                </button>
                .
              </p>
            )}
            {preview.notes.map((n) => (
              <p key={n} className="form-message form-message--info">
                {n}
              </p>
            ))}
            {readByAi && target && (
              <p className="form-message form-message--info">
                Read by AI from your text: <b>check the prices</b> before adding them.
              </p>
            )}
            <p className="form-message form-message--info">
              Everything comes in as <b>estimated</b>: you mark what’s booked yourself.
            </p>
            {parsed.skipped.length > 0 && (
              <p className="form-message form-message--error">
                {plural(parsed.skipped.length, 'line')} couldn’t be read and{' '}
                {parsed.skipped.length === 1 ? 'is' : 'are'} left out:{' '}
                {parsed.skipped.map((s) => `“${s.what}” (${s.why})`).join(', ')}.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="import__bar">
        <button
          type="button"
          className="button button--primary button--wide"
          disabled={!preview || busy || preview.missingRates.length > 0 || Boolean(nothingNew)}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : button}
        </button>
        <button type="button" className="button button--quiet button--wide" onClick={onBack}>
          Back to the answer
        </button>
      </div>
    </div>
  )
}

function Lines({ lines, showTags }: { lines: Preview['tickets']; showTags: boolean }) {
  return (
    <ul className="import__lines">
      {lines.map((l, i) => (
        <li key={`${l.name}-${i}`} className={`import__line${l.there ? ' import__line--there' : ''}`}>
          <span>
            <span className="import__when">{l.when}</span>
            <span className="import__what">
              {l.name}
              {showTags && (
                <span className={`import__tag${l.there ? '' : ' import__tag--new'}`}>
                  {l.there ? 'already there' : 'new'}
                </span>
              )}
            </span>
          </span>
          <span className="import__price num">{l.price}</span>
          {l.sub && <span className="import__sub">{l.sub}</span>}
        </li>
      ))}
    </ul>
  )
}
