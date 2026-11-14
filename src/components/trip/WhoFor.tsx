import { useState } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { Link } from 'react-router'
import { compareLink, roomsOf } from '../../lib/options'
import { setItemSplit, type Item, type TripDetail } from '../../lib/trips'
import { FormMessage } from '../AuthForm'

/**
 * "Split between…" (SR-3, build 4): who a line is for. Everyone by default; tap a name to take
 * them off (a gift: everyone but Peggy) or keep just one (the jet-ski). It saves on the tap.
 * The last person can't be taken off: a line is for someone.
 */
export function WhoFor({ detail, item, onChanged }: { detail: TripDetail; item: Item; onChanged: () => void }) {
  const everyone = detail.travellers.map((t) => t.id)
  const from = detail.shares.filter((s) => s.item_id === item.id && Number(s.fraction) > 0).map((s) => s.traveller_id as string)
  const [on, setOn] = useState<string[]>(from.length ? from : everyone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (detail.travellers.length < 2) return null

  // A stay by room is split by its rooms (SR-4): say who's where, and change it in Compare.
  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  const rooms = chosen ? roomsOf(detail, chosen.id) : []
  if (rooms.length) {
    const name = (id: string) => detail.travellers.find((t) => t.id === id)?.name
    const link = compareLink(detail, item)
    return (
      <div className="who-for">
        <p className="field__label">Who it’s for</p>
        <p className="field__hint">
          Split by room: {rooms.map((r) => (r.occupants.length ? r.occupants.map(name).join(' & ') : `${r.name}: everyone`)).join(' · ')}.{' '}
          {link && <Link to={link}>Change the rooms in Compare ›</Link>}
        </p>
      </div>
    )
  }

  async function toggle(id: string) {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id]
    if (next.length === 0) return
    const before = on
    setOn(next)
    setBusy(true)
    setError(undefined)
    try {
      await setItemSplit(item.id, next.length === everyone.length ? [] : next)
      onChanged()
    } catch (e) {
      setOn(before)
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  const out = detail.travellers.filter((t) => !on.includes(t.id)).map((t) => t.name)
  return (
    <div className="who-for" role="group" aria-labelledby={`who-for-${item.id}`}>
      <p id={`who-for-${item.id}`} className="field__label">
        Who it’s for
      </p>
      <div className="who-for__names">
        {detail.travellers.map((t) => {
          const picked = on.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className="chip"
              aria-pressed={picked}
              disabled={busy || (picked && on.length === 1)}
              onClick={() => void toggle(t.id)}
            >
              {t.name}
            </button>
          )
        })}
      </div>
      <p className="field__hint">
        {out.length === 0
          ? 'Everyone: split equally.'
          : on.length === 1
            ? `Just ${detail.travellers.find((t) => t.id === on[0])?.name}.`
            : `Split between ${on.length}: not ${out.join(', ')}.`}
      </p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}
