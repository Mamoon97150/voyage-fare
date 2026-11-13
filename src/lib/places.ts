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

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = new URL(ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')
  for (const layer of LAYERS) url.searchParams.append('layer', layer)

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Place search failed (${response.status})`)
  const data = (await response.json()) as { features?: PhotonFeature[] }
  return toSuggestions(data.features ?? [])
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
