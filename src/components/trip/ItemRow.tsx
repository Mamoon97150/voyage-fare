import { BookingMarks } from './Booking'
import { LineSheet } from './LineSheet'
import { useState } from 'react'
import { amountForInput } from '../../lib/money'
import { setPackageCover, updateItem, type Item, type ItemKind, type TripDetail } from '../../lib/trips'
import { coversText, daysText, itemLine, itemTitle, kindLabel, leftLine, type Mode } from '../../lib/tripView'
import { LeftWords } from './LeftWords'
import { optionCount } from '../../lib/options'
import { amountText, priceInCompare, priceOf, statusWord } from './itemShared'
import { ItemForm } from './ItemForm'
import { ItemPeek } from './ItemPeek'
import { isReadOnly } from '../../lib/demo'
import { SourceBadge, VerdictChips } from './ToTry'
import { dayHasCome, inFoodBudget, MEALS, VERDICTS } from '../../lib/toTry'
import { todayIso } from '../../lib/shelf'

/**
 * One line of the notebook: a dot (green confirmed, mustard estimated, hollow no price), the name,
 * the amount. Tapping it opens the line's sheet (line-sheet-v6): a summary and the next step.
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
  // The demo can't be changed: a tap shows the line's details instead (mockup demo-v5).
  const readOnly = isReadOnly(detail)
  const [peek, setPeek] = useState(false)
  const line = itemLine(detail, item, viewer, mode)
  const foodBudget = inFoodBudget(detail, item)
  const dot =
    item.status === 'dropped'
      ? 'dot--none'
      : foodBudget
        ? 'dot--estimated'
        : !line.priced
          ? 'dot--none'
          : line.confirmed
            ? 'dot--confirmed'
            : 'dot--estimated'
  const { title, decision } = itemTitle(detail, item)
  const meta = [
    decision ?? kindLabel(item.kind as ItemKind, item.place_id !== null).label,
    showDays ? daysText(item, detail.trip.start_date) : null,
    item.meal ? MEALS.find(([k]) => k === item.meal)?.[1].toLowerCase() : null,
    optionCount(detail, item) >= 2 ? `${optionCount(detail, item)} options compared` : null,
    item.note,
  ]
    .filter(Boolean)
    .join(' · ')

  const inCompare = priceInCompare(detail, item)
  const dropped = item.status === 'dropped'

  if (editing) {
    const price = priceOf(detail, item)
    return (
      <li className="item-row item-row--editing">
        <LineSheet
          detail={detail}
          item={item}
          viewer={viewer}
          title={title}
          amount={foodBudget ? 'in your food budget' : amountText(line, item, detail.trip.currency)}
          meta={meta}
          catKey={item.kind}
          onChanged={onChanged}
          onClose={() => setEditing(false)}
          edit={(done) => (
            <ItemForm
              detail={detail}
              formId={`edit-${item.id}`}
              kinds={editKinds(kinds, item.kind as ItemKind)}
              days={days}
              foldKind
              initial={{
                kind: item.kind as ItemKind,
                covers: detail.items.filter((i) => i.package_id === item.id).map((i) => i.id),
                name: item.name,
                day: item.day_number ? String(item.day_number) : '',
                endDay: item.end_day_number ? String(item.end_day_number) : '',
                price: amountForInput(price),
              }}
              submitLabel="Save"
              options={inCompare}
              nameLabel={decision ? 'What you’re deciding' : 'Name'}
              onSubmit={async ({ covers, ...v }) => {
                await updateItem({ id: item.id, ...v, keepPrice: inCompare !== undefined })
                if (v.kind === 'package') await setPackageCover(item.id, covers ?? [])
                done()
              }}
              onCancel={done}
            />
          )}
        />
      </li>
    )
  }

  return (
    <li className={dropped ? 'item-row item-row--dropped' : 'item-row'}>
      <button
        type="button"
        className="item-row__tap"
        onClick={() => {
          if (readOnly) return setPeek(!peek)
          setEditing(true)
          onOpen?.()
        }}
        aria-expanded={readOnly ? peek : undefined}
        aria-label={readOnly ? `Details of ${title}` : `Change ${title}`}
      >
        <i className={`dot ${dot}`} aria-hidden="true" />
        <span className="item-row__main">
          <span className="item-row__name">{title}</span>
          {meta && <span className="item-row__meta">{meta}</span>}
          {(item.link || item.verdict) && (
            <span className="item-row__meta item-row__source">
              <SourceBadge link={item.link} asLink={false} />
              {item.verdict && (
                <span className={`verdict-word verdict-word--${item.verdict}`}>
                  {item.verdict === 'loved'
                    ? '♥ loved it'
                    : VERDICTS.find(([k]) => k === item.verdict)?.[1].toLowerCase()}
                </span>
              )}
            </span>
          )}
          {item.kind === 'package' && coversText(detail, item) && (
            <span className="item-row__hand">{coversText(detail, item)}</span>
          )}
          <LeftWords line={leftLine(detail, item, viewer, mode)} part="reminder" />
          <BookingMarks detail={detail} item={item} />
        </span>
        <span className="item-row__amount num">
          <b className={foodBudget ? 'item-row__food' : undefined}>
            {foodBudget ? 'in your food budget' : amountText(line, item, detail.trip.currency)}
          </b>
          {!foodBudget && statusWord(item) && (
            <span className={statusWord(item)!.className}>{statusWord(item)!.text}</span>
          )}
          <LeftWords line={leftLine(detail, item, viewer, mode)} currency={detail.trip.currency} part="left" />
        </span>
        <span className="item-row__chev" aria-hidden="true">
          ›
        </span>
      </button>
      {peek && <ItemPeek detail={detail} item={item} />}
      {item.kind === 'restaurant' &&
        !readOnly &&
        !item.verdict &&
        item.status !== 'dropped' &&
        dayHasCome(detail.trip.start_date, item.day_number, todayIso()) && (
          <VerdictChips item={item} onChanged={onChanged} />
        )}
    </li>
  )
}

/**
 * The kinds offered when changing a line: its own kind stays pickable. An older rental car in a
 * place takes the place of "Getting around" (both say it), so the word isn't there twice.
 */
function editKinds(kinds: ItemKind[], own: ItemKind): ItemKind[] {
  if (kinds.includes(own)) return kinds
  if (own === 'car_rental' && kinds.includes('transport')) return kinds.map((k) => (k === 'transport' ? own : k))
  return [own, ...kinds]
}
