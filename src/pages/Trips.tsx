import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AccountMenu } from '../components/AccountMenu'
import { FormMessage } from '../components/AuthForm'
import { HandBar } from '../components/HandBar'
import { InstallCard, NoConnection } from '../components/PhoneApp'
import { Sketch, SketchBox, Underlined } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { hintSeen, markHintSeen } from '../lib/hints'
import { explainAuthError } from '../lib/authForm'
import { formatWhole } from '../lib/money'
import {
  countdown,
  dayOfTrip,
  daysTo,
  greeting,
  monthYear,
  nights,
  placeOn,
  settleLines,
  shelve,
  sortOutNote,
  todayIso,
  toSortOut,
} from '../lib/shelf'
import { listTrips, type TripCard } from '../lib/trips'
import { formatDates, plural } from '../lib/tripText'

/**
 * "Your trips" as a shelf of notebooks (mockup trips-welcome-v5, 15 Nov): the next trip big, with
 * the screen's one tape (or the trip you're on, in green, while travelling), then Coming up ·
 * Still a dream · Past trips, and a blank page to start a new one.
 */
export function Trips() {
  const { session } = useAuth()
  const [trips, setTrips] = useState<TripCard[]>()
  const [error, setError] = useState<string>()
  const [offline, setOffline] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    listTrips()
      .then((t) => {
        if (!active) return
        setTrips(t)
        setError(undefined)
        setOffline(false)
      })
      .catch((e) => {
        if (!active) return
        // Opened with no connection: "No connection" and Try again, not an error message.
        if (!navigator.onLine) setOffline(true)
        else setError(explainAuthError(e).message)
      })
    return () => {
      active = false
    }
  }, [attempt])

  const today = todayIso()
  const shelf = useMemo(() => (trips ? shelve(trips, today) : null), [trips, today])
  const firstName = (session?.user.user_metadata?.first_name as string | undefined) ?? null

  return (
    <div className="page">
      <header className="app-header">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span className="app-header__name">Voyage Fare</span>
        <span className="app-header__account">
          <AccountMenu />
        </span>
      </header>
      <main className="trips">
        <div className="trips__head">
          <h1 className="trips__title">Your trips</h1>
          {shelf && trips && trips.length > 0 && (
            <p className="hand trips__hello">{greeting(shelf, firstName, today)}</p>
          )}
        </div>
        <WelcomeSlip />
        {trips && trips.length > 0 && <InstallCard />}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {offline && trips === undefined && <NoConnection onRetry={() => setAttempt((n) => n + 1)} />}
        {!error && !offline && trips === undefined && <Loading />}
        {trips?.length === 0 && (
          <SketchBox tape="green" className="empty">
            <Sketch name="no-trips" width={240} />
            <h2 className="empty__title">Your first trip</h2>
            <p className="empty__lead">
              Where to? Add the places, then what you’re thinking of: the app adds it up, for each of you.
            </p>
            <Link to="/trips/new" className="button button--primary button--wide">
              + Start a trip
            </Link>
            <Link to="/demo" className="empty__demo">
              or look at a real trip first ›
            </Link>
          </SketchBox>
        )}
        {shelf && trips && trips.length > 0 && (
          <div className="shelf">
            {shelf.featured && (
              <Group label={shelf.travelling ? 'Travelling now' : 'Coming up'}>
                <BigTrip trip={shelf.featured} travelling={shelf.travelling} today={today} />
              </Group>
            )}
            {shelf.coming.length > 0 && (
              <Group label={shelf.featured && !shelf.travelling ? 'After that' : 'Coming up'}>
                {shelf.coming.map((t, i) => (
                  <SmallTrip key={t.id} trip={t} seed={70 + i}>
                    <span className="small-trip__meta">
                      {formatDates(t.start_date, t.end_date)} · {countdown(daysTo(t, today) ?? 0, true).toLowerCase()}
                    </span>
                  </SmallTrip>
                ))}
              </Group>
            )}
            {shelf.dreams.length > 0 && (
              <Group label="Still a dream" aside="no dates yet">
                {shelf.dreams.map((t, i) => (
                  <SmallTrip key={t.id} trip={t} seed={80 + i}>
                    <span className="small-trip__meta">{routeLine(t) ?? plural(t.travellers.length, 'traveller')}</span>
                  </SmallTrip>
                ))}
              </Group>
            )}
            <Link to="/trips/new" className="new-page-link">
              <SketchBox weight="light" dashed className="new-page" seed={63}>
                <b>+ A new trip</b>
                <span className="hand">a blank page, wherever you dream of going</span>
              </SketchBox>
            </Link>
            {shelf.past.length > 0 && (
              <Group label="Past trips" aside={String(shelf.past.length)}>
                {shelf.past.map((t, i) => (
                  <PastTrip key={t.id} trip={t} seed={90 + i} />
                ))}
              </Group>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Group({ label, aside, children }: { label: string; aside?: string; children: ReactNode }) {
  return (
    <section className="shelf__group" aria-label={label}>
      <p className="shelf__label">
        {label}
        {aside && <span>{aside}</span>}
      </p>
      <ul className="shelf__list">
        {Array.isArray(children) ? children.map((c, i) => <li key={i}>{c}</li>) : <li>{children}</li>}
      </ul>
    </section>
  )
}

/** "Bogotá → Guatapé → Medellín": the places in order (null when there are none). */
const routeLine = (t: TripCard) => (t.places.length ? t.places.map((p) => p.name).join(' → ') : null)

const solo = (t: TripCard) => t.travellers.length <= 1

/** The next trip, or the one you're on: everything it needs at a glance. */
function BigTrip({ trip: t, travelling, today }: { trip: TripCard; travelling: boolean; today: string }) {
  const now = travelling ? dayOfTrip(t, today) : null
  const here = now ? placeOn(t, now.day) : null
  const sortOut = toSortOut(t)
  const owes = settleLines(t)
  const link = here ? `/trips/${t.id}#place-${here.id}` : `/trips/${t.id}`
  return (
    <Link to={link} className="big-trip-link" aria-label={`${t.name}: open`}>
      <SketchBox tape={travelling ? 'green' : 'mustard'} className="big-trip" seed={61}>
        <div className="big-trip__kicker">
          <span className={`countdown${travelling ? ' countdown--now' : ''}`}>
            {now ? `Day ${now.day}${now.of ? ` of ${now.of}` : ''}` : countdown(daysTo(t, today) ?? 0)}
          </span>
          <Avatars travellers={t.travellers} />
        </div>
        <h2 className="big-trip__name">{t.name}</h2>
        <p className="big-trip__dates">
          {[
            formatDates(t.start_date, t.end_date),
            !travelling && nights(t) ? plural(nights(t), 'night') : null,
            plural(t.travellers.length, 'traveller'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {t.places.length > 0 && (
          <p className="route-words">
            {t.home_city && !travelling && (
              <>
                <span className="route-words__home">{t.home_city}</span>
                <i aria-hidden="true">→</i>
              </>
            )}
            {t.places.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <i aria-hidden="true">→</i>}
                {p.id === here?.id ? <b className="route-words__today">{p.name} ●</b> : p.name}
              </span>
            ))}
            {t.home_city && !travelling && (
              <>
                <i aria-hidden="true">→</i>
                <span className="route-words__home">home</span>
              </>
            )}
          </p>
        )}

        {travelling && (t.today?.length || owes.length > 0) ? (
          <div className="todo-lines">
            {t.today && t.today.length > 0 && (
              <p>
                <span className="dot-ok" aria-hidden="true" />
                Today: {t.today.join(', ')}
              </p>
            )}
            {owes.slice(0, 2).map((o) => (
              <p key={o.text}>
                <span className={o.youPay ? 'dot-todo' : 'dot-ok'} aria-hidden="true" />
                {o.text}
              </p>
            ))}
          </div>
        ) : null}

        <Share trip={t} />

        {!travelling && sortOut.lines.length > 0 && (
          <div className="todo-lines">
            {sortOut.lines.map((line) => (
              <p key={line}>
                <span className="dot-todo" aria-hidden="true" />
                {line}
              </p>
            ))}
          </div>
        )}
        <div className="big-trip__foot">
          <span className="hand">{travelling ? 'add a spend on the go' : sortOutNote(sortOut.count)}</span>
          <span className="big-trip__open">{travelling ? 'Open today ›' : 'Open ›'}</span>
        </div>
      </SketchBox>
    </Link>
  )
}

/** Your share, the crayon bar, and what's confirmed or still estimated. */
function Share({ trip: t }: { trip: TripCard }) {
  const total = t.shareConfirmed + t.shareEstimated
  return (
    <div className="card-share">
      <div className="card-share__row">
        <span className="card-share__figure num">{formatWhole(total, t.currency)}</span>
        <span className="card-share__words">{solo(t) ? 'the trip' : <Underlined>your share</Underlined>}</span>
      </div>
      {total > 0 && (
        <>
          <HandBar
            confirmed={t.shareConfirmed / total}
            estimated={t.shareEstimated / total}
            target={null}
            over={false}
          />
          <div className="card-share__legend num">
            <span>
              <b className="card-share__confirmed">{formatWhole(t.shareConfirmed, t.currency)}</b> confirmed
            </span>
            <span>
              <b className="card-share__estimated">{formatWhole(t.shareEstimated, t.currency)}</b> still estimated
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/** A trip to come or a dream: its name, a line, your share, a small bar. */
function SmallTrip({ trip: t, seed, children }: { trip: TripCard; seed: number; children: ReactNode }) {
  const total = t.shareConfirmed + t.shareEstimated
  return (
    <Link to={`/trips/${t.id}`} className="small-trip-link">
      <SketchBox weight="light" className="small-trip" seed={seed}>
        <span className="small-trip__main">
          <b className="small-trip__name">{t.name}</b>
          {children}
        </span>
        <span className="small-trip__side">
          {total > 0 && (
            <b className="num">
              {t.shareConfirmed === 0 ? '≈ ' : ''}
              {formatWhole(total, t.currency)}
            </b>
          )}
          {total > 0 && (solo(t) ? 'the trip' : 'your share')}
        </span>
        {total > 0 && (
          <span className="small-trip__bar">
            <HandBar
              confirmed={t.shareConfirmed / total}
              estimated={t.shareEstimated / total}
              target={null}
              over={false}
              bare
            />
          </span>
        )}
      </SketchBox>
    </Link>
  )
}

/** A past trip: what it cost you, and whether everyone is settled up. */
function PastTrip({ trip: t, seed }: { trip: TripCard; seed: number }) {
  const total = t.shareConfirmed + t.shareEstimated
  const owes = settleLines(t)
  return (
    <Link to={`/trips/${t.id}`} className="small-trip-link">
      <SketchBox weight="light" className="small-trip small-trip--past" seed={seed}>
        <span className="small-trip__main">
          <b className="small-trip__name">{t.name}</b>
          <span className="small-trip__meta">
            {[
              t.start_date && monthYear(t.start_date),
              nights(t) ? plural(nights(t), 'night') : null,
              t.places.length ? plural(t.places.length, 'place') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="small-trip__side">
          <span className="hand">{solo(t) ? 'it cost' : 'it cost you'}</span>
          <b className="num">{formatWhole(total, t.currency)}</b>
          {t.settled ? (
            <span className="small-trip__tag small-trip__tag--ok">● All settled</span>
          ) : owes.length > 0 ? (
            <span className={`small-trip__tag${owes[0].youPay ? ' small-trip__tag--owe' : ''}`}>{owes[0].text}</span>
          ) : null}
        </span>
      </SketchBox>
    </Link>
  )
}

/** Who's going: initials, yours ringed; four at most, then "+2". */
function Avatars({ travellers }: { travellers: TripCard['travellers'] }) {
  const shown = travellers.slice(0, 4)
  const more = travellers.length - shown.length
  return (
    <span className="avatars" aria-label={travellers.map((t) => (t.me ? `${t.name} (you)` : t.name)).join(', ')}>
      {shown.map((t) => (
        <span key={t.id} className={`avatar${t.me ? ' avatar--me' : ''}`} aria-hidden="true">
          {t.name.trim().charAt(0).toUpperCase()}
        </span>
      ))}
      {more > 0 && (
        <span className="avatar avatar--more" aria-hidden="true">
          +{more}
        </span>
      )}
    </span>
  )
}

/**
 * Once, right after confirming the email (sign-in polish, 15 Nov): "Email confirmed, welcome Dana!"
 * A note slipped into the notebook, remembered on this device.
 */
function WelcomeSlip() {
  const { session } = useAuth()
  const user = session?.user
  const confirmed = user?.email_confirmed_at ? Date.parse(user.email_confirmed_at) : null
  const key = `welcome:${user?.id}`
  const [show] = useState(() => confirmed !== null && Date.now() - confirmed < 30 * 60_000 && !hintSeen(key))
  useEffect(() => {
    if (show) markHintSeen(key)
  }, [show, key])
  if (!show) return null
  const name = user?.user_metadata?.first_name as string | undefined
  return (
    <div className="welcome-slip" role="status">
      <p>Email confirmed, welcome{name ? ` ${name}` : ''}! Your notebook is ready.</p>
    </div>
  )
}
