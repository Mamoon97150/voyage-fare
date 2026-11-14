import { useState } from 'react'
import { deleteItem, updateTicket, type TicketMode, type TripDetail } from '../../lib/trips'
import { itemLine, MODES, ticketOf, type LegLine, type Mode } from '../../lib/tripView'
import { amountText, priceInCompare, STATUS, priceOf } from './itemShared'
import { StatusForm } from './StatusForm'
import { WhoFor } from './WhoFor'
import { TicketForm } from './TicketForm'

/**
 * The legs sitting in one gap of the route, drawn on the paper between two place sheets.
 * A round trip shows its price on the way out; the way back says it's included (counted once).
 * Tapping a leg opens its ticket, to change or delete it.
 */
export function RouteGap({
  detail,
  legs,
  viewer,
  mode,
  onChanged,
  onOpen,
}: {
  detail: TripDetail
  legs: LegLine[]
  viewer: string | null
  mode: Mode
  onChanged: () => void
  onOpen?: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null) // an item id
  if (legs.length === 0) return null
  return (
    <ul className="legs" aria-label="Travel">
      {legs.map(({ leg, item, roundTrip }) => {
        // The form opens where the ticket was tapped, in place of its first leg in this gap.
        if (editing === item.id && legs.find((l) => l.item.id === item.id)?.leg.id === leg.id) {
          return (
            <li key={leg.id} className="leg leg--editing">
              <TicketForm
                detail={detail}
                initial={ticketOf(detail, item, priceOf(detail, item))}
                submitLabel="Save"
                options={priceInCompare(detail, item)}
                onSubmit={async (t) => {
                  await updateTicket(item.id, t, priceInCompare(detail, item) !== undefined)
                  setEditing(null)
                  onChanged()
                }}
                onDelete={async () => {
                  await deleteItem(item.id)
                  onChanged()
                }}
                deleteName="this ticket"
                deleteNote={roundTrip ? 'Both ways go, and its price comes out of the budget.' : undefined}
                onCancel={() => setEditing(null)}
              />
              <WhoFor detail={detail} item={item} onChanged={onChanged} />
              {detail.options.some((o) => o.item_id === item.id && o.is_chosen) && (
                <StatusForm
                  detail={detail}
                  item={item}
                  viewer={viewer}
                  onSaved={() => {
                    setEditing(null)
                    onChanged()
                  }}
                />
              )}
            </li>
          )
        }
        const isReturn = leg.leg_number === 2
        const line = itemLine(detail, item, viewer, mode)
        const dot = !line.priced ? 'dot--none' : line.confirmed ? 'dot--confirmed' : 'dot--estimated'
        const meta = [
          roundTrip ? (isReturn ? 'Included in the round trip' : '⇄ Round trip') : MODES[leg.mode as TicketMode]?.label,
          leg.via && `via ${leg.via}`,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <li key={leg.id} className="leg">
            <button
              type="button"
              className="leg__tap"
              onClick={() => {
                setEditing(item.id)
                onOpen?.()
              }}
              aria-label={`Change ${leg.from_name} → ${leg.to_name}`}
            >
              <span className="leg__icon" aria-hidden="true">
                {MODES[leg.mode as TicketMode]?.icon ?? '•'}
              </span>
              <span className="item-row__main">
                <span className="item-row__name">
                  {leg.from_name} → {leg.to_name}
                </span>
                <span className="item-row__meta">{meta}</span>
              </span>
              {!isReturn && (
                <span className="item-row__amount num">
                  <b>{amountText(line, item, detail.trip.currency)}</b>
                  <span className="item-row__status">
                    <i className={`dot ${dot}`} aria-hidden="true" /> {STATUS[item.status]}
                  </span>
                </span>
              )}
              <span className="item-row__chev" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
