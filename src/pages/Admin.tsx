import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import {
  addAdmin,
  adminList,
  adminMessages,
  adminOverview,
  adminPeople,
  amIAdmin,
  markMessage,
  removeAdmin,
  type AdminEntry,
  type AdminMessage,
  type AdminPerson,
  type Overview,
} from '../lib/trips'
import { useSaving } from '../lib/useSaving'

/*
 * The Admin dashboard, stage A (build 8, mockup admin-v5, 15 Nov): Overview · Messages · People ·
 * Admins. The database checks every call (admins only). Admins see accounts and how many trips,
 * never what's in them. hello@ (stage B) and notifications (stage C) come next.
 */

type Tab = 'overview' | 'messages' | 'people' | 'admins'

const FREE = { files: 1024 ** 3, database: 500 * 1024 ** 2 }

const KIND: Record<string, string> = {
  broken: 'Something’s broken',
  unclear: 'Something’s unclear',
  idea: 'An idea',
  love: 'I love it',
}

const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

const mb = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`

export function Admin() {
  const [allowed, setAllowed] = useState<boolean>()
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<Overview>()
  const [error, setError] = useState<string>()

  const refresh = useCallback(() => {
    adminOverview()
      .then(setOverview)
      .catch((e) => setError(explainAuthError(e).message))
  }, [])

  useEffect(() => {
    let active = true
    amIAdmin().then((yes) => {
      if (!active) return
      setAllowed(yes)
      if (yes) refresh()
    })
    return () => {
      active = false
    }
  }, [refresh])

  if (allowed === undefined) return <Loading />
  if (!allowed)
    return (
      <div className="screen">
        <header className="screen__top">
          <Link to="/trips" className="screen__back" aria-label="Your trips">
            ‹
          </Link>
          <div className="screen__heading">
            <h1 className="screen__title">Admin</h1>
          </div>
        </header>
        <div className="screen__body">
          <FormMessage tone="error">This page is for Voyage Fare’s admins.</FormMessage>
        </div>
      </div>
    )

  const fresh = overview?.new_messages ?? 0
  return (
    <div className="screen admin">
      <header className="screen__top">
        <Link to="/trips" className="screen__back" aria-label="Your trips">
          ‹
        </Link>
        <div className="screen__heading">
          <h1 className="screen__title">Admin</h1>
        </div>
      </header>
      <nav className="admin__tabs" aria-label="Admin">
        {(
          [
            ['overview', 'Overview'],
            ['messages', 'Messages'],
            ['people', 'People'],
            ['admins', 'Admins'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`admin__tab${tab === key ? ' admin__tab--on' : ''}`}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'messages' && fresh > 0 && <small>{fresh}</small>}
          </button>
        ))}
      </nav>
      <div className="screen__body">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {tab === 'overview' && <OverviewTab overview={overview} />}
        {tab === 'messages' && <MessagesTab onChanged={refresh} />}
        {tab === 'people' && <PeopleTab />}
        {tab === 'admins' && <AdminsTab />}
      </div>
    </div>
  )
}

function OverviewTab({ overview: o }: { overview: Overview | undefined }) {
  if (!o) return <Loading />
  const stats: [number, string, string | null][] = [
    [o.accounts, 'accounts', o.accounts_week ? `+${o.accounts_week} this week` : null],
    [o.trips, 'trips', o.trips_week ? `+${o.trips_week} this week` : null],
    [o.active_week, 'active this week', null],
    [o.new_messages, o.new_messages === 1 ? 'new message' : 'new messages', null],
  ]
  return (
    <>
      <p className="hand admin__hint">how Voyage Fare is doing</p>
      <div className="admin__stats">
        {stats.map(([n, label, change]) => (
          <div key={label} className="admin__stat">
            <b className="num">{n}</b>
            <span>{label}</span>
            {change && <em>{change}</em>}
          </div>
        ))}
      </div>
      <p className="admin__kicker">Free plans</p>
      <Meter label="Files stored" used={o.files_bytes} limit={FREE.files} />
      <Meter label="Database" used={o.database_bytes} limit={FREE.database} />
      <p className="admin__later">
        Emails sent and received, and “Notify me” on this phone, arrive with the next stages.
      </p>
    </>
  )
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = Math.min(1, used / limit)
  return (
    <div className="admin__meter">
      <p>
        {label}
        <span className="num">
          {mb(used)} / {mb(limit)}
        </span>
      </p>
      <div
        className="admin__bar"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(share * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${Math.max(share * 100, 1)}%` }} className={share > 0.8 ? 'admin__bar--high' : undefined} />
      </div>
    </div>
  )
}

function MessagesTab({ onChanged }: { onChanged: () => void }) {
  const [messages, setMessages] = useState<AdminMessage[]>()
  const [filter, setFilter] = useState<'new' | 'done'>('new')
  const [error, setError] = useState<string>()
  const { run } = useSaving()

  const load = useCallback(() => {
    adminMessages()
      .then(setMessages)
      .catch((e) => setError(explainAuthError(e).message))
  }, [])
  useEffect(load, [load])

  if (!messages) return error ? <FormMessage tone="error">{error}</FormMessage> : <Loading />
  const shown = messages.filter((m) => m.status === filter)
  const count = (s: string) => messages.filter((m) => m.status === s).length

  return (
    <>
      <div className="chips admin__filters" role="radiogroup" aria-label="Messages">
        <button
          type="button"
          role="radio"
          className="chip"
          aria-checked={filter === 'new'}
          onClick={() => setFilter('new')}
        >
          New · {count('new')}
        </button>
        <button
          type="button"
          role="radio"
          className="chip"
          aria-checked={filter === 'done'}
          onClick={() => setFilter('done')}
        >
          Done · {count('done')}
        </button>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {shown.length === 0 && (
        <p className="admin__empty hand">{filter === 'new' ? 'nothing new' : 'nothing here yet'}</p>
      )}
      {shown.map((m, i) => (
        <SketchBox key={m.id} weight="light" className="admin__msg" seed={90 + i}>
          <p className="admin__msg-head">
            <span className="admin__kind">
              <span className="admin__src">App</span>
              {m.status === 'new' && <span className="admin__dot" aria-hidden="true" />}
              {KIND[m.kind] ?? m.kind}
            </span>
            <span className="admin__when">{when.format(new Date(m.created_at))}</span>
          </p>
          <p className="admin__text">{m.message}</p>
          <p className="admin__meta">
            {[m.first_name ?? 'Someone', m.email ?? 'doesn’t want a reply', m.page, m.device]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="admin__actions">
            {m.email && (
              <a href={`mailto:${m.email}?subject=${encodeURIComponent('About your Voyage Fare feedback')}`}>
                Reply by email
              </a>
            )}
            <button
              type="button"
              className="link-button"
              onClick={() =>
                void run(async () => {
                  await markMessage(m.id, m.status === 'new' ? 'done' : 'new')
                  load()
                  onChanged()
                }, setError)
              }
            >
              {m.status === 'new' ? 'Done' : 'Back to new'}
            </button>
          </p>
        </SketchBox>
      ))}
      <p className="admin__later">
        Emails to hello@ join this list in the next stage; until then they’re in your pro brief.
      </p>
    </>
  )
}

function PeopleTab() {
  const [people, setPeople] = useState<AdminPerson[]>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    adminPeople()
      .then(setPeople)
      .catch((e) => setError(explainAuthError(e).message))
  }, [])
  if (!people) return error ? <FormMessage tone="error">{error}</FormMessage> : <Loading />
  return (
    <>
      <ul className="admin__people">
        {people.map((p) => (
          <li key={p.user_id}>
            <span className="admin__av" aria-hidden="true">
              {(p.first_name ?? p.email).slice(0, 1).toUpperCase()}
            </span>
            <span>
              <b>
                {p.first_name ?? '—'}
                {p.is_admin && <span className="admin__tag">admin</span>}
              </b>
              <small>
                {p.email} · since {day.format(new Date(p.created_at))}
                {!p.confirmed && ' · email not confirmed'}
              </small>
            </span>
            <span className="admin__right">
              {Number(p.trips)} {Number(p.trips) === 1 ? 'trip' : 'trips'}
              <br />
              {ago(p.last_seen)}
            </span>
          </li>
        ))}
      </ul>
      <p className="form-message form-message--info admin__privacy">
        You see who has an account and how many trips they have, <b>never what’s in their trips</b>.
      </p>
    </>
  )
}

function AdminsTab() {
  const { session } = useAuth()
  const [admins, setAdmins] = useState<AdminEntry[]>()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  const load = useCallback(() => {
    adminList()
      .then(setAdmins)
      .catch((e) => setError(explainAuthError(e).message))
  }, [])
  useEffect(load, [load])
  if (!admins) return error ? <FormMessage tone="error">{error}</FormMessage> : <Loading />

  return (
    <>
      <ul className="admin__people">
        {admins.map((a) => (
          <li key={a.user_id}>
            <span className="admin__av" aria-hidden="true">
              {(a.first_name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <span>
              <b>
                {a.first_name ?? '—'}
                {a.user_id === session?.user.id && ' (you)'}
              </b>
              <small>
                {a.is_first
                  ? 'first admin · can’t be removed'
                  : `added${a.added_by_name ? ` by ${a.added_by_name}` : ''} · ${day.format(new Date(a.created_at))}`}
              </small>
            </span>
            <span className="admin__right">
              {!a.is_first && (
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await removeAdmin(a.user_id)
                      load()
                    }, setError)
                  }
                >
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form
        className="admin__add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!email.trim()) return
          void run(async () => {
            await addAdmin(email)
            setEmail('')
            load()
          }, setError)
        }}
      >
        <label className="admin__kicker" htmlFor="admin-email">
          Add an admin
        </label>
        <div className="admin__add-row">
          <input
            id="admin-email"
            type="email"
            className="field__input"
            placeholder="their email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="button button--primary" disabled={busy}>
            Add
          </button>
        </div>
        <p className="hand admin__hint">they need a Voyage Fare account first</p>
      </form>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </>
  )
}
