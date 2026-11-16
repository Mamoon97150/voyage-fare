import { dayMap, kmText } from '../../lib/dayMap'
import { formatWhole } from '../../lib/money'
import { leftToPayLines } from '../../lib/moneyPages'
import { shortDay } from '../../lib/tripText'
import { dayLabel, type Mode } from '../../lib/tripView'
import type { TripDetail } from '../../lib/trips'
import { SketchBox } from '../Sketch'
import { DayMap } from './DayMap'
import { RouteCard } from './RouteCard'

/*
 * The trip's third column on a computer (build 8½, mockup desktop-v6): one big map, and what's
 * still to pay. The map is the route; a day's "⌖ Map" puts that day on it, "↺" goes back.
 */

/** "placeId:day" when a day is picked, else the route. */
export function WideMap({ detail, focus, onBack }: { detail: TripDetail; focus: string | null; onBack: () => void }) {
  const [placeId, dayText] = focus ? focus.split(':') : []
  const place = placeId ? detail.places.find((p) => p.id === placeId) : undefined
  const day = Number(dayText)
  if (!place || !day) return <RouteCard detail={detail} />
  const lines = detail.items.filter((i) => i.place_id === place.id && i.day_number === day)
  const view = dayMap(detail, place, day, lines)
  const label = dayLabel(day, detail.trip.start_date)
  return (
    <SketchBox weight="light" className="wide-map" seed={54}>
      <h2 className="wide-map__title">
        {label} in {place.name}
      </h2>
      <p className="wide-map__note">
        {view.stay ? '⌂ → ' : ''}
        {view.stops.map((s) => s.n).join(' → ')}
        {view.km !== null && ` · ${kmText(view.km)}`} ·{' '}
        <button type="button" className="link-button" onClick={onBack}>
          back to the route ↺
        </button>
      </p>
      <DayMap view={view} label={`Map of ${label}`} height={300} />
    </SketchBox>
  )
}

/** The next payments: soonest first, a few lines. Nothing left: nothing shown. */
export function StillToPay({ detail, viewer, mode }: { detail: TripDetail; viewer: string | null; mode: Mode }) {
  const { lines } = leftToPayLines(detail, viewer, mode)
  if (!lines.length) return null
  return (
    <SketchBox weight="light" className="still-to-pay" seed={55}>
      <p className="still-to-pay__title">Still to pay</p>
      <ul className="still-to-pay__list">
        {lines.slice(0, 4).map((l) => (
          <li key={l.id}>
            <span>{l.name}</span>
            <b className="num">
              {formatWhole(l.amount, detail.trip.currency)}
              {l.due && ` · ${shortDay(l.due)}`}
            </b>
          </li>
        ))}
      </ul>
    </SketchBox>
  )
}
