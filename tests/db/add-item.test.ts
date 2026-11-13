// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000c1'
const stranger = '00000000-0000-0000-0000-0000000000c2'
let trip: string
let cartagena: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (
    await one<{ id: string }>(
      db,
      `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea'], p_currency => 'COP') as id`,
    )
  ).id
  cartagena = (
    await one<{ id: string }>(db, `insert into places (trip_id, name, nights, position) values ($1, 'Cartagena', 4, 1) returning id`, [trip])
  ).id
  await actAs(db, 'owner')
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const add = (args: string, params: unknown[] = []) =>
  one<{ id: string }>(db, `select add_item(${args}) as id`, params).then((r) => r.id)

describe('adding an item', () => {
  it('with a price: chosen, in the trip currency, counted as estimated', async () => {
    await actAs(db, { user: ana })
    const id = await add(`p_trip_id => $1, p_kind => 'housing', p_name => ' Casa Lola ', p_place_id => $2, p_amount => 2400000`, [trip, cartagena])

    const item = await one<Record<string, unknown>>(db, 'select * from items where id = $1', [id])
    expect(item).toMatchObject({ name: 'Casa Lola', category: 'accommodation', status: 'chosen', place_id: cartagena })
    const option = await one<Record<string, unknown>>(db, 'select * from options where item_id = $1', [id])
    expect(option).toMatchObject({ currency: 'COP', is_chosen: true })
    expect(num(option.amount)).toBe(2400000)

    const amounts = await one<Record<string, unknown>>(db, 'select * from v_item_amounts where item_id = $1', [id])
    expect(num(amounts.current)).toBe(2400000)
    expect(amounts.is_confirmed).toBe(false)
  })

  it('without a price: an idea, nothing counted', async () => {
    await actAs(db, { user: ana })
    const id = await add(`p_trip_id => $1, p_kind => 'activity', p_name => 'Rosario islands', p_place_id => $2, p_day_number => 2`, [trip, cartagena])
    const item = await one<Record<string, unknown>>(db, 'select status, day_number from items where id = $1', [id])
    expect(item).toEqual({ status: 'idea', day_number: 2 })
    expect(await rows(db, 'select 1 from options where item_id = $1', [id])).toHaveLength(0)
  })

  it('the category follows the kind and where it is', async () => {
    await actAs(db, { user: ana })
    const flight = await add(`p_trip_id => $1, p_kind => 'transport', p_name => 'Flights'`, [trip])
    const boat = await add(`p_trip_id => $1, p_kind => 'transport', p_name => 'Boat', p_place_id => $2`, [trip, cartagena])
    const dinner = await add(`p_trip_id => $1, p_kind => 'restaurant', p_name => 'Celele', p_place_id => $2`, [trip, cartagena])
    const cats = await rows<{ id: string; category: string }>(db, 'select id, category from items where id = any($1)', [[flight, boat, dinner]])
    const byId = Object.fromEntries(cats.map((c) => [c.id, c.category]))
    expect(byId[flight]).toBe('main_transport')
    expect(byId[boat]).toBe('local_transport')
    expect(byId[dinner]).toBe('food')
  })

  it('a stay can span days; the end can’t come before the start', async () => {
    await actAs(db, { user: ana })
    const id = await add(`p_trip_id => $1, p_kind => 'car_rental', p_name => 'Car', p_place_id => $2, p_day_number => 1, p_end_day_number => 4`, [trip, cartagena])
    expect(await one(db, 'select day_number, end_day_number from items where id = $1', [id])).toEqual({ day_number: 1, end_day_number: 4 })
    await expect(add(`p_trip_id => $1, p_kind => 'car_rental', p_name => 'Bad', p_day_number => 4, p_end_day_number => 1`, [trip])).rejects.toThrow()
  })

  it('the trip budget adds it up, each traveller gets half', async () => {
    await actAs(db, { user: ana })
    const budget = await one<Record<string, unknown>>(db, 'select * from v_trip_budget where trip_id = $1', [trip])
    expect(num(budget.current_total)).toBe(2400000)
    const shares = await rows<{ share_current: string }>(db, 'select share_current from v_traveller_shares where trip_id = $1', [trip])
    expect(shares.map((s) => num(s.share_current))).toEqual([1200000, 1200000])
  })

  it('someone else can’t add to the trip', async () => {
    await actAs(db, { user: stranger })
    await expect(add(`p_trip_id => $1, p_kind => 'other', p_name => 'Sneaky'`, [trip])).rejects.toThrow()
  })
})
