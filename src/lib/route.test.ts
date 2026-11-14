import { describe, expect, it } from 'vitest'
import { hasMap, homeDirection, routeOf, routeSummary } from './route'

const place = (id: string, name: string, position: number, nights: number, lat: number | null, lng: number | null) =>
  ({ id, name, position, nights, latitude: lat, longitude: lng, country: null, trip_id: 't' }) as never

const trip = (home: string | null, lat: number | null = null, lng: number | null = null) =>
  ({ home_city: home, home_latitude: lat, home_longitude: lng }) as never

const colombia = [
  place('b', 'Bogotá', 1, 2, 4.711, -74.0721),
  place('g', 'Guatapé', 2, 2, null, null),
  place('m', 'Medellín', 3, 4, 6.2442, -75.5812),
]

describe('the route map', () => {
  it('pins the places in order, with their sheet numbers; a typed place is missing', () => {
    const r = routeOf({ trip: trip('St Martin', 18.04, -63.05), places: [colombia[2], colombia[0], colombia[1]] })
    expect(r.stops.map((s) => `${s.n} ${s.place.name}`)).toEqual(['1 Bogotá', '2 Guatapé', '3 Medellín'])
    expect(r.pinned.map((s) => s.n)).toEqual([1, 3])
    expect(r.missing.map((p) => p.name)).toEqual(['Guatapé'])
    expect(r.home).toEqual({ name: 'St Martin', at: [18.04, -63.05] })
    expect(hasMap(r)).toBe(true)
  })

  it('no map until a place has a spot', () => {
    expect(hasMap(routeOf({ trip: trip(null), places: [] }))).toBe(false)
    expect(hasMap(routeOf({ trip: trip(null), places: [colombia[1]] }))).toBe(false)
  })

  it('home far away: an arrow at the right edge', () => {
    const pins: [number, number][] = [[4.7, -74.1], [6.2, -75.6], [10.4, -75.5]]
    expect(homeDirection(pins, [18.04, -63.05])).toEqual({ arrow: '↗', edge: 'ne' })
    expect(homeDirection(pins, [48.85, -75])).toEqual({ arrow: '↑', edge: 'n' })
    expect(homeDirection(pins, [-12, -77])).toEqual({ arrow: '↓', edge: 's' })
  })

  it('says the route in words', () => {
    expect(routeSummary(routeOf({ trip: trip('St Martin'), places: colombia }))).toBe('from St Martin → 3 places → back home · 8 nights')
    expect(routeSummary(routeOf({ trip: trip(null), places: [colombia[0]] }))).toBe('Bogotá · 2 nights')
  })
})
