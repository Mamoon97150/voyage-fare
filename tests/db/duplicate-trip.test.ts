// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000f1'
const stranger = '00000000-0000-0000-0000-0000000000f2'
let trip: string
let bea: string
let cleo: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (
    await one<{ id: string }>(
      db,
      `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea', 'Cleo'],
                          p_start_date => '2026-09-04', p_end_date => '2026-09-18', p_home_city => 'St Martin') as id`,
    )
  ).id
  ;[bea, cleo] = (
    await rows<{ id: string }>(
      db,
      `select id from travellers where trip_id = $1 and user_id is null order by position`,
      [trip],
    )
  ).map((r) => r.id)
  const bog = (
    await one<{ id: string }>(
      db,
      `insert into places (trip_id, name, nights, position) values ($1, 'Bogotá', 2, 1) returning id`,
      [trip],
    )
  ).id
  await db.query(`select import_lines($1, $2)`, [
    trip,
    JSON.stringify({
      places: [
        {
          id: bog,
          lines: [
            { kind: 'housing', name: 'Grand Hyatt', options: [{ amount: 300 }] },
            {
              kind: 'activity',
              name: 'Thrill day',
              day: 2,
              options: [
                { name: 'Paragliding', amount: 315 },
                { name: 'Coffee farm', amount: 312 },
              ],
            },
            { kind: 'restaurant', name: 'Carmen', options: [{ amount: 90 }] },
            { kind: 'activity', name: 'Dropped tour', day: 1, options: [{ amount: 50 }] },
          ],
        },
      ],
      tickets: [{ from: 'St Martin', to: 'Bogotá', mode: 'plane', options: [{ name: 'Copa', amount: 600 }] }],
    }),
  ])
  // The thrill day: paragliding chosen; the stay booked and paid by Bea, for Ana and Bea only; a tour dropped.
  await db.exec(`update options set is_chosen = true where name = 'Paragliding'`)
  await db.query(
    `update items set status = 'paid', paid_by = $1, paid_on = '2026-09-01', actual_amount = 310, actual_currency = 'EUR' where name = 'Grand Hyatt'`,
    [bea],
  )
  await db.query(`select set_item_dropped(id, true) from items where name = 'Dropped tour'`)
  const hyatt = (await one<{ id: string }>(db, `select id from items where name = 'Grand Hyatt'`)).id
  const me = (
    await one<{ id: string }>(db, `select id from travellers where trip_id = $1 and user_id is not null`, [trip])
  ).id
  await db.query(
    `insert into item_split_travellers (trip_id, item_id, traveller_id) values ($1, $2, $3), ($1, $2, $4)`,
    [trip, hyatt, me, bea],
  )
  await actAs(db, 'owner')
})

afterEach(async () => {
  await actAs(db, 'owner')
})

async function refused(database: PGlite, sql: string) {
  await database.exec('begin')
  const result = await refusedIn(database, sql)
  await database.exec('commit')
  return result
}

describe('start a new trip from this one: duplicate_trip', () => {
  it('places, lines, options, route and splits come along; dates, bookings and payments start fresh', async () => {
    await actAs(db, { user: ana })
    const id = (
      await one<{ id: string }>(db, `select duplicate_trip($1, 'Colombia again', array[$2]::uuid[]) as id`, [trip, bea])
    ).id
    const t = await one<Record<string, unknown>>(
      db,
      'select name, start_date, end_date, home_city, currency, created_by from trips where id = $1',
      [id],
    )
    expect(t).toEqual({
      name: 'Colombia again',
      start_date: null,
      end_date: null,
      home_city: 'St Martin',
      currency: 'EUR',
      created_by: ana,
    })
    // You and Bea; Cleo stayed home.
    expect(
      await rows<{ name: string; mine: boolean }>(
        db,
        'select name, user_id is not null as mine from travellers where trip_id = $1 order by position',
        [id],
      ),
    ).toEqual([
      { name: 'Ana', mine: true },
      { name: 'Bea', mine: false },
    ])
    expect(await rows(db, 'select name, nights from places where trip_id = $1', [id])).toEqual([
      { name: 'Bogotá', nights: 2 },
    ])

    const items = await rows<{ name: string; status: string; paid_by: string | null; actual_amount: string | null }>(
      db,
      'select name, status, paid_by, actual_amount from items where trip_id = $1 order by name',
      [id],
    )
    expect(items.map((i) => [i.name, i.status, i.paid_by, num(i.actual_amount)])).toEqual([
      ['Carmen', 'idea', null, null], // To try stays To try
      ['Grand Hyatt', 'chosen', null, null], // was paid: back to estimated
      ['St Martin → Bogotá', 'chosen', null, null],
      ['Thrill day', 'chosen', null, null],
    ])
    const thrill = await rows<{ name: string; is_chosen: boolean }>(
      db,
      `select o.name, o.is_chosen from options o join items i on i.id = o.item_id where i.trip_id = $1 and i.name = 'Thrill day' order by o.position`,
      [id],
    )
    expect(thrill).toEqual([
      { name: 'Paragliding', is_chosen: true },
      { name: 'Coffee farm', is_chosen: false },
    ])
    expect(await rows(db, `select from_name, to_name, after_place_id from item_legs where trip_id = $1`, [id])).toEqual(
      [{ from_name: 'St Martin', to_name: 'Bogotá', after_place_id: null }],
    )
    // The stay was for Ana and Bea: still is, in the new trip.
    const split = await rows<{ name: string }>(
      db,
      `select t.name from item_split_travellers s join travellers t on t.id = s.traveller_id join items i on i.id = s.item_id
       where s.trip_id = $1 and i.name = 'Grand Hyatt' order by t.position`,
      [id],
    )
    expect(split.map((s) => s.name)).toEqual(['Ana', 'Bea'])
    // The original is untouched.
    expect(
      (
        await one<{ status: string }>(db, `select status from items where trip_id = $1 and name = 'Grand Hyatt'`, [
          trip,
        ])
      ).status,
    ).toBe('paid')
  })

  it('only what was chosen: the alternatives stay behind, To try keeps its price', async () => {
    await actAs(db, { user: ana })
    const id = (await one<{ id: string }>(db, `select duplicate_trip($1, 'Lighter', '{}', false) as id`, [trip])).id
    const options = await rows<{ item: string; name: string }>(
      db,
      `select i.name as item, o.name from options o join items i on i.id = o.item_id where i.trip_id = $1 order by i.name, o.position`,
      [id],
    )
    expect(options.filter((o) => o.item === 'Thrill day').map((o) => o.name)).toEqual(['Paragliding'])
    expect(options.some((o) => o.item === 'Carmen')).toBe(true)
    expect((await rows(db, 'select 1 from travellers where trip_id = $1', [id])).length).toBe(1)
  })

  it('a trip you can’t see: refused; no name: refused', async () => {
    await actAs(db, { user: stranger })
    expect(await refused(db, `select duplicate_trip('${trip}', 'Mine now')`)).toBe(true)
    await actAs(db, { user: ana })
    expect(await refused(db, `select duplicate_trip('${trip}', '  ')`)).toBe(true)
    void cleo
  })
})
