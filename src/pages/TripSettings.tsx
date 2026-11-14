import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { CityField } from '../components/CityField'
import { SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { amountForInput, formatMoney, parseAmount } from '../lib/money'
import { fetchRate, formatRate, parseRate } from '../lib/rates'
import type { CityValue } from '../lib/places'
import {
  addTraveller,
  cancelInvitation,
  inviteTraveller,
  joinLink,
  leaveTrip,
  listOpenInvitations,
  changeTripCurrency,
  deleteTrip,
  getTrip,
  isTripOwner,
  removeTraveller,
  renameTraveller,
  updateTrip,
  type Invitation,
  type Traveller,
  type TripDetail,
} from '../lib/trips'
import { CURRENCIES, currencyLabel, sentAgo } from '../lib/tripText'

/**
 * Trip settings (mockup 8): the trip, its budget, its travellers, and deleting it.
 * The main currency changes until the first payment (build 3). Invitations (build 6): each traveller
 * says where they stand, and "Invite" gives a link tied to that name.
 */
export function TripSettings() {
  const { tripId = '' } = useParams()
  const { session } = useAuth()
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [owner, setOwner] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([getTrip(tripId), session ? isTripOwner(tripId, session.user.id) : false])
      setDetail(d)
      setOwner(o)
    } catch (e) {
      setLoadError(explainAuthError(e as { message?: string }).message)
    }
  }, [tripId, session])

  useEffect(() => {
    let active = true
    Promise.all([getTrip(tripId), session ? isTripOwner(tripId, session.user.id) : false])
      .then(([d, o]) => {
        if (!active) return
        setDetail(d)
        setOwner(o)
      })
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [tripId, session])

  if (loadError) {
    return (
      <Screen tripId={tripId}>
        <FormMessage tone="error">{loadError}</FormMessage>
      </Screen>
    )
  }
  if (detail === undefined) return <Loading />
  if (detail === null) {
    return (
      <Screen tripId={tripId}>
        <p className="screen__intro">
          This trip isn’t here. <Link to="/trips">Back to your trips</Link>
        </p>
      </Screen>
    )
  }

  const reload = () => void load()

  return (
    <Screen tripId={tripId} name={detail.trip.name}>
      {/* Keyed on the currency: a change converts the target, so the form starts again from it. */}
      <TripForm key={detail.trip.currency} detail={detail} onSaved={reload} />
      <MainCurrency detail={detail} onChanged={reload} />
      <Travellers detail={detail} userId={session?.user.id} owner={owner} onChanged={reload} />
      {owner ? <DeleteTrip detail={detail} owner={owner} /> : <LeaveTrip detail={detail} />}
    </Screen>
  )
}

function Screen({ tripId, name, children }: { tripId: string; name?: string; children: React.ReactNode }) {
  return (
    <div className="screen">
      <header className="screen__top">
        <Link to={`/trips/${tripId}`} className="round-button" aria-label="Back to the trip">
          ‹
        </Link>
        <h1 className="screen__title">Trip settings</h1>
      </header>
      {name && <p className="screen__meta">{name}</p>}
      <div className="screen__body">{children}</div>
    </div>
  )
}

/** Name, dates, leaving from, and the target: one form, one Save. */
function TripForm({ detail, onSaved }: { detail: TripDetail; onSaved: () => void }) {
  const { trip } = detail
  const [name, setName] = useState(trip.name)
  const [noDates, setNoDates] = useState(!trip.start_date)
  const [start, setStart] = useState(trip.start_date ?? '')
  const [end, setEnd] = useState(trip.end_date ?? '')
  const [home, setHome] = useState<CityValue>({
    name: trip.home_city ?? '',
    country: null,
    latitude: trip.home_latitude,
    longitude: trip.home_longitude,
  })
  const [target, setTarget] = useState(amountForInput(trip.target_amount))
  const [scope, setScope] = useState<'per_person' | 'total'>(trip.target_scope === 'total' ? 'total' : 'per_person')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string }>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give the trip a name.'
    if (!noDates) {
      if (!start || !end) found.dates = 'Choose both days, or tick “Dates not decided yet”.'
      else if (end < start) found.dates = 'The trip ends before it starts.'
    }
    const amount = target.trim() ? parseAmount(target) : null
    if (target.trim() && amount === null) found.target = 'Enter an amount, like 2 500.'
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await updateTrip(trip.id, {
        name: name.trim(),
        startDate: noDates ? null : start,
        endDate: noDates ? null : end,
        homeCity: home.name.trim() || null,
        homeLatitude: home.name.trim() ? home.latitude : null,
        homeLongitude: home.name.trim() ? home.longitude : null,
        targetAmount: amount,
        targetScope: scope,
      })
      setMessage({ tone: 'info', text: 'Saved.' })
      onSaved()
    } catch (error) {
      setMessage({ tone: 'error', text: explainAuthError(error as { message?: string }).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="settings__form">
      <SketchBox weight="light" className="form__sheet" seed={71}>
        <h2 className="sheet-title">The trip</h2>
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor="settings-name" className="field__label">
            Name
          </label>
          <input
            id="settings-name"
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'settings-name-error' : undefined}
          />
          {errors.name && (
            <p id="settings-name-error" className="field__error">
              {errors.name}
            </p>
          )}
        </div>
        <fieldset className={`dates${errors.dates ? ' field--error' : ''}`}>
          <legend className="field__label">Dates</legend>
          {!noDates && (
            <div className="row2">
              <label className="field">
                <span className="field__hint">From</span>
                <input type="date" className="field__input" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__hint">To</span>
                <input type="date" className="field__input" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={noDates} onChange={(e) => setNoDates(e.target.checked)} />
            Dates not decided yet
          </label>
          {errors.dates && <p className="field__error">{errors.dates}</p>}
        </fieldset>
        <CityField
          id="settings-home"
          label="Leaving from"
          value={home}
          onChange={setHome}
          placeholder="St Martin"
          hint="Where the trip starts and ends."
        />
      </SketchBox>

      <SketchBox weight="light" className="form__sheet" seed={72}>
        <h2 className="sheet-title">Budget</h2>
        <div className={`field${errors.target ? ' field--error' : ''}`}>
          <label htmlFor="settings-target" className="field__label">
            Target
          </label>
          <div className="field__box">
            <input
              id="settings-target"
              className="field__input num"
              inputMode="decimal"
              placeholder="No target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={errors.target ? true : undefined}
              aria-describedby={errors.target ? 'settings-target-error' : undefined}
            />
            <span className="field__unit">{trip.currency}</span>
          </div>
          {errors.target && (
            <p id="settings-target-error" className="field__error">
              {errors.target}
            </p>
          )}
          <div className="switch" role="radiogroup" aria-label="Target for">
            <button type="button" role="radio" aria-checked={scope === 'per_person'} onClick={() => setScope('per_person')}>
              Per person
            </button>
            <button type="button" role="radio" aria-checked={scope === 'total'} onClick={() => setScope('total')}>
              Whole trip
            </button>
          </div>
        </div>
      </SketchBox>

      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <button type="submit" className="button button--primary button--wide" disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'Saving…' : 'Save the trip'}
      </button>
    </form>
  )
}

/**
 * The main currency: totals, the target and who-owes-whom are in it. It can change until the
 * first payment (decision 12 Nov); every price keeps its own currency and its rate is converted.
 */
function MainCurrency({ detail, onChanged }: { detail: TripDetail; onChanged: () => void }) {
  const from = detail.trip.currency
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [inverted, setInverted] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const fixed = detail.items.some((i) => i.status === 'paid')

  async function pick(next: string) {
    setTo(next)
    setError(undefined)
    if (!next) return
    setState('loading')
    const r = await fetchRate(from, next)
    if (r === null) {
      setText('')
      setState('failed')
      return
    }
    setInverted(r < 1)
    setText(formatRate(r < 1 ? 1 / r : r))
    setShown(r < 1 ? 1 / r : r)
    setState('idle')
  }

  const [shown, setShown] = useState<number | null>(null)
  const typed = text.trim() ? parseRate(text, shown) : null
  // What 1 of the current currency is worth in the new one.
  const rate = typed !== null ? (inverted ? 1 / typed : typed) : null
  const target = detail.trip.target_amount === null ? null : Number(detail.trip.target_amount)

  async function change() {
    if (!to || rate === null) {
      setError(text.trim() ? 'That rate doesn’t look right: type it like 1,1531.' : `What’s the rate? 1 ${from} is how many ${to}?`)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await changeTripCurrency(detail.trip.id, to, Math.round(rate * 1e8) / 1e8)
      setOpen(false)
      setTo('')
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SketchBox weight="light" className="form__sheet" seed={73}>
      <h2 className="sheet-title">Main currency</h2>
      <div className="kv">
        <span>Totals and shares in</span>
        <b>{currencyLabel(from)}</b>
      </div>
      {fixed ? (
        <p className="field__hint">Fixed since the first payment: who owes whom is counted in it.</p>
      ) : !open ? (
        <>
          <p className="field__hint">It can change until the first payment; after that it’s fixed.</p>
          <button type="button" className="button button--quiet" onClick={() => setOpen(true)}>
            Change the main currency
          </button>
        </>
      ) : (
        <div className="currency-change">
          <div className="field">
            <label htmlFor="new-currency" className="field__label">
              New main currency
            </label>
            <select id="new-currency" className="field__input" value={to} onChange={(e) => void pick(e.target.value)}>
              <option value="">Pick one</option>
              {CURRENCIES.filter((c) => c !== from).map((c) => (
                <option key={c} value={c}>
                  {currencyLabel(c)}
                </option>
              ))}
            </select>
          </div>
          {to && (
            <div className="field">
              <label htmlFor="new-currency-rate" className="field__label">
                Rate
              </label>
              <div className="field__box rate">
                <span className="rate__left num">1 {inverted ? to : from} =</span>
                <input
                  id="new-currency-rate"
                  className="field__input num"
                  inputMode="decimal"
                  value={text}
                  placeholder={state === 'loading' ? '…' : ''}
                  onChange={(e) => setText(e.target.value)}
                />
                <span className="field__unit">{inverted ? from : to}</span>
              </div>
              <p className="field__hint">
                {state === 'loading'
                  ? 'Getting today’s rate…'
                  : state === 'failed'
                    ? 'Couldn’t get today’s rate: type it.'
                    : 'Today’s rate. Every price keeps its own currency; the ones in ' + from + ' are converted with it.'}
                {target !== null && rate !== null && (
                  <b className="num"> Your target becomes {formatMoney(Math.round(target * rate), to)}.</b>
                )}
              </p>
            </div>
          )}
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="button button--primary" disabled={busy || !to} onClick={() => void change()}>
              {busy ? 'Changing…' : to ? `Change to ${to}` : 'Change'}
            </button>
          </div>
        </div>
      )}
    </SketchBox>
  )
}

/** Each traveller has their own share. Rename, add, or remove (when it's safe). */
function Travellers({
  detail,
  userId,
  owner,
  onChanged,
}: {
  detail: TripDetail
  userId?: string
  owner: boolean
  onChanged: () => void
}) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [invites, setInvites] = useState<Invitation[]>([])
  const travellers = detail.travellers
  const tripId = detail.trip.id
  const canInvite = !detail.trip.is_demo

  const loadInvites = useCallback(() => {
    listOpenInvitations(tripId)
      .then(setInvites)
      .catch(() => setInvites([]))
  }, [tripId])
  useEffect(() => {
    let active = true
    listOpenInvitations(tripId)
      .then((list) => active && setInvites(list))
      .catch(() => active && setInvites([]))
    return () => {
      active = false
    }
  }, [tripId, travellers.length])

  async function add(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    if (!newName.trim()) {
      setError('Type a name first.')
      return
    }
    setBusy(true)
    try {
      await addTraveller(detail.trip.id, newName.trim(), Math.max(0, ...travellers.map((t) => t.position)) + 1)
      setNewName('')
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <SketchBox weight="strong" tape="green" className="form__sheet settings__travellers" seed={73}>
      <h2 className="sheet-title">
        Travellers <small className="sheet-title__note hand-note">each has their own share</small>
      </h2>
      <ul className="people">
        {travellers.map((t) => (
          <TravellerRow
            key={t.id}
            traveller={t}
            isYou={Boolean(t.user_id && t.user_id === userId)}
            isCreator={Boolean(t.user_id && t.user_id === detail.trip.created_by)}
            amOwner={owner}
            canInvite={canInvite && travellers.length > 1}
            invite={invites.find((i) => i.traveller_id === t.id)}
            onChanged={onChanged}
            onInvitesChanged={loadInvites}
          />
        ))}
      </ul>
      <form onSubmit={add} noValidate className="settings__add">
        <label htmlFor="settings-new-traveller" className="visually-hidden">
          New traveller
        </label>
        <input
          id="settings-new-traveller"
          className="field__input"
          placeholder="Add someone: Dana"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="button button--quiet" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </SketchBox>
    {canInvite && travellers.length > 1 && (
      <p className="settings__margin-note">No need to invite everyone: a name is enough to count their share.</p>
    )}
    </>
  )
}

function TravellerRow({
  traveller,
  isYou,
  isCreator,
  amOwner,
  canInvite,
  invite,
  onChanged,
  onInvitesChanged,
}: {
  traveller: Traveller
  isYou: boolean
  isCreator: boolean
  amOwner: boolean
  canInvite: boolean
  invite?: Invitation
  onChanged: () => void
  onInvitesChanged: () => void
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'remove'>('view')
  const [showLink, setShowLink] = useState(false)
  const onTrip = Boolean(traveller.user_id)
  // Someone who opens the trip with their own account: only the creator removes them.
  const removable = !isYou && (!onTrip || amOwner)
  const [name, setName] = useState(traveller.name)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      setMode('view')
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="people__row">
      <div className="people__line">
        <span className={`avatar${isYou ? ' avatar--me' : ''}`} aria-hidden="true">
          {traveller.name.slice(0, 1).toUpperCase()}
        </span>
        {mode === 'rename' ? (
          <form
            className="settings__rename"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) void run(() => renameTraveller(traveller.id, name.trim()))
            }}
          >
            <input
              className="field__input people__input"
              aria-label={`New name for ${traveller.name}`}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="button button--quiet" disabled={busy}>
              Save
            </button>
          </form>
        ) : (
          <span className="people__name">
            <b>{traveller.name}</b>
            <TravellerState isYou={isYou} isCreator={isCreator} onTrip={onTrip} invite={invite} canInvite={canInvite} />
          </span>
        )}
        {mode === 'view' && (
          <>
            <button type="button" className="place__edit" onClick={() => setMode('rename')} aria-label={`Rename ${traveller.name}`}>
              Rename
            </button>
            {removable && (
              <button
                type="button"
                className="people__remove"
                onClick={() => setMode('remove')}
                aria-label={`Remove ${traveller.name}`}
              >
                ✕
              </button>
            )}
          </>
        )}
        {mode === 'rename' && (
          <button type="button" className="place__edit" onClick={() => setMode('view')}>
            Cancel
          </button>
        )}
      </div>
      {mode === 'view' && canInvite && !onTrip && (
        <InviteActions
          traveller={traveller}
          invite={invite}
          open={showLink}
          onOpen={setShowLink}
          onInvitesChanged={onInvitesChanged}
        />
      )}
      {mode === 'remove' && (
        <div className="confirm-delete">
          <p className="field__hint">
            Their share is spread over the others.{onTrip ? ` ${traveller.name} won’t see the trip any more.` : ''}
          </p>
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setMode('view')} disabled={busy}>
              Keep {traveller.name}
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void run(() => removeTraveller(traveller.id))}
              disabled={busy}
            >
              {busy ? 'Removing…' : `Yes, remove ${traveller.name}`}
            </button>
          </div>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </li>
  )
}

/** Only the person who created the trip can delete it; it asks once and says what goes. */
function DeleteTrip({ detail, owner }: { detail: TripDetail; owner: boolean }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const name = detail.trip.name

  async function remove() {
    setBusy(true)
    setError(undefined)
    try {
      await deleteTrip(detail.trip.id)
      navigate('/trips', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <SketchBox weight="light" dashed className="form__sheet settings__danger" seed={74}>
      <h2 className="sheet-title">Delete the trip</h2>
      {!owner ? (
        <p className="field__hint">Only the person who created this trip can delete it.</p>
      ) : confirming ? (
        <div className="confirm-delete">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <p className="field__hint">
            Everything in {name} goes: places, items, tickets, for everyone on it. This can’t be undone.
          </p>
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </button>
            <button type="button" className="button button--danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : `Yes, delete ${name}`}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="link-button add-item__delete" onClick={() => setConfirming(true)}>
          Delete {name}
        </button>
      )}
    </SketchBox>
  )
}

/** Where a traveller stands: small caps for the status, handwriting for the detail. */
function TravellerState({
  isYou,
  isCreator,
  onTrip,
  invite,
  canInvite,
}: {
  isYou: boolean
  isCreator: boolean
  onTrip: boolean
  invite?: Invitation
  canInvite: boolean
}) {
  if (isYou) return <small className="people__state">{isCreator ? 'You · created the trip' : 'You'}</small>
  if (onTrip)
    return (
      <>
        <small className="people__state people__state--in">On the trip</small>
        <span className="people__hand">opens it on their phone</span>
      </>
    )
  if (invite)
    return (
      <>
        <small className="people__state people__state--wait">Invited</small>
        <span className="people__hand">{sentAgo(invite.created_at)}, not opened yet</span>
      </>
    )
  if (!canInvite) return null
  return <small className="people__state">Not invited yet</small>
}

/** "Invite" opens the link right there; an invited name can get it again or cancel it. */
function InviteActions({
  traveller,
  invite,
  open,
  onOpen,
  onInvitesChanged,
}: {
  traveller: Traveller
  invite?: Invitation
  open: boolean
  onOpen: (open: boolean) => void
  onInvitesChanged: () => void
}) {
  const [link, setLink] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()

  async function getLink() {
    setBusy(true)
    setError(undefined)
    try {
      const { token } = await inviteTraveller(traveller.id)
      setLink(joinLink(token))
      onOpen(true)
      onInvitesChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    setError(undefined)
    try {
      await cancelInvitation(traveller.id)
      setLink(undefined)
      onOpen(false)
      onInvitesChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!link) return
    const text = `Join our trip on Voyage Fare: you’re ${traveller.name} on it.`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Voyage Fare', text, url: link })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await copy()
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Couldn’t copy it: select the link and copy it by hand.')
    }
  }

  return (
    <div className="invite">
      {!open && (
        <div className="invite__buttons">
          {invite ? (
            <>
              <button type="button" className="button button--small" onClick={getLink} disabled={busy}>
                Send the link again
              </button>
              <button type="button" className="button button--small" onClick={cancel} disabled={busy}>
                Cancel the invite
              </button>
            </>
          ) : (
            <button type="button" className="button button--small invite__open" onClick={getLink} disabled={busy}>
              {busy ? 'Making the link…' : 'Invite'}
            </button>
          )}
        </div>
      )}
      {open && link && (
        <div className="invite__box">
          <p>
            Send {traveller.name} this link. When they open it and sign in, they join the trip{' '}
            <b>as {traveller.name}</b>, and see their own share.
          </p>
          <input
            className="invite__link"
            readOnly
            value={link}
            aria-label={`Link for ${traveller.name}`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="invite__row">
            <button type="button" className="button button--primary" onClick={share}>
              Share…
            </button>
            <button type="button" className="button button--quiet" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <span className="invite__arrow">↑ WhatsApp, Messages, mail…</span>
          <p className="people__hand">works once · for 14 days · you can cancel it</p>
          <div className="invite__buttons">
            <button type="button" className="link-button" onClick={() => onOpen(false)}>
              Done
            </button>
            <span aria-hidden="true"> · </span>
            <button type="button" className="link-button" onClick={cancel} disabled={busy}>
              Cancel the invite
            </button>
          </div>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}

/** For someone invited: leave the trip, and go back to being a name on the notebook. */
function LeaveTrip({ detail }: { detail: TripDetail }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function leave() {
    setBusy(true)
    setError(undefined)
    try {
      await leaveTrip(detail.trip.id)
      navigate('/trips', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <SketchBox weight="light" dashed className="form__sheet settings__danger" seed={75}>
      <h2 className="sheet-title">Leave the trip</h2>
      {confirming ? (
        <div className="confirm-delete">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <p className="field__hint">
            You won’t see {detail.trip.name} any more. You stay a name on the trip: your share and what you paid don’t
            change. To come back, ask for a new link.
          </p>
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setConfirming(false)} disabled={busy}>
              Stay
            </button>
            <button type="button" className="button button--danger" onClick={leave} disabled={busy}>
              {busy ? 'Leaving…' : 'Yes, leave the trip'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="link-button add-item__delete" onClick={() => setConfirming(true)}>
          Leave {detail.trip.name}
        </button>
      )}
    </SketchBox>
  )
}
