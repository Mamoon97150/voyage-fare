import { formatMoney } from '../../lib/money'
import { formatMinutes, nextDay, wayMinutes, type OptionLine, type Way } from '../../lib/options'
import type { Item, Place, TicketMode } from '../../lib/trips'
import { MODES } from '../../lib/tripView'

/**
 * One candidate on Compare (mockups 2 and 10): your share and its gap to the cheapest,
 * the details that matter for its kind, ♥ coup de cœur, and Choose in one tap.
 * The chosen one has the pale green wash and the ✓.
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
  const tag = cheapest ? 'Cheapest' : more ? `+${formatMoney(more, currency)}` : null
  const mode = (details.mode ?? 'plane') as TicketMode

  return (
    <li className={`option${chosen ? ' option--chosen' : ''}`}>
      <button type="button" className="option__tap" onClick={onEdit} aria-label={`Change ${option.name}`}>
        <span className="option__head">
          <span className="option__name">
            {chosen && (
              <span className="option__tick" aria-hidden="true">
                ✓
              </span>
            )}
            {option.name}
            {option.is_favourite && (
              <span className="heart" aria-label="coup de cœur">
                {' '}
                ♥
              </span>
            )}
            {details.prices && <span className="option__pill">2 one-way tickets</span>}
          </span>
          <span className="option__price num">
            <b>{formatMoney(share, currency)}</b>
            {tag && <span className={cheapest ? 'option__tag option__tag--best' : 'option__tag'}>{tag}</span>}
          </span>
        </span>

        <span className="option__sub num">
          {[
            details.prices
              ? `${formatMoney(details.prices[0], currency)} + ${formatMoney(details.prices[1], currency)}`
              : whole !== null
                ? `${formatMoney(whole, currency)} for ${travellers}`
                : 'No price yet',
            item.kind === 'transport' ? `${MODES[mode].icon} ${MODES[mode].label}` : null,
            item.kind === 'housing' && details.type ? details.type : null,
            item.kind === 'housing' && whole !== null && place?.nights
              ? `${formatMoney(Math.round(whole / place.nights), currency)} a night`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>

        {item.kind === 'transport' && (
          <>
            <WayLine label={roundTrip ? 'Out' : 'Go'} way={details.out} fast={fastest && !roundTrip} />
            {roundTrip && <WayLine label="Back" way={details.back} />}
          </>
        )}

        {item.kind === 'housing' && (details.looks || details.location) && (
          <span className="option__line">
            {details.looks ? (
              <span className="stars" aria-label={`Looks ${details.looks} out of 5`}>
                {'★'.repeat(details.looks)}
                <i>{'★'.repeat(5 - details.looks)}</i>
              </span>
            ) : null}
            {details.location && <span className="option__quote"> “{details.location}”</span>}
          </span>
        )}

        <Flags item={item} line={line} mode={mode} />
        {option.note && <span className="option__quote option__line">“{option.note}”</span>}
        {fastest && minutes !== null && roundTrip && (
          <span className="option__line option__fast">Fastest · {formatMinutes(minutes)} in all</span>
        )}
      </button>

      <span className="option__actions">
        <button
          type="button"
          className={`option__heart${option.is_favourite ? ' option__heart--on' : ''}`}
          onClick={onFavourite}
          disabled={busy}
          aria-pressed={option.is_favourite}
          aria-label={option.is_favourite ? `Not my coup de cœur: ${option.name}` : `My coup de cœur: ${option.name}`}
        >
          ♥
        </button>
        {chosen ? (
          <span className="option__chosen">Chosen</span>
        ) : (
          <button type="button" className="button button--quiet option__choose" onClick={onChoose} disabled={busy}>
            Choose
          </button>
        )}
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
    <span className="option__way num">
      <span className="option__way-label">{label}</span>
      <span>
        {[way.fromAirport, way.leaves].filter(Boolean).join(' ')} → {[way.toAirport, way.arrives].filter(Boolean).join(' ')}
        {nextDay(way) ? ' +1' : ''}
      </span>
      <span className={`option__dur${fast ? ' option__fast' : ''}`}>{formatMinutes(minutes)}</span>
      {(stops || way.via) && <span className="option__stops">{[stops, way.via && `via ${way.via}`].filter(Boolean).join(' · ')}</span>}
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
    <span className="option__line">
      {shown.map(([v, yes, no], i) => (
        <span key={yes}>
          {i > 0 && ' · '}
          <span className={v ? 'flag flag--yes' : 'flag flag--no'}>{v ? `✓ ${yes}` : `✗ ${no}`}</span>
        </span>
      ))}
    </span>
  )
}
