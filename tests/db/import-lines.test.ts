// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000e1'
const stranger = '00000000-0000-0000-0000-0000000000e2'
let trip: string
let lisbon: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (
    await one<{ id: string }>(
      db,
      `select create_trip(p_name => 'Lisbon & Porto', p_me => 'Ana', p_travellers => array['Bea']) as id`,
    )
  ).id
  lisbon = (
    await one<{ id: string }>(
      db,
      `insert into places (trip_id, name, nights, position) values ($1, 'Lisbon', 3, 1) returning id`,
      [trip],
    )
  ).id
  await actAs(db, 'owner')
})

afterEach(async () => {
  await actAs(db, 'owner')
})

/** refused() needs a transaction around it. */
async function refused(database: PGlite, sql: string) {
  await database.exec('begin')
  const result = await refusedIn(database, sql)
  await database.exec('commit')
  return result
}

const payload = {
  places: [
    {
      id: null as string | null,
      name: 'Évora',
      nights: 1,
      lines: [
        { kind: 'housing', name: 'Where we sleep', options: [{ name: 'Albergaria do Calvário', amount: 110 }] },
        { kind: 'restaurant', name: 'Tasquinha do Oliveira', note: 'book ahead' },
        {
          kind: 'activity',
          name: 'Day out',
          day: 4,
          options: [
            { name: 'Chapel of Bones', amount: 6 },
            { name: 'Wine tasting', amount: 2400, currency: 'JPY', rate: 0.0062, link: 'https://x.test' },
          ],
        },
      ],
    },
    { id: '', name: '', nights: 0, lines: [] },
  ],
  tickets: [{ from: 'Lisbon', to: 'Évora', mode: 'bus', day: 4, after_new: null, after_place: '', options: [] }],
}

describe('import from my AI: import_lines', () => {
  it('adds a new place at the end of the route, its lines and options, and a ticket, in one go', async () => {
    await actAs(db, { user: ana })
    const body = {
      places: [
        { ...payload.places[0] },
        { id: lisbon, lines: [{ kind: 'activity', name: 'Belém tower', day: 2, options: [{ amount: 10 }] }] },
      ],
      tickets: [{ ...payload.tickets[0], after_place: lisbon }],
    }
    const result = await one<{ r: { places: number; lines: number } }>(db, 'select import_lines($1, $2) as r', [
      trip,
      JSON.stringify(body),
    ])
    expect(result.r).toEqual({ places: 1, lines: 5 })

    const evora = await one<{ id: string; position: number; nights: number }>(
      db,
      `select id, position, nights from places where trip_id = $1 and name = 'Évora'`,
      [trip],
    )
    expect(evora.position).toBe(2)
    expect(evora.nights).toBe(1)

    const lines = await rows<{
      name: string
      kind: string
      category: string
      status: string
      day_number: number | null
      note: string | null
    }>(db, 'select name, kind, category, status, day_number, note from items where place_id = $1 order by position', [
      evora.id,
    ])
    expect(lines).toEqual([
      {
        name: 'Where we sleep',
        kind: 'housing',
        category: 'accommodation',
        status: 'chosen',
        day_number: null,
        note: null,
      },
      // A restaurant with no day goes to To try: an idea, not counted.
      {
        name: 'Tasquinha do Oliveira',
        kind: 'restaurant',
        category: 'food',
        status: 'idea',
        day_number: null,
        note: 'book ahead',
      },
      // Two options: nothing chosen for you.
      { name: 'Day out', kind: 'activity', category: 'activities', status: 'idea', day_number: 4, note: null },
    ])

    const options = await rows<{
      name: string
      amount: string
      currency: string
      rate: string
      is_chosen: boolean
      link: string | null
    }>(
      db,
      `select o.name, o.amount, o.currency, o.rate, o.is_chosen, o.link from options o join items i on i.id = o.item_id
       where i.name = 'Day out' order by o.position`,
    )
    expect(options.map((o) => [o.name, num(o.amount), o.currency, num(o.rate), o.is_chosen, o.link])).toEqual([
      ['Chapel of Bones', 6, 'EUR', 1, false, null],
      ['Wine tasting', 2400, 'JPY', 0.0062, false, 'https://x.test'],
    ])

    // In an existing place: the line, its single option named after it, counted.
    const belem = await one<{ status: string; name: string }>(
      db,
      `select i.status, o.name from items i join options o on o.item_id = i.id where i.place_id = $1 and i.name = 'Belém tower'`,
      [lisbon],
    )
    expect(belem).toEqual({ status: 'chosen', name: 'Belém tower' })

    // The ticket: a transport line with its leg after Lisbon.
    const leg = await one<{ name: string; mode: string; after_place_id: string; day_number: number; category: string }>(
      db,
      `select i.name, l.mode, l.after_place_id, l.day_number, i.category from item_legs l join items i on i.id = l.item_id
       where l.trip_id = $1`,
      [trip],
    )
    expect(leg).toEqual({
      name: 'Lisbon → Évora',
      mode: 'bus',
      after_place_id: lisbon,
      day_number: 4,
      category: 'main_transport',
    })
  })

  it('all or nothing: one bad line, nothing is written', async () => {
    await actAs(db, { user: ana })
    const before = await one<{ n: number }>(db, 'select count(*)::int as n from items where trip_id = $1', [trip])
    const bad = { places: [{ name: 'Porto', nights: 2, lines: [{ kind: 'spaceship', name: 'Nope' }] }] }
    expect(await refused(db, `select import_lines('${trip}', '${JSON.stringify(bad)}')`)).toBe(true)
    const after = await one<{ n: number }>(db, 'select count(*)::int as n from items where trip_id = $1', [trip])
    expect(after.n).toBe(before.n)
    expect(await rows(db, `select 1 from places where trip_id = $1 and name = 'Porto'`, [trip])).toEqual([])
  })

  it('someone else’s trip: refused', async () => {
    await actAs(db, { user: stranger })
    const body = { places: [{ name: 'Sneaky', nights: 1, lines: [] }] }
    expect(await refused(db, `select import_lines('${trip}', '${JSON.stringify(body)}')`)).toBe(true)
  })

  it('a place from another trip: refused', async () => {
    await actAs(db, { user: ana })
    const other = (await one<{ id: string }>(db, `select create_trip(p_name => 'Other', p_me => 'Ana') as id`)).id
    const body = { places: [{ id: lisbon, lines: [{ kind: 'activity', name: 'x' }] }] }
    expect(await refused(db, `select import_lines('${other}', '${JSON.stringify(body)}')`)).toBe(true)
  })
})
