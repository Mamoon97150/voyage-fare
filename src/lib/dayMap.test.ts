import { describe, expect, it } from 'vitest'
import { dayMap, kmText, spotOf, stayOn } from './dayMap'
import type { Item, Place, TripDetail } from './trips'

const kyoto = { id: 'k', name: 'Kyoto', nights: 3, position: 1 } as Place
const item = (id: string, over: Partial<Item> = {}) =>
  ({
    id,
    place_id: 'k',
    kind: 'activity',
    name: id,
    status: 'idea',
    day_number: 6,
    end_day_number: null,
    latitude: null,
    longitude: null,
    location_name: null,
    ...over,
  }) as unknown as Item
const at = (latitude: number, longitude: number) => ({ latitude, longitude })

describe('a day on the map (maps-v6)', () => {
  const hotel = item('Kanra', { kind: 'housing', day_number: 5, end_day_number: 8 })
  const detail = {
    items: [hotel],
    options: [
      { item_id: 'Kanra', is_chosen: true, name: 'Hotel Kanra', location_name: 'Kanra', ...at(34.989, 135.759) },
    ],
  } as unknown as TripDetail

  it('the stay of that night comes from its chosen option', () => {
    expect(stayOn(detail, kyoto, 6)).toMatchObject({ name: 'Kanra', latitude: 34.989 })
    expect(spotOf(detail, item('x'))).toBeNull()
  })

  it('numbers the lines with a place in the day’s order; the others wait with a ?', () => {
    const lines = [
      item('Fushimi', at(34.9671, 135.7727)),
      item('Tea'),
      item('Nishiki', { kind: 'restaurant', ...at(35.005, 135.7649) }),
      item('Gone', { status: 'dropped', ...at(35, 135) }),
    ]
    const view = dayMap(detail, kyoto, 6, lines)
    expect(view.stops.map((s) => [s.item.id, s.n])).toEqual([
      ['Fushimi', 1],
      ['Nishiki', 2],
    ])
    expect(view.unplaced.map((i) => i.id)).toEqual(['Tea'])
    expect(view.km).toBeGreaterThan(6)
    expect(view.km).toBeLessThan(8)
  })

  it('says the distance simply', () => {
    expect(kmText(9.04)).toBe('about 9 km in all, as the crow flies')
    expect(kmText(12.6)).toBe('about 13 km in all, as the crow flies')
    expect(kmText(0.43)).toBe('about 400 m in all, as the crow flies')
  })
})
