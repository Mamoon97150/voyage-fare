import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { CityField } from '../components/CityField'
import { SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { amountForInput, formatMoney, parseAmount } from '../lib/money'
import { fetchRate, formatRate } from '../lib/rates'
import type { CityValue } from '../lib/places'
import {
  addTraveller,
  changeTripCurrency,
  deleteTrip,
  getTrip,
  isTripOwner,
  removeTraveller,
  renameTraveller,
  updateTrip,
  type Traveller,
  type TripDetail,
} from '../lib/trips'
import { CURRENCIES, currencyLabel } from '../lib/tripText'

/**
 * Trip settings (mockup 8): the trip, its budget, its travellers, and deleting it.
 * The main currency changes until the first payment (build 3); inviting comes with invitations.
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
      <Travellers detail={detail} userId={session?.user.id} onChanged={reload} />
      <DeleteTrip detail={detail} owner={owner} />
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
    setState('idle')
  }

  const typed = text.trim() ? parseAmount(text) : null
  // What 1 of the current currency is worth in the new one.
  const rate = typed !== null && typed > 0 ? (inverted ? 1 / typed : typed) : null
  const target = detail.trip.target_amount === null ? null : Number(detail.trip.target_amount)

  async function change() {
    if (!to || rate === null) {
      setError(`What’s the rate? 1 ${from} is how many ${to}?`)
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
function Travellers({ detail, userId, onChanged }: { detail: TripDetail; userId?: string; onChanged: () => void }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const travellers = detail.travellers

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
    <SketchBox weight="light" className="form__sheet" seed={73}>
      <h2 className="sheet-title">
        Travellers <small className="sheet-title__note">each has their own share</small>
      </h2>
      <ul className="people">
        {travellers.map((t) => (
          <TravellerRow key={t.id} traveller={t} isYou={Boolean(t.user_id && t.user_id === userId)} onChanged={onChanged} />
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
  )
}

function TravellerRow({ traveller, isYou, onChanged }: { traveller: Traveller; isYou: boolean; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'rename' | 'remove'>('view')
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
            {isYou && <small>You</small>}
          </span>
        )}
        {mode === 'view' && (
          <>
            <button type="button" className="place__edit" onClick={() => setMode('rename')} aria-label={`Rename ${traveller.name}`}>
              Rename
            </button>
            {!isYou && (
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
      {mode === 'remove' && (
        <div className="confirm-delete">
          <p className="field__hint">Their share is spread over the others.</p>
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
