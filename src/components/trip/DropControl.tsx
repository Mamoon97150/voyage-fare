import { useState } from 'react'
import { setItemDropped, type Item } from '../../lib/trips'
import { FormMessage } from '../AuthForm'
import { useSaving } from '../../lib/useSaving'

/**
 * Drop a line you decided against, or bring it back (review 13 Nov). Dropped lines stay for
 * the record, greyed, out of the budget and the "to decide" dots. Booked ones go back to Chosen first.
 */
export function DropControl({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { busy, run } = useSaving()
  const [error, setError] = useState<string>()
  if (item.status === 'booked' || item.status === 'paid') return null
  const dropped = item.status === 'dropped'

  async function toggle() {
    setError(undefined)
    await run(async () => {
      await setItemDropped(item.id, !dropped)
      onChanged()
    }, setError)
  }

  return (
    <div className="drop-control">
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {dropped ? (
        <>
          <p className="field__hint">Dropped: kept for the record, not counted.</p>
          <button type="button" className="button button--quiet" onClick={() => void toggle()} disabled={busy}>
            Bring it back
          </button>
        </>
      ) : (
        <>
          <button type="button" className="link-button" onClick={() => void toggle()} disabled={busy}>
            Drop it
          </button>
          <span className="field__hint"> kept for the record, out of the budget</span>
        </>
      )}
    </div>
  )
}
