import { formatMoney, formatWhole } from '../../lib/money'
import { formatMinutes, nextDay, wayMinutes, type OptionLine, type Way } from '../../lib/options'
import type { Item, Place, TicketMode } from '../../lib/trips'
import { MODES } from '../../lib/tripView'
import { Underlined } from '../Sketch'

/**
 * One candidate on Compare, as a line of the notebook (Compare v4, 13 Nov): the trip page's row
 * with a circle in front. The circle is the Choose button; the chosen one is filled and its name
 * underlined by hand, in blue ink. Tapping the line opens it to change, like on the trip page.
 * On the right: your share, then its tag (Cheapest, +the gap, or Booked / Paid), then ♥.
 */
export function OptionCard({
  line,
  item,
  place,
  currency,
  travellers,
  roundTrip,
  onChoose,
  onFavourite,
  onEdit,
  busy,
}: {
  line: OptionLine
  item: Item
  place: Place | null
  currency: string
  travellers: number
  roundTrip: boolean
  onChoose: () => void
  onFavourite: () => void
  onEdit: () => void
  busy: boolean
}) {
  const { option, details, share, more, cheapest, fastest, minutes } = line
  const chosen = option.is_chosen
  const whole = option.amount === null ? null : Number(option.amount) * Number(option.rate)
  // A price in another currency shows as typed, then what it comes to in the trip's (mockup 10).
  const own = option.currency
  const foreign = own !== currency
  const mode = (details.mode ?? 'plane') as TicketMode
  const settled = chosen && (item.status === 'booked' || item.status === 'paid')

  const price = details.prices
    ? `${formatMoney(details.prices[0], own)} + ${formatMoney(details.prices[1], own)}`
    : whole !== null
      ? `${formatMoney(foreign ? Number(option.amount) : whole, own)} for ${travellers}`
      : 'No price yet'
  const meta = [
    price,
    foreign && whole !== null ? `≈ ${formatWhole(whole, currency)}` : null,
    item.kind === 'transport' ? `${MODES[mode].icon} ${MODES[mode].label}` : null,
    item.kind === 'housing' && details.type ? details.type : null,
    item.kind === 'housing' && whole !== null && place?.nights ? `${formatWhole(whole / place.nights, currency)} a night` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={`opt${chosen ? ' opt--chosen' : ''}`}>
      <button
        type="button"
        className="opt__pick"
        onClick={chosen ? undefined : onChoose}
        disabled={busy}
        aria-pressed={chosen}
        aria-label={chosen ? `${option.name}: chosen` : `Choose ${option.name}`}
      >
        {chosen && <span aria-hidden="true">✓</span>}
      </button>

      <button type="button" className="opt__tap" onClick={onEdit} aria-label={`Change ${option.name}`}>
        <span className="opt__name">
          {chosen ? <Underlined>{option.name}</Underlined> : option.name}
          {details.prices && <span className="opt__pill">2 one-way tickets</span>}
        </span>
        <span className="opt__meta num">{meta}</span>

        {item.kind === 'transport' && (
          <>
            <WayLine label={roundTrip ? 'Out' : 'Go'} way={details.out} fast={fastest && !roundTrip} />
            {roundTrip && <WayLine label="Back" way={details.back} />}
          </>
        )}

        {item.kind === 'housing' && (details.looks || details.location) && (
          <span className="opt__meta">
            {details.looks ? (
              <span className="stars" aria-label={`Looks ${details.looks} out of 5`}>
                {'★'.repeat(details.looks)}
                <i>{'★'.repeat(5 - details.looks)}</i>
              </span>
            ) : null}
            {details.looks && details.location ? ' · ' : null}
            {details.location}
          </span>
        )}

        <Flags item={item} line={line} mode={mode} />
        {option.note && <span className="opt__meta opt__note">{option.note}</span>}
        {fastest && minutes !== null && roundTrip && <span className="opt__meta opt__fast">Fastest · {formatMinutes(minutes)} in all</span>}
      </button>

      <span className="opt__side">
        <b className="opt__amount num">{share === null ? '—' : formatWhole(share, currency)}</b>
        {settled ? (
          <span className="opt__tag opt__tag--settled">● {item.status === 'paid' ? 'Paid' : 'Booked'}</span>
        ) : cheapest ? (
          <span className="opt__tag opt__tag--best">Cheapest</span>
        ) : more ? (
          <span className="opt__tag">+{formatWhole(more, currency)}</span>
        ) : null}
        <button
          type="button"
          className={`opt__heart${option.is_favourite ? ' opt__heart--on' : ''}`}
          onClick={onFavourite}
          disabled={busy}
          aria-pressed={option.is_favourite}
          aria-label={option.is_favourite ? `Not my coup de cœur: ${option.name}` : `My coup de cœur: ${option.name}`}
        >
          {option.is_favourite ? '♥' : '♡'}
        </button>
      </span>
    </li>
  )
}

function WayLine({ label, way, fast = false }: { label: string; way?: Way; fast?: boolean }) {
  if (!way?.leaves && !way?.arrives && !way?.stops && !way?.via) return null
  const minutes = wayMinutes(way)
  const stops =
    way.stops === undefined ? null : way.stops === 0 ? 'Direct' : `${way.stops} ${way.stops === 1 ? 'stop' : 'stops'}`
  return (
    <span className="opt__way num">
      <span className="opt__way-label">{label}</span>
      <span className="opt__times">
        {[way.fromAirport, way.leaves].filter(Boolean).join(' ')} → {[way.toAirport, way.arrives].filter(Boolean).join(' ')}
        {nextDay(way) ? ' +1' : ''}
      </span>
      <span className={`opt__dur${fast ? ' opt__fast' : ''}`}>{formatMinutes(minutes)}</span>
      {(stops || way.via) && <span className="opt__stops">{[stops, way.via && `via ${way.via}`].filter(Boolean).join(' · ')}</span>}
    </span>
  )
}

function Flags({ item, line, mode }: { item: Item; line: OptionLine; mode: TicketMode }) {
  const d = line.details
  const flags: [boolean | undefined, string, string][] =
    item.kind === 'transport'
      ? [
          // Trains, buses and ferries almost always include luggage (13 Nov): no bag line for them.
          ...(mode === 'plane' ? [[d.bag, 'Checked bag', 'No checked bag'] as [boolean | undefined, string, string]] : []),
          [d.refundable, 'Refundable', 'Not refundable'],
        ]
      : item.kind === 'housing'
        ? [
            [d.breakfast, 'Breakfast', 'No breakfast'],
            [d.freeCancellation, 'Free cancellation', 'No free cancellation'],
          ]
        : []
  const shown = flags.filter(([v]) => v !== undefined)
  if (!shown.length) return null
  return (
    <span className="opt__meta">
      {shown.map(([v, yes, no], i) => (
        <span key={yes}>
          {i > 0 && ' · '}
          <span className={v ? 'flag flag--yes' : 'flag flag--no'}>{v ? `✓ ${yes}` : `✗ ${no}`}</span>
        </span>
      ))}
    </span>
  )
}
