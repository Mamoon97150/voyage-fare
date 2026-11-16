import { describe, expect, it } from 'vitest'
import { dayDate, dayHasCome, inFoodBudget, isToTry, placeDays, plannedOn, sourceOf } from './toTry'

const item = (over: Record<string, unknown>) =>
  ({
    id: 'i',
    kind: 'restaurant',
    place_id: 'm',
    day_number: null,
    end_day_number: null,
    status: 'idea',
    name: 'X',
    ...over,
  }) as never

describe('where a link comes from', () => {
  it('Instagram: a post has no account in its address, a profile does', () => {
    expect(sourceOf('https://www.instagram.com/p/C9xK2/')).toMatchObject({
      label: 'Instagram',
      badge: 'IG',
      handle: null,
    })
    expect(sourceOf('https://instagram.com/elcielomedellin/')).toMatchObject({ handle: '@elcielomedellin' })
  })
  it('TikTok gives the account; Google Maps gives the name', () => {
    expect(sourceOf('https://www.tiktok.com/@comidascolombia/video/123')).toMatchObject({
      badge: 'TT',
      handle: '@comidascolombia',
    })
    expect(sourceOf('https://www.google.com/maps/place/Pergamino+Caf%C3%A9/@6.2,-75.5,17z')).toMatchObject({
      label: 'Google Maps',
      name: 'Pergamino Café',
    })
    expect(sourceOf('https://maps.app.goo.gl/abc')).toMatchObject({ kind: 'maps', name: null })
  })
  it('another site shows its address; not a link → nothing', () => {
    expect(sourceOf('https://www.eltiempo.com/x')).toMatchObject({ kind: 'web', label: 'eltiempo.com' })
    expect(sourceOf('the octopus')).toBeNull()
    expect(sourceOf(null)).toBeNull()
  })
})

describe('the pool and the days', () => {
  const places = [
    { id: 'b', position: 1, nights: 2 },
    { id: 'g', position: 2, nights: 3 },
    { id: 'm', position: 3, nights: 4 },
  ] as never[]

  it('a restaurant with no day, still an idea, is in the pool; on a day, counting or dropped it isn’t', () => {
    expect(isToTry(item({}))).toBe(true)
    expect(isToTry(item({ day_number: 7 }))).toBe(false)
    expect(isToTry(item({ status: 'dropped' }))).toBe(false)
    expect(isToTry(item({ status: 'chosen' }))).toBe(false)
    expect(isToTry(item({ kind: 'activity' }))).toBe(true)
    expect(isToTry(item({ kind: 'housing' }))).toBe(false)
    // Several options compared: a decision, not To try.
    const two = [{ item_id: 'i' }, { item_id: 'i' }]
    expect(isToTry(item({}), two)).toBe(false)
    expect(isToTry(item({}), two.slice(1))).toBe(true)
  })

  it('a place’s days, their dates, what’s on them', () => {
    expect(placeDays({ places }, places[2])).toEqual([6, 7, 8, 9])
    expect(dayDate('2026-09-04', 6)).toBe('Wed 9')
    expect(dayDate(null, 6)).toBeNull()
    const items = [
      item({ id: 'a', kind: 'activity', day_number: 7, name: 'Comuna 13 tour' }),
      item({ id: 'c', day_number: 7, name: 'Carmen', status: 'chosen' }),
      item({ id: 's', kind: 'housing', day_number: 6, end_day_number: 9, name: 'Apartment' }),
    ] as never[]
    expect(plannedOn({ items }, 'm', 7)).toBe('Carmen')
    expect(plannedOn({ items }, 'm', 8)).toBeNull()
  })

  it('in the food budget: on a day, no price, a food estimate for the place or the trip', () => {
    const food = { dailyEstimates: [{ category: 'food', place_id: 'm' }], options: [] } as never
    expect(inFoodBudget(food, item({ day_number: 7 }))).toBe(true)
    expect(inFoodBudget(food, item({}))).toBe(false)
    expect(inFoodBudget({ dailyEstimates: [], options: [] } as never, item({ day_number: 7 }))).toBe(false)
    expect(
      inFoodBudget(
        {
          dailyEstimates: [{ category: 'food', place_id: null }],
          options: [{ item_id: 'i', is_chosen: true }],
        } as never,
        item({ day_number: 7 }),
      ),
    ).toBe(false)
  })

  it('the day has come', () => {
    expect(dayHasCome('2026-09-04', 6, '2026-09-09')).toBe(true)
    expect(dayHasCome('2026-09-04', 7, '2026-09-09')).toBe(false)
    expect(dayHasCome(null, 7, '2026-09-09')).toBe(false)
  })
})
