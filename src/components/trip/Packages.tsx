import { useState } from 'react'
import { explainAuthError } from '../../lib/authForm'
import { setItemPackage, type Item, type TripDetail } from '../../lib/trips'
import { itemTitle, kindLabel, packagesOf } from '../../lib/tripView'
import type { ItemKind } from '../../lib/trips'
import { FormMessage } from '../AuthForm'

/**
 * "What it covers" (mockup package-v4, step 2): tick the lines of the trip a package includes,
 * grouped like the trip page (the whole trip's tickets first, then each place).
 * Lines another package already covers aren't offered.
 */
export function CoversPicker({
  detail,
  packageId,
  value,
  onChange,
}: {
  detail: TripDetail
  packageId?: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const free = (i: Item) => i.kind !== 'package' && i.status !== 'dropped' && (!i.package_id || i.package_id === packageId)
  const groups = [
    { key: 'trip', label: 'Getting there and back · whole trip', items: detail.items.filter((i) => !i.place_id && free(i)) },
    ...[...detail.places]
      .sort((a, b) => a.position - b.position)
      .map((p, n) => ({ key: p.id, label: `${n + 1} · ${p.name}`, items: detail.items.filter((i) => i.place_id === p.id && free(i)) })),
  ].filter((g) => g.items.length > 0)

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <fieldset className="covers">
      <legend className="field__label">What it covers</legend>
      {groups.length === 0 ? (
        <p className="field__hint">Nothing in the trip yet. Add the hotels and tickets, then tick them here.</p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="covers__group">
            <p className="covers__where">{g.label}</p>
            <ul className="covers__list">
              {g.items.map((i) => (
                <li key={i.id}>
                  <label className="covers__line">
                    <input type="checkbox" checked={value.includes(i.id)} onChange={() => toggle(i.id)} />
                    <span>
                      {itemTitle(detail, i).title}
                      <small>{kindLabel(i.kind as ItemKind, i.place_id !== null).label}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="hand covers__note">tick what’s in it: those lines won’t need a price</p>
    </fieldset>
  )
}

/** On any line, when the trip has a package: "Part of a package", saved on change. */
export function PartOfPackage({ detail, item, onChanged }: { detail: TripDetail; item: Item; onChanged: () => void }) {
  const packages = packagesOf(detail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (item.kind === 'package' || packages.length === 0) return null
  const id = `part-of-${item.id}`

  async function change(next: string) {
    setBusy(true)
    setError(undefined)
    try {
      await setItemPackage(item.id, next || null)
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field part-of">
      <label htmlFor={id} className="field__label">
        Part of a package
      </label>
      <select id={id} className="field__input" value={item.package_id ?? ''} onChange={(e) => void change(e.target.value)} disabled={busy}>
        <option value="">Not in a package</option>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {item.package_id && <p className="field__hint">It has no price of its own: the package pays for it.</p>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}
