import { useState } from 'react'
import { amountForInput } from '../../lib/money'
import { deleteItem, updateItem, type Item, type ItemKind, type TripDetail } from '../../lib/trips'
import { daysText, itemLine, itemTitle, KINDS, type Mode } from '../../lib/tripView'
import { optionCount } from '../../lib/options'
import { amountText, priceInCompare, STATUS, priceOf } from './itemShared'
import { DropControl } from './DropControl'
import { ItemForm } from './ItemForm'
import { StatusForm } from './StatusForm'
import { WhoFor } from './WhoFor'

/**
 * One line of the notebook: a dot (green confirmed, mustard estimated, hollow no price), the name,
 * the amount. Tapping it opens the same form as when adding, to change or delete it.
 */
export function ItemRow({
  detail,
  item,
  viewer,
  mode,
  kinds,
  days,
  showDays = true,
  onChanged,
  onOpen,
}: {
  detail: TripDetail
  item: Item
  viewer: string | null
  mode: Mode
  kinds: ItemKind[]
  days: number
  showDays?: boolean
  onChanged: () => void
  onOpen?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const line = itemLine(detail, item, viewer, mode)
  const dot = item.status === 'dropped' ? 'dot--none' : !line.priced ? 'dot--none' : line.confirmed ? 'dot--confirmed' : 'dot--estimated'
  const { title, decision } = itemTitle(detail, item)
  const meta = [
    decision ?? KINDS[item.kind as ItemKind]?.label,
    showDays ? daysText(item) : null,
    optionCount(detail, item) >= 2 ? `${optionCount(detail, item)} options compared` : null,
    item.note,
  ]
    .filter(Boolean)
    .join(' · ')

  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  const inCompare = priceInCompare(detail, item)
  const dropped = item.status === 'dropped'

  if (editing) {
    const price = priceOf(detail, item)
    return (
      <li className="item-row item-row--editing">
        <ItemForm
          detail={detail}
          formId={`edit-${item.id}`}
          kinds={kinds.includes(item.kind as ItemKind) ? kinds : [item.kind as ItemKind, ...kinds]}
          days={days}
          initial={{
            kind: item.kind as ItemKind,
            name: item.name,
            day: item.day_number ? String(item.day_number) : '',
            endDay: item.end_day_number ? String(item.end_day_number) : '',
            price: amountForInput(price),
          }}
          submitLabel="Save"
          options={inCompare}
          nameLabel={decision ? 'What you’re deciding' : 'Name'}
          onSubmit={async (v) => {
            await updateItem({ id: item.id, ...v, keepPrice: inCompare !== undefined })
            setEditing(false)
            onChanged()
          }}
          onDelete={async () => {
            await deleteItem(item.id)
            onChanged()
          }}
          deleteName={item.name}
          onCancel={() => setEditing(false)}
        />
        <WhoFor detail={detail} item={item} onChanged={onChanged} />
        <DropControl
          item={item}
          onChanged={() => {
            setEditing(false)
            onChanged()
          }}
        />
        {chosen && (
          <StatusForm
            detail={detail}
            item={item}
            viewer={viewer}
            onSaved={() => {
              setEditing(false)
              onChanged()
            }}
          />
        )}
      </li>
    )
  }

  return (
    <li className={dropped ? 'item-row item-row--dropped' : 'item-row'}>
      <button
        type="button"
        className="item-row__tap"
        onClick={() => {
          setEditing(true)
          onOpen?.()
        }}
        aria-label={`Change ${title}`}
      >
        <i className={`dot ${dot}`} aria-hidden="true" />
        <span className="item-row__main">
          <span className="item-row__name">{title}</span>
          {meta && <span className="item-row__meta">{meta}</span>}
        </span>
        <span className="item-row__amount num">
          <b>{amountText(line, item, detail.trip.currency)}</b>
          {STATUS[item.status] && <span className="item-row__status">{STATUS[item.status]}</span>}
        </span>
        <span className="item-row__chev" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}
