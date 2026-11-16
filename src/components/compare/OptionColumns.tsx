import type { ReactNode } from 'react'
import { formatMoney, formatWhole } from '../../lib/money'
import { formatMinutes, nextDay, wayMinutes, type OptionLine, type Way } from '../../lib/options'
import type { Item, Place, TicketMode } from '../../lib/trips'
import { usePhoto } from '../../lib/usePhoto'
import { MODES } from '../../lib/tripView'
import { GluedPhoto } from '../GluedPhoto'

/*
 * Compare on a computer (build 8½, mockup desktop-v6): one column per option, the same question on
 * each line, so the differences read across. The chosen one is circled in pen blue (as on the
 * phone) with a light wash down its column. Tapping a name opens it to change.
 */

type Row = { label: string; cell: (l: OptionLine) => ReactNode }

const yesNo = (v: boolean | undefined, yes: string, no: string) =>
  v === undefined ? <span className="cols__none">—</span> : v ? <span className="flag flag--yes">✓ {yes}</span> : no

const times = (w?: Way) =>
  w && (w.leaves || w.arrives) ? (
    <span className="num">
      {[w.fromAirport, w.leaves].filter(Boolean).join(' ')} → {[w.toAirport, w.arrives].filter(Boolean).join(' ')}
      {nextDay(w) ? ' +1' : ''}
      {wayMinutes(w) !== null && <small> · {formatMinutes(wayMinutes(w))}</small>}
    </span>
  ) : (
    <span className="cols__none">—</span>
  )

function rowsFor(item: Item, place: Place | null, currency: string, roundTrip: boolean): Row[] {
  const whole = (l: OptionLine) => (l.option.amount === null ? null : Number(l.option.amount) * Number(l.option.rate))
  if (item.kind === 'housing')
    return [
      {
        label: 'A night',
        cell: (l) =>
          whole(l) !== null && place?.nights ? (
            <span className="num">{formatWhole((whole(l) as number) / place.nights, currency)}</span>
          ) : (
            <span className="cols__none">—</span>
          ),
      },
      {
        label: 'Where',
        cell: (l) => l.option.location_name ?? l.details.location ?? <span className="cols__none">—</span>,
      },
      { label: 'Type', cell: (l) => l.details.type ?? <span className="cols__none">—</span> },
      {
        label: 'Looks',
        cell: (l) =>
          l.details.looks ? (
            <span className="stars" aria-label={`Looks ${l.details.looks} out of 5`}>
              {'★'.repeat(l.details.looks)}
              <i>{'★'.repeat(5 - l.details.looks)}</i>
            </span>
          ) : (
            <span className="cols__none">—</span>
          ),
      },
      { label: 'Breakfast', cell: (l) => yesNo(l.details.breakfast, 'Included', 'No') },
      { label: 'Cancel', cell: (l) => yesNo(l.details.freeCancellation, 'Free', 'No') },
    ]
  if (item.kind === 'transport')
    return [
      { label: 'How', cell: (l) => MODES[(l.details.mode ?? 'plane') as TicketMode].label },
      { label: roundTrip ? 'Out' : 'Go', cell: (l) => times(l.details.out) },
      ...(roundTrip ? [{ label: 'Back', cell: (l: OptionLine) => times(l.details.back) }] : []),
      {
        label: 'Stops',
        cell: (l) =>
          l.details.out?.stops === undefined ? (
            <span className="cols__none">—</span>
          ) : l.details.out.stops === 0 ? (
            'Direct'
          ) : (
            `${l.details.out.stops}${l.details.out.via ? ` · via ${l.details.out.via}` : ''}`
          ),
      },
      { label: 'Bag', cell: (l) => yesNo(l.details.bag, 'Checked bag', 'No') },
      { label: 'Refundable', cell: (l) => yesNo(l.details.refundable, 'Yes', 'No') },
    ]
  return [{ label: 'Where', cell: (l) => l.option.location_name ?? <span className="cols__none">—</span> }]
}

export function OptionColumns({
  lines,
  item,
  place,
  currency,
  roundTrip,
  focused,
  readOnly,
  busy,
  onChoose,
  onFavourite,
  onEdit,
  onFocus,
}: {
  lines: OptionLine[]
  item: Item
  place: Place | null
  currency: string
  roundTrip: boolean
  focused: string | null
  readOnly: boolean
  busy: boolean
  onChoose: (id: string) => void
  onFavourite: (id: string, on: boolean) => void
  onEdit: (id: string) => void
  onFocus: (id: string | null) => void
}) {
  const rows = rowsFor(item, place, currency, roundTrip)
  const cls = (l: OptionLine) =>
    `cols__cell${l.option.is_chosen ? ' cols__cell--chosen' : ''}${focused === l.option.id ? ' cols__cell--focused' : ''}`
  return (
    <div className="cols-wrap">
      <div
        className="cols"
        role="table"
        aria-label={`${item.name}: the options side by side`}
        style={{ gridTemplateColumns: `8rem repeat(${lines.length}, minmax(11rem, 1fr))` }}
      >
        <div className="cols__label" role="columnheader" />
        {lines.map((l) => (
          <ColumnHead
            key={l.option.id}
            line={l}
            className={cls(l)}
            readOnly={readOnly}
            busy={busy}
            onChoose={() => onChoose(l.option.id)}
            onEdit={() => onEdit(l.option.id)}
            onFocus={onFocus}
          />
        ))}

        <div className="cols__label">Your share</div>
        {lines.map((l) => (
          <div key={l.option.id} className={cls(l)} onMouseEnter={() => onFocus(l.option.id)}>
            <b className="cols__price num">{l.share === null ? '—' : formatWhole(l.share, currency)}</b>
            {l.cheapest ? (
              <span className="opt__tag opt__tag--best">Cheapest</span>
            ) : l.more ? (
              <span className="opt__tag">+{formatWhole(l.more, currency)}</span>
            ) : null}
            {l.option.currency !== currency && l.option.amount !== null && (
              <small className="cols__small">{formatMoney(Number(l.option.amount), l.option.currency)} in all</small>
            )}
          </div>
        ))}

        {rows.map((r) => (
          <Row key={r.label} label={r.label}>
            {lines.map((l) => (
              <div key={l.option.id} className={cls(l)} onMouseEnter={() => onFocus(l.option.id)}>
                {r.cell(l)}
              </div>
            ))}
          </Row>
        ))}

        <Row label="Note">
          {lines.map((l) => (
            <div key={l.option.id} className={cls(l)}>
              {l.option.note ?? <span className="cols__none">—</span>}
            </div>
          ))}
        </Row>
        <Row label="Link">
          {lines.map((l) => (
            <div key={l.option.id} className={cls(l)}>
              {l.option.link ? (
                <a href={l.option.link} target="_blank" rel="noopener noreferrer">
                  {hostOf(l.option.link)} ↗
                </a>
              ) : (
                <span className="cols__none">—</span>
              )}
            </div>
          ))}
        </Row>
        <Row label="♥">
          {lines.map((l) => (
            <div key={l.option.id} className={cls(l)}>
              <button
                type="button"
                className={`opt__heart${l.option.is_favourite ? ' opt__heart--on' : ''}`}
                onClick={readOnly ? undefined : () => onFavourite(l.option.id, !l.option.is_favourite)}
                disabled={busy || readOnly}
                aria-pressed={l.option.is_favourite}
                aria-label={
                  l.option.is_favourite ? `Not my coup de cœur: ${l.option.name}` : `My coup de cœur: ${l.option.name}`
                }
              >
                {l.option.is_favourite ? '♥ coup de cœur' : '♡'}
              </button>
            </div>
          ))}
        </Row>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="cols__label">{label}</div>
      {children}
    </>
  )
}

function ColumnHead({
  line,
  className,
  readOnly,
  busy,
  onChoose,
  onEdit,
  onFocus,
}: {
  line: OptionLine
  className: string
  readOnly: boolean
  busy: boolean
  onChoose: () => void
  onEdit: () => void
  onFocus: (id: string | null) => void
}) {
  const { option } = line
  const photo = usePhoto(option)
  const chosen = option.is_chosen
  return (
    <div className={`${className} cols__head`} role="columnheader" onMouseEnter={() => onFocus(option.id)}>
      {photo && <GluedPhoto src={photo} className="cols__photo" />}
      <span className="cols__name">
        <button
          type="button"
          className="opt__pick"
          onClick={chosen || readOnly ? undefined : onChoose}
          disabled={busy || (readOnly && !chosen)}
          aria-pressed={chosen}
          aria-label={chosen ? `${option.name}: chosen` : `Choose ${option.name}`}
        >
          {chosen && <span aria-hidden="true">✓</span>}
        </button>
        <button
          type="button"
          className="link-button cols__edit"
          onClick={readOnly ? undefined : onEdit}
          aria-label={readOnly ? option.name : `Change ${option.name}`}
        >
          {option.name}
        </button>
      </span>
    </div>
  )
}

const hostOf = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}
