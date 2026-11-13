// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000e1'
const stranger = '00000000-0000-0000-0000-0000000000e2'
let trip: string
let cartagena: string
let medellin: string

beforeEach(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea']) as id`)).id
  cartagena = (await one<{ id: string }>(db, `insert into places (trip_id, name, nights, position) values ($1, 'Cartagena', 4, 1) returning id`, [trip])).id
  medellin = (await one<{ id: string }>(db, `insert into places (trip_id, name, nights, position) values ($1, 'Medellín', 3, 2) returning id`, [trip])).id
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const id = (sql: string, params: unknown[] = []) => one<{ id: string }>(db, `select ${sql} as id`, params).then((r) => r.id)
const total = async () => num((await one<{ t: string }>(db, 'select current_total as t from v_trip_budget where trip_id = $1', [trip])).t)

describe('changing an item', () => {
  it('name, kind, days and price, all at once', async () => {
    const item = await id(`add_item(p_trip_id => $1, p_kind => 'activity', p_name => 'Islands', p_place_id => $2, p_amount => 100)`, [trip, cartagena])
    await db.query(`select update_item(p_item_id => $1, p_kind => 'restaurant', p_name => ' Celele ', p_day_number => 2, p_amount => 180)`, [item])
    expect(await one(db, 'select name, kind, category, day_number, status from items where id = $1', [item])).toEqual({
      name: 'Celele',
      kind: 'restaurant',
      category: 'food',
      day_number: 2,
      status: 'chosen',
    })
    expect(await total()).toBe(180)
  })

  it('a price on an idea makes it chosen; no price makes it an idea again', async () => {
    const item = await id(`add_item(p_trip_id => $1, p_kind => 'activity', p_name => 'Islands', p_place_id => $2)`, [trip, cartagena])
    await db.query(`select update_item(p_item_id => $1, p_kind => 'activity', p_name => 'Islands', p_amount => 90)`, [item])
    expect((await one<{ status: string }>(db, 'select status from items where id = $1', [item])).status).toBe('chosen')
    expect(await total()).toBe(90)

    await db.query(`select update_item(p_item_id => $1, p_kind => 'activity', p_name => 'Islands')`, [item])
    expect((await one<{ status: string }>(db, 'select status from items where id = $1', [item])).status).toBe('idea')
    expect(await rows(db, 'select 1 from options where item_id = $1', [item])).toHaveLength(0)
    expect(await total()).toBeNull() // a dash, not 0
  })

  it('deleting an item takes its price out of the budget', async () => {
    const item = await id(`add_item(p_trip_id => $1, p_kind => 'activity', p_name => 'Islands', p_place_id => $2, p_amount => 100)`, [trip, cartagena])
    await db.query('delete from items where id = $1', [item])
    expect(await rows(db, 'select 1 from options where item_id = $1', [item])).toHaveLength(0)
    expect(await total()).toBeNull()
  })
})

describe('changing a ticket', () => {
  it('a round trip becomes one way, cheaper, through another city', async () => {
    const t = await id(`add_ticket(p_trip_id => $1, p_from => 'St Martin', p_to => 'Cartagena', p_round_trip => true, p_return_after_place_id => $2, p_amount => 900)`, [trip, medellin])
    await db.query(
      `select update_ticket(p_item_id => $1, p_from => 'St Martin', p_to => 'Bogotá', p_mode => 'plane', p_via => 'Miami', p_amount => 500)`,
      [t],
    )
    expect((await one<{ name: string }>(db, 'select name from items where id = $1', [t])).name).toBe('St Martin → Bogotá')
    expect(await rows(db, 'select leg_number, to_name, via from item_legs where item_id = $1', [t])).toEqual([
      { leg_number: 1, to_name: 'Bogotá', via: 'Miami' },
    ])
    expect(await total()).toBe(500)
  })

  it('deleting a ticket removes its legs and its price', async () => {
    const t = await id(`add_ticket(p_trip_id => $1, p_from => 'A', p_to => 'B', p_round_trip => true, p_amount => 900)`, [trip])
    await db.query('delete from items where id = $1', [t])
    expect(await rows(db, 'select 1 from item_legs where item_id = $1', [t])).toHaveLength(0)
    expect(await total()).toBeNull()
  })
})

describe('changing a place', () => {
  it('deleting a place removes its items; tickets after it move up in the route', async () => {
    await id(`add_item(p_trip_id => $1, p_kind => 'housing', p_name => 'Casa', p_place_id => $2, p_amount => 300)`, [trip, medellin])
    const bus = await id(`add_ticket(p_trip_id => $1, p_from => 'Medellín', p_to => 'Bogotá', p_after_place_id => $2, p_amount => 40)`, [trip, medellin])
    await db.query('select delete_place($1)', [medellin])

    expect(await rows(db, 'select name from places where trip_id = $1', [trip])).toEqual([{ name: 'Cartagena' }])
    expect(await rows(db, `select 1 from items where name = 'Casa'`)).toHaveLength(0)
    expect((await one<{ after_place_id: string }>(db, 'select after_place_id from item_legs where item_id = $1', [bus])).after_place_id).toBe(cartagena)
    expect(await total()).toBe(40)
  })

  it('the first place: tickets after it go to the start', async () => {
    const t = await id(`add_ticket(p_trip_id => $1, p_from => 'Cartagena', p_to => 'Medellín', p_after_place_id => $2)`, [trip, cartagena])
    await db.query('select delete_place($1)', [cartagena])
    expect((await one<{ after_place_id: string | null }>(db, 'select after_place_id from item_legs where item_id = $1', [t])).after_place_id).toBeNull()
  })

  it('renaming a place and its nights is a plain update', async () => {
    await db.query(`update places set name = 'Cartagena de Indias', nights = 5 where id = $1`, [cartagena])
    expect(await one(db, 'select name, nights from places where id = $1', [cartagena])).toEqual({ name: 'Cartagena de Indias', nights: 5 })
  })
})

describe('only members change a trip', () => {
  it('someone else can’t change or delete anything', async () => {
    const item = await id(`add_item(p_trip_id => $1, p_kind => 'activity', p_name => 'Islands', p_place_id => $2, p_amount => 100)`, [trip, cartagena])
    await actAs(db, { user: stranger })
    await expect(db.query(`select update_item(p_item_id => $1, p_kind => 'activity', p_name => 'Mine')`, [item])).rejects.toThrow()
    await expect(db.query('select delete_place($1)', [cartagena])).rejects.toThrow()
    await db.query('delete from items where id = $1', [item]) // silently touches nothing
    await actAs(db, { user: ana })
    expect(await total()).toBe(100)
  })
})
