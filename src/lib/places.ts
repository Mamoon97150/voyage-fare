// City suggestions from OpenStreetMap (Photon): free, no key (cahier des charges §12).
// Only what the person types is sent; nothing about them or their trip.

/** What a city field holds: a name, and its position when it was picked from the suggestions. */
export type CityValue = {
  name: string
  country: string | null
  latitude: number | null
  longitude: number | null
}

export const emptyCity: CityValue = { name: '', country: null, latitude: null, longitude: null }

export type PlaceSuggestion = {
  name: string
  /** Region and country, to tell two Cartagenas apart. */
  detail: string
  country: string | null
  latitude: number
  longitude: number
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; state?: string; country?: string; type?: string }
}

const ENDPOINT = 'https://photon.komoot.io/api/'
// Cities, towns, areas, regions, countries: not shops and street names.
const LAYERS = ['city', 'locality', 'district', 'state', 'country']

// Searches already done, so typing back or opening the same place again is instant (16 Nov).
const remembered = new Map<string, PlaceSuggestion[]>()
export const rememberedPlaces = (query: string) => remembered.get(query.trim().toLowerCase())

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const known = remembered.get(q.toLowerCase())
  if (known) return known
  const url = new URL(ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')
  for (const layer of LAYERS) url.searchParams.append('layer', layer)

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Place search failed (${response.status})`)
  const data = (await response.json()) as { features?: PhotonFeature[] }
  const found = toSuggestions(data.features ?? [])
  remembered.set(q.toLowerCase(), found)
  return found
}

/** The most likely place for a name ("Tokyo"), or null: for places that came without a pick. */
export async function firstPlace(name: string): Promise<CityValue | null> {
  try {
    const [s] = await searchPlaces(name)
    return s ? { name, country: s.country, latitude: s.latitude, longitude: s.longitude } : null
  } catch {
    return null
  }
}

export function toSuggestions(features: PhotonFeature[]): PlaceSuggestion[] {
  const seen = new Set<string>()
  const out: PlaceSuggestion[] = []
  for (const f of features) {
    const { name, state, country } = f.properties
    if (!name) continue
    const detail = [state && state !== name ? state : null, country && country !== name ? country : null]
      .filter(Boolean)
      .join(', ')
    const key = `${name}|${detail}`
    if (seen.has(key)) continue
    seen.add(key)
    const [longitude, latitude] = f.geometry.coordinates
    out.push({ name, detail, country: country ?? null, latitude, longitude })
  }
  return out.slice(0, 5)
}

type SpotFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    osm_value?: string
    street?: string
    district?: string
    city?: string
    state?: string
    country?: string
  }
}

// Words for the kinds of spot worth naming ("shrine · Fushimi Ward, Kyoto"); the rest stay unnamed.
const SPOT_WORDS: Record<string, string> = {
  restaurant: 'restaurant',
  cafe: 'café',
  bar: 'bar',
  pub: 'bar',
  fast_food: 'food',
  museum: 'museum',
  attraction: 'sight',
  viewpoint: 'viewpoint',
  religious: 'shrine',
  place_of_worship: 'temple',
  shrine: 'shrine',
  park: 'park',
  beach: 'beach',
  station: 'station',
  hotel: 'hotel',
  marketplace: 'market',
  gallery: 'gallery',
  zoo: 'zoo',
  theme_park: 'theme park',
}

/** Spots (a shrine, a restaurant, a station) for a line's "Where" (maps-v6): near the place first. */
export async function searchSpots(
  query: string,
  near: { latitude: number; longitude: number } | null,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const key = `spot|${q.toLowerCase()}|${near ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}` : ''}`
  const known = remembered.get(key)
  if (known) return known
  const url = new URL(ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '8')
  url.searchParams.set('lang', 'en')
  if (near) {
    url.searchParams.set('lat', String(near.latitude))
    url.searchParams.set('lon', String(near.longitude))
  }
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Place search failed (${response.status})`)
  const data = (await response.json()) as { features?: SpotFeature[] }
  const found = toSpots(data.features ?? [])
  remembered.set(key, found)
  return found
}

export const rememberedSpots = (query: string, near: { latitude: number; longitude: number } | null) =>
  remembered.get(
    `spot|${query.trim().toLowerCase()}|${near ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}` : ''}`,
  )

export function toSpots(features: SpotFeature[]): PlaceSuggestion[] {
  const seen = new Set<string>()
  const out: PlaceSuggestion[] = []
  for (const f of features) {
    const { name, osm_value, district, city, country } = f.properties
    if (!name) continue
    const word = osm_value ? SPOT_WORDS[osm_value] : undefined
    const where = [district && district !== name ? district : null, city && city !== name ? city : null]
      .filter(Boolean)
      .join(', ')
    const detail = [word, where || (country !== name ? country : null)].filter(Boolean).join(' · ')
    const key = `${name}|${where}`
    if (seen.has(key)) continue
    seen.add(key)
    const [longitude, latitude] = f.geometry.coordinates
    out.push({ name, detail, country: country ?? null, latitude, longitude })
  }
  return out.slice(0, 5)
}

/**
 * A Google Maps link carries the spot: "/place/Kikunoi/@35.0,135.7,17z", "!3d35.0!4d135.7", or
 * "?q=35.0,135.7". Short links (maps.app.goo.gl) don't: null, and the name is typed.
 */
export function spotFromLink(text: string): CityValue | null {
  const t = text.trim()
  if (!/^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i.test(t)) return null
  let url: URL
  try {
    url = new URL(t)
  } catch {
    return null
  }
  const parts = url.pathname.split('/')
  const i = parts.indexOf('place')
  const name = i >= 0 && parts[i + 1] ? decodeURIComponent(parts[i + 1].replace(/\+/g, ' ')) : null
  const precise = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  const at = t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  const q = (url.searchParams.get('q') ?? url.searchParams.get('query') ?? '').match(
    /^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/,
  )
  const m = precise ?? at ?? q
  if (!m) return name ? { name, country: null, latitude: null, longitude: null } : null
  return { name: name ?? 'Pinned spot', country: null, latitude: Number(m[1]), longitude: Number(m[2]) }
}

/** Straight-line distance in km between two points (the day map's "as the crow flies"). */
export function kmBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(b.latitude - a.latitude)
  const dLng = r(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
