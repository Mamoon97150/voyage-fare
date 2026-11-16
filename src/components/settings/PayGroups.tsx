import { useState } from 'react'
import { FormMessage } from '../AuthForm'
import { joinNames } from '../../lib/moneyPages'
import { removePayGroup, setPayGroup, type TripDetail } from '../../lib/trips'
import { useSaving } from '../../lib/useSaving'

/**
 * Who pays together (build 10, mockup money-v6 screen 1): couples, sisters, a family. Each group
 * settles up as one in Who paid what; everyone keeps their own share. Only shown with 3+ travellers
 * (with 2, a group would mean nothing to settle).
 */
export function PayGroups({ detail, onChanged }: { detail: TripDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const travellers = detail.travellers
  if (travellers.length < 3) return null
  const groups = [...new Set(travellers.map((t) => t.pay_group_id).filter(Boolean))] as string[]
  const members = (g: string) => travellers.filter((t) => t.pay_group_id === g)
  const readOnly = detail.trip.is_demo

  return (
    <section className="pay-groups" aria-labelledby="pay-groups-title">
      <h3 className="pay-groups__title" id="pay-groups-title">
        Who pays together
      </h3>
      {groups.length === 0 && editing === null && (
        <p className="field__hint">A couple, sisters, a family… they settle up as one. Each keeps their own share.</p>
      )}
      <ul className="pay-groups__list">
        {groups.map((g) =>
          editing === g ? (
            <li key={g}>
              <GroupPicker detail={detail} groupId={g} onDone={() => setEditing(null)} onChanged={onChanged} />
            </li>
          ) : (
            <li key={g} className="pay-groups__tie">
              <span className="avatars" aria-hidden="true">
                {members(g).map((m) => (
                  <span key={m.id} className="avatar">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
              <span>
                <b>{joinNames(members(g).map((m) => m.name))}</b>
                <small>one share in the balances</small>
              </span>
              {!readOnly && (
                <button type="button" className="link-button" onClick={() => setEditing(g)}>
                  Change
                </button>
              )}
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <GroupPicker detail={detail} groupId={null} onDone={() => setEditing(null)} onChanged={onChanged} />
      ) : (
        !readOnly && (
          <button type="button" className="add-row" onClick={() => setEditing('new')}>
            <span className="add-row__plus" aria-hidden="true">
              +
            </span>
            People who pay together
          </button>
        )
      )}
    </section>
  )
}

function GroupPicker({
  detail,
  groupId,
  onDone,
  onChanged,
}: {
  detail: TripDetail
  groupId: string | null
  onDone: () => void
  onChanged: () => void
}) {
  const [picked, setPicked] = useState<string[]>(
    groupId ? detail.travellers.filter((t) => t.pay_group_id === groupId).map((t) => t.id) : [],
  )
  const [error, setError] = useState<string>()
  const { busy, run } = useSaving()
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const elsewhere = (id: string) => {
    const g = detail.travellers.find((t) => t.id === id)?.pay_group_id
    return g && g !== groupId
  }

  async function save() {
    if (picked.length < 2) return setError('Pick at least 2 people.')
    setError(undefined)
    await run(async () => {
      await setPayGroup(detail.trip.id, picked, groupId)
      onDone()
      onChanged()
    }, setError)
  }

  return (
    <div className="pay-groups__picker" role="group" aria-label="People who pay together">
      {detail.travellers.map((t) => (
        <label key={t.id} className="pay-groups__check">
          <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
          <span className="avatar" aria-hidden="true">
            {t.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {t.name}
            {elsewhere(t.id) && <small> · moves from their group</small>}
          </span>
        </label>
      ))}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="add-item__actions">
        {groupId && (
          <button
            type="button"
            className="button button--quiet"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await removePayGroup(groupId)
                onDone()
                onChanged()
              }, setError)
            }
          >
            Not together
          </button>
        )}
        <button type="button" className="button button--quiet" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
