import { useState, type FormEvent } from 'react'
import { parseAmount } from '../../lib/money'
import { useRate } from '../../lib/rates'
import { addCash, type TripDetail } from '../../lib/trips'
import { isSolo } from '../../lib/tripView'
import { joinNames } from '../../lib/moneyPages'
import { useSaving } from '../../lib/useSaving'
import { FormMessage } from '../AuthForm'
import { CurrencyPicker, RateField } from '../RateField'

type Category = 'local_transport' | 'food' | 'activities' | 'buffer'
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'local_transport', label: 'Getting around' },
  { key: 'food', label: 'Food' },
  { key: 'activities', label: 'Activities' },
  { key: 'buffer', label: 'Other' },
]

/**
 * "I paid cash" (build 10, mockup money-v6 screen 6): an amount (rough is fine), a word, a
 * category. Who paid and who it's for default to you. It counts as paid straight away.
 */
export function CashForm({
  detail,
  placeId,
  day,
  viewer,
  onDone,
  onCancel,
}: {
  detail: TripDetail
  placeId: string | null
  day?: number
  viewer: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const trip = detail.trip.currency
  const me = viewer ?? detail.travellers[0]?.id ?? ''
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('local_transport')
  const [paidBy, setPaidBy] = useState(me)
  // Who it's for: a key — "me", "all", a group id, or a traveller id.
  const [forWho, setForWho] = useState<string>(isSolo(detail) ? 'all' : 'me')
  const rate = useRate(trip, trip, 1)
  const { busy, run } = useSaving()
  const [error, setError] = useState<string>()
  const id = `cash-${placeId ?? 'trip'}-${day ?? ''}`
  const typed = amount.trim() ? parseAmount(amount) : null
  const groups = [...new Set(detail.travellers.map((t) => t.pay_group_id).filter(Boolean))] as string[]
  const members = (g: string) => detail.travellers.filter((t) => t.pay_group_id === g)

  function forIds(): string[] {
    if (forWho === 'all') return []
    if (forWho === 'me') return [paidBy]
    if (groups.includes(forWho)) return members(forWho).map((t) => t.id)
    return [forWho]
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (typed === null || typed <= 0) return setError('How much? Like 40.')
    if (!name.trim()) return setError('Say what it was for, in a word.')
    const foreign = rate.currency !== trip
    if (foreign && rate.rate === null) return setError(`What’s the rate? 1 ${rate.currency} is how many ${trip}?`)
    setError(undefined)
    await run(async () => {
      await addCash({
        tripId: detail.trip.id,
        amount: typed,
        name: name.trim(),
        category,
        paidBy,
        for: forIds(),
        placeId,
        day: day ?? null,
        ...(foreign ? { currency: rate.currency, rate: rate.rate! } : {}),
      })
      onDone()
    }, setError)
  }

  return (
    <form className="add-item cash-form" onSubmit={submit} noValidate aria-label="I paid cash">
      <h3 className="sheet-title">I paid cash</h3>
      <div className="field">
        <label htmlFor={`${id}-amount`} className="field__label">
          About how much
        </label>
        <div className="field__box cash-form__amount">
          <span className="cash-form__about" aria-hidden="true">
            ≈
          </span>
          <input
            id={`${id}-amount`}
            className="field__input num"
            inputMode="decimal"
            value={amount}
            autoFocus
            placeholder="40"
            onChange={(e) => setAmount(e.target.value)}
          />
          <CurrencyPicker id={`${id}-currency`} rate={rate} />
        </div>
        <RateField id={`${id}-rate`} rate={rate} amount={typed} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`} className="field__label">
          For what
        </label>
        <input
          id={`${id}-name`}
          className="field__input"
          value={name}
          placeholder="Taxi to the old town"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="chip-grid" role="radiogroup" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={category === c.key}
            className="chip chip--pick"
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {!isSolo(detail) && (
        <div className="row2">
          <div className="field">
            <label htmlFor={`${id}-by`} className="field__label">
              Who paid
            </label>
            <select id={`${id}-by`} className="field__input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {detail.travellers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === viewer ? 'Me' : t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-for`} className="field__label">
              For
            </label>
            <select
              id={`${id}-for`}
              className="field__input"
              value={forWho}
              onChange={(e) => setForWho(e.target.value)}
            >
              <option value="me">{paidBy === viewer ? 'Just me' : 'Just them'}</option>
              <option value="all">Everyone</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {joinNames(members(g).map((t) => t.name))}
                </option>
              ))}
              {detail.travellers
                .filter((t) => t.id !== paidBy)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="add-item__actions">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  )
}
