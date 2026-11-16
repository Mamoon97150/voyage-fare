import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FeedbackSheet } from '../components/FeedbackSheet'
import { HomeNav } from '../components/HomeNav'
import { SketchBox } from '../components/Sketch'
import { useAuth } from '../lib/authContext'
import { keepTrips, setKeepTrips, useInstallCard } from '../lib/pwa'
import { pushState, turnOff, turnOn, type PushState } from '../lib/push'
import { FormMessage } from '../components/AuthForm'
import { useSaving } from '../lib/useSaving'
import { setThemeChoice, themeChoice, type ThemeChoice } from '../lib/theme'
import { DEMO_LINK } from '../lib/site'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../lib/useAdmin'

/**
 * Me (build 8½, mockup menus-home-v6): a full page instead of the drop-down behind the initial.
 * Admin on top, only for admins (the database says who is); your account; the app; sign out.
 */
export function Me() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const admin = useAdmin()
  const { canInstall, install, card, showAgain } = useInstallCard()
  const [feedback, setFeedback] = useState(false)
  const [thanks, setThanks] = useState(false)
  const [busy, setBusy] = useState(false)
  const firstName = (session?.user.user_metadata?.first_name as string | undefined) ?? ''
  const email = session?.user.email ?? ''

  useEffect(() => {
    if (!thanks) return
    const t = setTimeout(() => setThanks(false), 5000)
    return () => clearTimeout(t)
  }, [thanks])

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    // The session listener sends the person back to sign in.
  }

  function putOnPhone() {
    // Android offers its own button; on an iPhone, the card on Your trips shows the two steps.
    if (card === 'button') void install()
    else {
      showAgain()
      navigate('/trips')
    }
  }

  return (
    <div className="page page--nav">
      <header className="app-header">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span className="app-header__name">Voyage Fare</span>
      </header>
      <main className="me">
        <h1 className="trips__title">Me</h1>
        <p className="hand trips__hello">{[firstName, email].filter(Boolean).join(' · ')}</p>

        {admin && (
          <SketchBox weight="light" className="me__block" seed={51}>
            <h2 className="me__title">
              Admin {admin.fresh > 0 && <span className="me__new">● {admin.fresh} new</span>}
            </h2>
            <ul className="me__rows">
              <Row to="/admin" label="Admin dashboard" sub="accounts, trips, messages, limits" />
            </ul>
          </SketchBox>
        )}

        <SketchBox weight="light" className="me__block" seed={52}>
          <h2 className="me__title">Your account</h2>
          <ul className="me__rows">
            <Row to="/account" label="Name, email, password" sub={email} />
          </ul>
        </SketchBox>

        <SketchBox weight="light" className="me__block" seed={53}>
          <h2 className="me__title">The app</h2>
          <ul className="me__rows">
            {canInstall && <Row onClick={putOnPhone} label="Put it on my phone" />}
            <LookPicker />
            <RemindersSwitch />
            <KeepTripsSwitch />
            <Row onClick={() => setFeedback(true)} label="Send feedback" sub="something broken, unclear, an idea" />
            <Row to={DEMO_LINK} label="See the demo" />
            <Row to="/privacy" label="Privacy" />
          </ul>
        </SketchBox>

        <p className="me__foot">
          <button type="button" className="link-button" onClick={() => void signOut()} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
          <Link to="/account#delete" className="me__delete">
            Delete my account
          </Link>
        </p>
      </main>
      {feedback && (
        <FeedbackSheet
          onClose={() => setFeedback(false)}
          onSent={() => {
            setFeedback(false)
            setThanks(true)
          }}
        />
      )}
      {thanks && (
        <div className="copied-note" role="status">
          <b>Thank you{firstName ? `, ${firstName}` : ''}!</b>
          <p>It’s with Djamina. If you said she can, she’ll write back to you by email.</p>
        </div>
      )}
      <HomeNav />
    </div>
  )
}

function Row({ to, onClick, label, sub }: { to?: string; onClick?: () => void; label: string; sub?: string }) {
  const inner = (
    <>
      <span>
        {label}
        {sub && <small>{sub}</small>}
      </span>
      <span className="me__go" aria-hidden="true">
        ›
      </span>
    </>
  )
  return (
    <li>
      {to ? (
        <Link to={to} className="me__row">
          {inner}
        </Link>
      ) : (
        <button type="button" className="me__row" onClick={onClick}>
          {inner}
        </button>
      )}
    </li>
  )
}

/** Reminders (build 10): a notification 3 days before a balance is due, and on the day. */
function RemindersSwitch() {
  const [state, setState] = useState<PushState>()
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  useEffect(() => {
    pushState()
      .then(setState)
      .catch(() => setState('unsupported'))
  }, [])
  if (!state || state === 'unsupported') return null
  const hint: Record<PushState, string> = {
    on: '3 days before a balance is due, and on the day',
    off: '3 days before a balance is due, and on the day',
    unsupported: '',
    'needs-home-screen': 'on iPhone, put Voyage Fare on your home screen first, then open it from there',
    blocked: 'notifications are blocked for Voyage Fare in this phone’s settings',
  }
  return (
    <li>
      <button
        type="button"
        className="me__row copy-ai__switch"
        aria-pressed={state === 'on'}
        disabled={busy || state === 'needs-home-screen' || state === 'blocked'}
        onClick={() =>
          void run(async () => {
            if (state === 'on') await turnOff()
            else await turnOn()
            setState(await pushState())
          }, setError)
        }
      >
        <span>
          Reminders
          <small>{busy ? 'one moment…' : hint[state]}</small>
        </span>
        <span className={`toggle-pill${state === 'on' ? ' toggle-pill--on' : ''}`} aria-hidden="true" />
      </button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </li>
  )
}

/** Keep my trips on this phone (build 10): the trips you open stay readable with no signal. */
function KeepTripsSwitch() {
  const [on, setOn] = useState(keepTrips)
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  return (
    <li>
      <button
        type="button"
        className="me__row copy-ai__switch"
        aria-pressed={on}
        onClick={() => {
          setKeepTrips(!on)
          setOn(!on)
        }}
      >
        <span>
          Keep my trips on this phone
          <small>to read them with no signal (airport, metro)</small>
        </span>
        <span className={`toggle-pill${on ? ' toggle-pill--on' : ''}`} aria-hidden="true" />
      </button>
    </li>
  )
}

/** Look (dark mode, 16 Nov): Auto follows the phone's own day / night setting. */
function LookPicker() {
  const [choice, setChoice] = useState<ThemeChoice>(themeChoice)
  const options: { key: ThemeChoice; label: string }[] = [
    { key: 'auto', label: 'Auto' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ]
  return (
    <li className="me__look">
      <span>
        Look
        <small>Auto follows your phone’s day and night</small>
      </span>
      <span className="me__look-choices" role="radiogroup" aria-label="Look">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={choice === o.key}
            className="chip"
            onClick={() => {
              setThemeChoice(o.key)
              setChoice(o.key)
            }}
          >
            {o.label}
          </button>
        ))}
      </span>
    </li>
  )
}
