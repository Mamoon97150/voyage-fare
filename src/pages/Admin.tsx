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
  inboxDone,
  inboxRead,
  inboxReply,
  inboxThreads,
  markMessage,
  removeAdmin,
  type AdminEntry,
  type AdminMessage,
  type AdminPerson,
  type InboxEmail,
  type InboxThread,
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
  const [threads, setThreads] = useState<InboxThread[] | null>()
  const [inboxError, setInboxError] = useState<string>()
  const [filter, setFilter] = useState<'new' | 'done' | 'app' | 'mail'>('new')
  const [error, setError] = useState<string>()
  const { run } = useSaving()

  const load = useCallback(() => {
    adminMessages()
      .then(setMessages)
      .catch((e) => setError(explainAuthError(e).message))
    inboxThreads()
      .then((t) => {
        setThreads(t)
        setInboxError(undefined)
      })
      .catch((e: Error) => {
        setThreads(null)
        setInboxError(e.message)
      })
  }, [])
  useEffect(load, [load])

  if (!messages) return error ? <FormMessage tone="error">{error}</FormMessage> : <Loading />

  // One list: the app's feedback and hello@, newest first.
  type Row = { at: string; app?: AdminMessage; mail?: InboxThread }
  const rows: Row[] = [
    ...messages.map((m) => ({ at: m.created_at, app: m })),
    ...(threads ?? []).map((t) => ({ at: t.received_at, mail: t })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const isDone = (r: Row) => (r.app ? r.app.status === 'done' : Boolean(r.mail?.done))
  const shown = rows.filter((r) =>
    filter === 'new' ? !isDone(r) : filter === 'done' ? isDone(r) : filter === 'app' ? Boolean(r.app) : Boolean(r.mail),
  )
  const filters: [typeof filter, string][] = [
    ['new', `New · ${rows.filter((r) => !isDone(r)).length}`],
    ['done', 'Done'],
    ['app', 'App'],
    ['mail', 'hello@'],
  ]

  return (
    <>
      <div className="chips admin__filters" role="radiogroup" aria-label="Messages">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            className="chip"
            aria-checked={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {inboxError && (
        <p className="form-message form-message--error admin__inbox-off">hello@ couldn’t be read: {inboxError}</p>
      )}
      {shown.length === 0 && (
        <p className="admin__empty hand">{filter === 'new' ? 'nothing new' : 'nothing here yet'}</p>
      )}
      {shown.map((r, i) =>
        r.app ? (
          <AppMessage
            key={r.app.id}
            m={r.app}
            seed={90 + i}
            onToggle={() =>
              void run(async () => {
                await markMessage(r.app!.id, r.app!.status === 'new' ? 'done' : 'new')
                load()
                onChanged()
              }, setError)
            }
          />
        ) : (
          <MailThread key={r.mail!.id} t={r.mail!} seed={90 + i} onChanged={load} />
        ),
      )}
    </>
  )
}

function AppMessage({ m, seed, onToggle }: { m: AdminMessage; seed: number; onToggle: () => void }) {
  return (
    <SketchBox weight="light" className="admin__msg" seed={seed}>
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
        {[m.first_name ?? 'Someone', m.email ?? 'doesn’t want a reply', m.page, m.device].filter(Boolean).join(' · ')}
      </p>
      <p className="admin__actions">
        {m.email && (
          <a href={`mailto:${m.email}?subject=${encodeURIComponent('About your Voyage Fare feedback')}`}>
            Reply by email
          </a>
        )}
        <button type="button" className="link-button" onClick={onToggle}>
          {m.status === 'new' ? 'Done' : 'Back to new'}
        </button>
      </p>
    </SketchBox>
  )
}

/** "Talisa <talisa@…>" → "Talisa". */
const nameOf = (from: string) => from.replace(/<.*>/, '').replace(/"/g, '').trim() || from

function MailThread({ t, seed, onChanged }: { t: InboxThread; seed: number; onChanged: () => void }) {
  const [emails, setEmails] = useState<InboxEmail[]>()
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  const last = emails?.filter((e) => e.direction === 'inbound').at(-1)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !emails)
      inboxRead(t.id)
        .then(setEmails)
        .catch((e: Error) => setError(e.message))
  }

  return (
    <SketchBox weight="light" className="admin__msg" seed={seed}>
      <p className="admin__msg-head">
        <span className="admin__kind">
          <span className="admin__src admin__src--mail">@</span>
          {!t.done && !t.read && <span className="admin__dot" aria-hidden="true" />}
          {nameOf(t.from)} · hello@
        </span>
        <span className="admin__when">{when.format(new Date(t.received_at))}</span>
      </p>
      <p className="admin__text">
        <b>{t.subject ?? '(no subject)'}</b>
        {t.emails > 1 && ` · ${t.emails} emails`}
      </p>
      {open && !emails && !error && <p className="loading">Opening it…</p>}
      {open &&
        emails?.map((e) => (
          <div key={e.id} className={`admin__mail${e.direction === 'outbound' ? ' admin__mail--ours' : ''}`}>
            <p className="admin__meta">
              {e.direction === 'outbound' ? 'You, from hello@' : nameOf(e.from)} ·{' '}
              {when.format(new Date(e.received_at))}
              {e.attachments.length > 0 && ` · 📎 ${e.attachments.join(', ')}`}
            </p>
            <p className="admin__text">{e.text}</p>
          </div>
        ))}
      {open && last && !sent && (
        <div className="admin__reply">
          <label className="visually-hidden" htmlFor={`reply-${t.id}`}>
            Your reply
          </label>
          <textarea
            id={`reply-${t.id}`}
            className="field__input admin__reply-box"
            placeholder={`Hi ${nameOf(last.from).split(' ')[0]}…`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <p className="admin__reply-acts">
            <span>from hello@voyagefare.app</span>
            <button
              type="button"
              className="button button--primary"
              disabled={busy || !reply.trim()}
              onClick={() =>
                void run(async () => {
                  await inboxReply(t.id, last.id, reply)
                  setSent(true)
                  setReply('')
                  setEmails(undefined)
                  onChanged()
                }, setError)
              }
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </p>
        </div>
      )}
      {sent && <p className="admin__meta">✓ Sent from hello@voyagefare.app</p>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <p className="admin__actions">
        <button type="button" className="link-button" onClick={toggle}>
          {open ? 'Close' : 'Open'}
        </button>
        <button
          type="button"
          className="link-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await inboxDone(t.id, !t.done)
              onChanged()
            }, setError)
          }
        >
          {t.done ? 'Back to new' : 'Done'}
        </button>
      </p>
    </SketchBox>
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
