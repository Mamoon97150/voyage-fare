import { describe, expect, it } from 'vitest'
import { toSuggestions, toSpots, spotFromLink, kmBetween } from './places'

const feature = (name: string, state: string | undefined, country: string, lon = 1, lat = 2) => ({
  geometry: { coordinates: [lon, lat] as [number, number] },
  properties: { name, state, country },
})

describe('city suggestions', () => {
  it('names the region and country, and keeps the coordinates', () => {
    expect(toSuggestions([feature('Cartagena', 'Bolívar', 'Colombia', -75.5, 10.4)])).toEqual([
      { name: 'Cartagena', detail: 'Bolívar, Colombia', country: 'Colombia', latitude: 10.4, longitude: -75.5 },
    ])
  })

  it('does not repeat the name in the detail (a region or a country)', () => {
    expect(toSuggestions([feature('Saint Martin', 'Saint Martin', 'France')])[0].detail).toBe('France')
    expect(toSuggestions([feature('Portugal', undefined, 'Portugal')])[0].detail).toBe('')
  })

  it('drops duplicates and keeps five at most', () => {
    const many = ['A', 'A', 'B', 'C', 'D', 'E', 'F'].map((n) => feature(n, 'R', 'X'))
    expect(toSuggestions(many).map((s) => s.name)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

describe('spots for a line’s Where (maps-v6)', () => {
  const f = (name: string, props: Record<string, string> = {}, at: [number, number] = [135.77, 34.96]) => ({
    geometry: { coordinates: at },
    properties: { name, ...props },
  })

  it('says what kind of spot it is and where', () => {
    expect(
      toSpots([f('Fushimi Inari-taisha', { osm_value: 'religious', district: 'Fushimi Ward', city: 'Kyoto' })]),
    ).toEqual([
      {
        name: 'Fushimi Inari-taisha',
        detail: 'shrine · Fushimi Ward, Kyoto',
        country: null,
        latitude: 34.96,
        longitude: 135.77,
      },
    ])
  })

  it('reads a Google Maps link: the name and the spot', () => {
    expect(
      spotFromLink('https://www.google.com/maps/place/Kikunoi/@35.0010,135.7810,17z/data=!3d35.0012!4d135.7811'),
    ).toEqual({
      name: 'Kikunoi',
      country: null,
      latitude: 35.0012,
      longitude: 135.7811,
    })
    expect(spotFromLink('https://maps.google.com/?q=34.9671,135.7727')).toMatchObject({ latitude: 34.9671 })
    expect(spotFromLink('https://maps.app.goo.gl/abc')).toBeNull()
    expect(spotFromLink('Kikunoi')).toBeNull()
  })

  it('measures as the crow flies', () => {
    const d = kmBetween({ latitude: 34.9671, longitude: 135.7727 }, { latitude: 35.005, longitude: 135.7649 })
    expect(d).toBeGreaterThan(4)
    expect(d).toBeLessThan(4.5)
  })
})
