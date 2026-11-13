import { describe, expect, it } from 'vitest'
import { toSuggestions } from './places'

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
