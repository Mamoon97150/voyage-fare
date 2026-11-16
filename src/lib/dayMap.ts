// What a day's map shows (build 9, mockup maps-v6): where you sleep that night, then the day's
// lines that have a place, numbered in the day's order. Straight lines only: real walking times
// need a paid service.
import { kmBetween } from './places'
import type { Item, Place, TripDetail } from './trips'

export type Spot = { latitude: number; longitude: number; name: string }
export type DayStop = { item: Item; n: number; at: Spot }

/** Where a line is: its own spot, or its chosen option's (a stay booked through Compare). */
export function spotOf(detail: Pick<TripDetail, 'options'>, item: Item): Spot | null {
  if (item.latitude != null && item.longitude != null)
    return { latitude: item.latitude, longitude: item.longitude, name: item.location_name ?? item.name }
  const o = detail.options.find((x) => x.item_id === item.id && x.is_chosen)
  if (o && o.latitude != null && o.longitude != null)
    return { latitude: o.latitude, longitude: o.longitude, name: o.location_name ?? o.name }
  return null
}

/** The stay for a night of a place: the one whose days cover it, else the place's only stay. */
export function stayOn(detail: Pick<TripDetail, 'items' | 'options'>, place: Place, day: number): Spot | null {
  const stays = detail.items.filter((i) => i.place_id === place.id && i.kind === 'housing' && i.status !== 'dropped')
  const covering = stays.find(
    (i) => i.day_number !== null && i.day_number <= day && (i.end_day_number === null || day < i.end_day_number),
  )
  const stay = covering ?? (stays.length === 1 ? stays[0] : undefined)
  return stay ? spotOf(detail, stay) : null
}

export type DayMapView = { stay: Spot | null; stops: DayStop[]; unplaced: Item[]; km: number | null }

/** A day of a place: its stay, its numbered stops, the lines with no place yet, the distance. */
export function dayMap(
  detail: Pick<TripDetail, 'items' | 'options'>,
  place: Place,
  day: number,
  lines: Item[],
): DayMapView {
  const live = lines.filter((i) => i.status !== 'dropped' && i.kind !== 'housing')
  const stops: DayStop[] = []
  const unplaced: Item[] = []
  for (const item of live) {
    const at = spotOf(detail, item)
    if (at) stops.push({ item, n: stops.length + 1, at })
    else unplaced.push(item)
  }
  const stay = stayOn(detail, place, day)
  const path = [...(stay ? [stay] : []), ...stops.map((s) => s.at)]
  let km: number | null = null
  if (path.length > 1) {
    km = 0
    for (let k = 1; k < path.length; k++) km += kmBetween(path[k - 1], path[k])
  }
  return { stay, stops, unplaced, km }
}

/** "about 9 km in all, as the crow flies"; under 1 km in metres. */
export function kmText(km: number): string {
  if (km < 1) return `about ${Math.max(100, Math.round(km * 10) * 100)} m in all, as the crow flies`
  return `about ${km < 10 ? Math.round(km * 10) / 10 : Math.round(km)} km in all, as the crow flies`
}
