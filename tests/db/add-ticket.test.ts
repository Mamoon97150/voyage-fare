// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000d1'
const stranger = '00000000-0000-0000-0000-0000000000d2'
let trip: string
let cartagena: string
let medellin: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea']) as id`)).id
  cartagena = (await one<{ id: string }>(db, `insert into places (trip_id, name, position) values ($1, 'Cartagena', 1) returning id`, [trip])).id
  medellin = (await one<{ id: string }>(db, `insert into places (trip_id, name, position) values ($1, 'Medellín', 2) returning id`, [trip])).id
  await actAs(db, 'owner')
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const ticket = (args: string, params: unknown[] = []) =>
  one<{ id: string }>(db, `select add_ticket(${args}) as id`, params).then((r) => r.id)

const legsOf = (id: string) =>
  rows<Record<string, unknown>>(
    db,
    'select leg_number, mode, from_name, to_name, via, after_place_id from item_legs where item_id = $1 order by leg_number',
    [id],
  )

describe('adding a ticket', () => {
  it('a round trip: one item, one price counted once, two legs placed in the route', async () => {
    await actAs(db, { user: ana })
    const id = await ticket(
      `p_trip_id => $1, p_from => 'St Martin', p_to => 'Cartagena', p_via => 'Panama',
       p_round_trip => true, p_return_after_place_id => $2, p_amount => 900`,
      [trip, medellin],
    )
    const item = await one<Record<string, unknown>>(db, 'select name, kind, category, place_id, status from items where id = $1', [id])
    expect(item).toEqual({ name: 'St Martin ⇄ Cartagena', kind: 'transport', category: 'main_transport', place_id: null, status: 'chosen' })
    expect(await legsOf(id)).toEqual([
      { leg_number: 1, mode: 'plane', from_name: 'St Martin', to_name: 'Cartagena', via: 'Panama', after_place_id: null },
      { leg_number: 2, mode: 'plane', from_name: 'Cartagena', to_name: 'St Martin', via: 'Panama', after_place_id: medellin },
    ])
    const budget = await one<Record<string, unknown>>(db, 'select current_total from v_trip_budget where trip_id = $1', [trip])
    expect(num(budget.current_total)).toBe(900) // not 1 800
  })

  it('a one-way train between two places, with its own name', async () => {
    await actAs(db, { user: ana })
    const id = await ticket(
      `p_trip_id => $1, p_from => 'Cartagena', p_to => 'Medellín', p_mode => 'bus', p_name => 'Night bus', p_after_place_id => $2`,
      [trip, cartagena],
    )
    expect((await one<{ name: string }>(db, 'select name from items where id = $1', [id])).name).toBe('Night bus')
    expect(await legsOf(id)).toEqual([
      { leg_number: 1, mode: 'bus', from_name: 'Cartagena', to_name: 'Medellín', via: null, after_place_id: cartagena },
    ])
  })

  it('no price: an idea, with its route', async () => {
    await actAs(db, { user: ana })
    const id = await ticket(`p_trip_id => $1, p_from => 'Medellín', p_to => 'Bogotá'`, [trip])
    expect((await one<{ status: string }>(db, 'select status from items where id = $1', [id])).status).toBe('idea')
    expect(await legsOf(id)).toHaveLength(1)
  })

  it('all or nothing: no ticket without both ends', async () => {
    await actAs(db, { user: ana })
    const before = (await rows(db, 'select 1 from items')).length
    await expect(ticket(`p_trip_id => $1, p_from => ' ', p_to => 'Bogotá', p_amount => 50`, [trip])).rejects.toThrow()
    await expect(ticket(`p_trip_id => $1, p_from => 'A', p_to => 'B', p_mode => 'rocket'`, [trip])).rejects.toThrow()
    expect(await rows(db, 'select 1 from items')).toHaveLength(before)
  })

  it('someone else can’t add a ticket', async () => {
    await actAs(db, { user: stranger })
    await expect(ticket(`p_trip_id => $1, p_from => 'A', p_to => 'B'`, [trip])).rejects.toThrow()
  })
})
