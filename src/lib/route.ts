// The route map (build 6, mockup route-map-v4): what to pin and where home is, worked out from
// the trip. The map itself (Leaflet) only draws this.
import type { Place, TripDetail } from './trips'

export type LatLng = [number, number]

export type RouteStop = {
  place: Place
  /** The same number as the place's sheet on the trip page (1, 2, 3…). */
  n: number
  /** Null for a place typed by hand, not picked from the suggestions. */
  at: LatLng | null
}

export type Route = {
  stops: RouteStop[]
  /** The pinned stops, in route order. */
  pinned: (RouteStop & { at: LatLng })[]
  home: { name: string; at: LatLng | null } | null
  /** Places with no spot on the map. */
  missing: Place[]
}

const spot = (lat: number | null, lng: number | null): LatLng | null =>
  lat === null || lng === null || lat === undefined || lng === undefined ? null : [Number(lat), Number(lng)]

export function routeOf(detail: Pick<TripDetail, 'trip' | 'places'>): Route {
  const stops = [...detail.places]
    .sort((a, b) => a.position - b.position)
    .map((place, i) => ({ place, n: i + 1, at: spot(place.latitude, place.longitude) }))
  const pinned = stops.filter((s): s is RouteStop & { at: LatLng } => s.at !== null)
  const { home_city, home_latitude, home_longitude } = detail.trip
  return {
    stops,
    pinned,
    home: home_city ? { name: home_city, at: spot(home_latitude, home_longitude) } : null,
    missing: stops.filter((s) => s.at === null).map((s) => s.place),
  }
}

/** Show the map once at least one place has a spot. */
export const hasMap = (route: Route) => route.pinned.length > 0

/**
 * Home is usually far away (St Martin for Colombia), so the map is framed on the places and home
 * becomes an arrow at the edge: which edge, from the places' middle towards home.
 */
export function homeDirection(pinned: LatLng[], home: LatLng): { arrow: string; edge: string } {
  const lat = pinned.reduce((s, p) => s + p[0], 0) / pinned.length
  const lng = pinned.reduce((s, p) => s + p[1], 0) / pinned.length
  const angle = (Math.atan2(home[0] - lat, home[1] - lng) * 180) / Math.PI // 0 = east, 90 = north
  const sectors = [
    { arrow: '→', edge: 'e' },
    { arrow: '↗', edge: 'ne' },
    { arrow: '↑', edge: 'n' },
    { arrow: '↖', edge: 'nw' },
    { arrow: '←', edge: 'w' },
    { arrow: '↙', edge: 'sw' },
    { arrow: '↓', edge: 's' },
    { arrow: '↘', edge: 'se' },
  ]
  const i = Math.round((((angle % 360) + 360) % 360) / 45) % 8
  return sectors[i]
}

/** "from St Martin → 5 places → back home · 14 nights" */
export function routeSummary(route: Route): string {
  const nights = route.stops.reduce((s, x) => s + x.place.nights, 0)
  const places = route.stops.length === 1 ? route.stops[0].place.name : `${route.stops.length} places`
  const parts = route.home ? [`from ${route.home.name}`, places, 'back home'] : [places]
  return `${parts.join(' → ')}${nights ? ` · ${nights} ${nights === 1 ? 'night' : 'nights'}` : ''}`
}
