import { useMemo } from 'react'
import { Link } from 'react-router'
import { hasMap, routeOf, routeSummary } from '../../lib/route'
import type { TripDetail } from '../../lib/trips'
import { RouteMap } from '../RouteMap'
import { SketchBox } from '../Sketch'

/** The small route map on the trip page, between the budget and the places. */
export function RouteCard({ detail }: { detail: TripDetail }) {
  const route = useMemo(() => routeOf(detail), [detail])
  if (!hasMap(route)) return null
  return (
    <section className="route-card" aria-labelledby="route-title">
      <SketchBox weight="light" className="route-card__sheet" seed={51}>
        <header className="route-card__head">
          <h2 id="route-title">The route</h2>
          <Link to={`/trips/${detail.trip.id}/route`}>Open the map ›</Link>
        </header>
        <RouteMap route={route} height={180} />
        <p className="route-card__note">{routeSummary(route)}</p>
        <MissingNote names={route.missing.map((p) => p.name)} />
      </SketchBox>
    </section>
  )
}

/** "Guatapé isn't on the map: pick it from the suggestions in Edit." */
export function MissingNote({ names }: { names: string[] }) {
  if (names.length === 0) return null
  const who = names.length === 1 ? `${names[0]} isn’t` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} aren’t`
  return (
    <p className="route-card__missing">
      <span className="dot-todo" aria-hidden="true" />
      {who} on the map: pick {names.length === 1 ? 'it' : 'them'} from the suggestions in Edit
    </p>
  )
}
