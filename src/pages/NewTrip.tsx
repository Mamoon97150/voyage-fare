import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { CityField } from '../components/CityField'
import { emptyCity, type CityValue } from '../lib/places'
import { SketchBox } from '../components/Sketch'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { createTrip } from '../lib/trips'
import { parseAmount } from '../lib/money'
import { CURRENCIES, currencyLabel } from '../lib/tripText'

type Step = 1 | 2 | 3

/** Mockup 7: three short steps. Only the name is required; everything else can be set later. */
export function NewTrip() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const me = (session?.user.user_metadata?.first_name as string | undefined) ?? 'Me'

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [home, setHome] = useState<CityValue>(emptyCity)
  const [noDates, setNoDates] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [others, setOthers] = useState<string[]>([''])
  const [currency, setCurrency] = useState('EUR')
  const [target, setTarget] = useState('')
  const [scope, setScope] = useState<'per_person' | 'total'>('per_person')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)

  function checkStep1() {
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give the trip a name.'
    if (!noDates) {
      if (!start || !end) found.dates = 'Choose both days, or tick “Dates not decided yet”.'
      else if (end < start) found.dates = 'The trip ends before it starts.'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  function checkTarget() {
    if (!target.trim()) return true
    if (parseAmount(target) === null) {
      setErrors({ target: 'Enter an amount, like 2500.' })
      return false
    }
    return true
  }

  async function create(withTarget: boolean) {
    setFormError(undefined)
    if (withTarget && !checkTarget()) return
    setBusy(true)
    try {
      const amount = withTarget && target.trim() ? parseAmount(target) : null
      const id = await createTrip({
        name: name.trim(),
        me,
        travellers: others.map((o) => o.trim()).filter(Boolean),
        startDate: noDates ? null : start,
        endDate: noDates ? null : end,
        homeCity: home.name.trim() || null,
        homeLatitude: home.latitude,
        homeLongitude: home.longitude,
        currency,
        targetAmount: amount,
        targetScope: scope,
      })
      navigate(`/trips/${id}`, { replace: true })
    } catch (error) {
      setBusy(false)
      setFormError(explainAuthError(error as { message?: string }).message)
    }
  }

  function next(event: FormEvent) {
    event.preventDefault()
    if (step === 1 && checkStep1()) setStep(2)
    else if (step === 2) setStep(3)
    else if (step === 3) void create(true)
  }

  return (
    <div className="screen">
      <header className="screen__top">
        {step === 1 ? (
          <Link to="/trips" className="round-button" aria-label="Cancel">
            ✕
          </Link>
        ) : (
          <button type="button" className="round-button" aria-label="Back" onClick={() => setStep((s) => (s - 1) as Step)}>
            ‹
          </button>
        )}
        <span className="screen__title">New trip</span>
        <span className="steps" aria-label={`Step ${step} of 3`}>
          <b>{step}</b> of 3
        </span>
      </header>
      <div className="stepbar" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= step ? 'on' : undefined} />
        ))}
      </div>

      <form onSubmit={next} noValidate className="screen__body">
        {step === 1 && (
          <>
            <h1 className="screen__lead">Where are you going?</h1>
            <SketchBox tape="mustard" className="form__sheet" seed={11}>
              <div className={`field${errors.name ? ' field--error' : ''}`}>
                <label htmlFor="trip-name" className="field__label">
                  Trip name
                </label>
                <input
                  id="trip-name"
                  className="field__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Colombia with my sisters"
                  autoFocus
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'trip-name-error' : undefined}
                />
                {errors.name && (
                  <p id="trip-name-error" className="field__error">
                    {errors.name}
                  </p>
                )}
              </div>
              <CityField
                id="home-city"
                label="Leaving from"
                value={home}
                onChange={setHome}
                placeholder="St Martin"
                hint="Where the trip starts and ends. Draws the route on the map."
              />
              <fieldset className={`dates${errors.dates ? ' field--error' : ''}`} aria-describedby={errors.dates ? 'dates-error' : undefined}>
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
                {errors.dates && (
                  <p id="dates-error" className="field__error">
                    {errors.dates}
                  </p>
                )}
              </fieldset>
            </SketchBox>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="screen__lead">Who’s coming?</h1>
            <p className="screen__intro">Names only. No account needed: each person gets their own share.</p>
            <SketchBox tape="green" className="form__sheet" seed={12}>
              <ul className="people">
                <li>
                  <span className="avatar avatar--me">{me.slice(0, 1).toUpperCase()}</span>
                  <span className="people__name">
                    <b>{me}</b>
                    <small>You</small>
                  </span>
                </li>
                {others.map((other, i) => (
                  <li key={i}>
                    <span className="avatar">{other.trim().slice(0, 1).toUpperCase() || '?'}</span>
                    <input
                      className="field__input people__input"
                      aria-label={`Traveller ${i + 2}`}
                      placeholder="Name"
                      value={other}
                      autoFocus={i === others.length - 1 && i > 0}
                      onChange={(e) => setOthers((list) => list.map((o, j) => (j === i ? e.target.value : o)))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (other.trim()) setOthers((list) => [...list, ''])
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="people__remove"
                      aria-label={`Remove ${other.trim() || 'this traveller'}`}
                      onClick={() => setOthers((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : ['']))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="add-row" onClick={() => setOthers((list) => [...list, ''])}>
                <span className="add-row__plus" aria-hidden="true">
                  +
                </span>
                Add a traveller
              </button>
            </SketchBox>
            <p className="screen__note">You can invite them to edit the trip later, from its settings.</p>
            <button
              type="button"
              className="link-button screen__skip"
              onClick={() => {
                setOthers([''])
                setStep(3)
              }}
            >
              It’s just me
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="screen__lead">What’s the budget?</h1>
            <p className="screen__intro">A target helps you see when you go over. You can change it any time.</p>
            <SketchBox tape="mustard" className="form__sheet" seed={13}>
              <div className="field">
                <label htmlFor="currency" className="field__label">
                  Main currency
                </label>
                <select id="currency" className="field__input" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-describedby="currency-hint">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {currencyLabel(c)}
                    </option>
                  ))}
                </select>
                <p id="currency-hint" className="field__hint">
                  Totals and who-owes-whom are in this currency. Prices in pesos or dollars are converted. You can change it until the first payment.
                </p>
              </div>
              <div className={`field${errors.target ? ' field--error' : ''}`}>
                <label htmlFor="target" className="field__label">
                  Target
                </label>
                <div className="field__box">
                  <input
                    id="target"
                    className="field__input num"
                    inputMode="decimal"
                    placeholder="2 500"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    aria-invalid={errors.target ? true : undefined}
                    aria-describedby={errors.target ? 'target-error' : undefined}
                  />
                  <span className="field__unit">{currency}</span>
                </div>
                {errors.target && (
                  <p id="target-error" className="field__error">
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
          </>
        )}

        {formError && <FormMessage tone="error">{formError}</FormMessage>}

        <button type="submit" className="button button--primary button--wide" disabled={busy} aria-busy={busy || undefined}>
          {step < 3 ? 'Next' : busy ? 'Creating the trip…' : 'Create the trip'}
        </button>
        {step === 3 && (
          <button type="button" className="link-button screen__skip" disabled={busy} onClick={() => void create(false)}>
            No target for now
          </button>
        )}
      </form>
    </div>
  )
}
