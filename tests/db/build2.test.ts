// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, refused as refusedIn, rows } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
  await seedTrip(db)
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const t = ids.trip

/** refused() needs a transaction around it. */
async function refused(database: PGlite, sql: string) {
  await database.exec('begin')
  try {
    return await refusedIn(database, sql)
  } finally {
    await database.exec('commit')
  }
}
const train = '40000000-0000-0000-0000-000000000009'

type Totals = { current: number | null; confirmed: number | null; estimated: number | null }

async function totals(view: string, key: string, traveller: string): Promise<Record<string, Totals>> {
  const result = await rows<Record<string, unknown>>(
    db,
    `select * from ${view} where trip_id = $1 and traveller_id = $2`,
    [t, traveller],
  )
  return Object.fromEntries(
    result.map((r) => [
      r[key] as string,
      { current: num(r.current), confirmed: num(r.confirmed), estimated: num(r.estimated) },
    ]),
  )
}

describe('where the trip starts from', () => {
  it('a trip can have a home city with its coordinates', async () => {
    await db.exec(`update trips set home_city = 'St Martin', home_latitude = 18.07, home_longitude = -63.05
                   where id = '${t}'`)
    const trip = await one<Record<string, unknown>>(db, 'select home_city from trips where id = $1', [t])
    expect(trip.home_city).toBe('St Martin')
  })

  it('a blank home city is refused', async () => {
    expect(await refused(db, `update trips set home_city = '  ' where id = '${t}'`)).toBe(true)
  })
})

describe('ticket legs', () => {
  it('a round trip is one item with two legs, placed in the route', async () => {
    // The fixture's flights become St Martin ⇄ Paris: out before Lisbon, back after Porto.
    await db.exec(`
      insert into item_legs (trip_id, item_id, leg_number, from_name, to_name, after_place_id) values
        ('${t}', '${ids.flights}', 1, 'St Martin', 'Paris', null),
        ('${t}', '${ids.flights}', 2, 'Paris', 'St Martin', '${ids.porto}');
    `)
    const legs = await rows<Record<string, unknown>>(
      db,
      'select from_name, to_name, after_place_id from item_legs where item_id = $1 order by leg_number',
      [ids.flights],
    )
    expect(legs).toEqual([
      { from_name: 'St Martin', to_name: 'Paris', after_place_id: null },
      { from_name: 'Paris', to_name: 'St Martin', after_place_id: ids.porto },
    ])
  })

  it('the round trip is still counted once', async () => {
    const a = await one<Record<string, unknown>>(db, 'select current from v_item_amounts where item_id = $1', [
      ids.flights,
    ])
    expect(num(a.current)).toBe(1040)
  })

  it('a ticket has at most two legs', async () => {
    expect(
      await refused(
        db,
        `insert into item_legs (trip_id, item_id, leg_number, from_name, to_name)
         values ('${t}', '${ids.flights}', 3, 'Paris', 'Lisbon')`,
      ),
    ).toBe(true)
    expect(
      await refused(
        db,
        `insert into item_legs (trip_id, item_id, leg_number, from_name, to_name)
         values ('${t}', '${ids.flights}', 2, 'Paris', 'Lisbon')`,
      ),
    ).toBe(true)
  })

  it('only a transport item can have legs', async () => {
    expect(
      await refused(
        db,
        `insert into item_legs (trip_id, item_id, leg_number, from_name, to_name)
         values ('${t}', '${ids.surf}', 1, 'Beach', 'Hotel')`,
      ),
    ).toBe(true)
  })

  it('a one-way train between places has one leg, with its own mode', async () => {
    await db.exec(`
      insert into items (id, trip_id, kind, category, name) values
        ('${train}', '${t}', 'transport', 'local_transport', 'Train to Porto');
      insert into item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, after_place_id)
        values ('${t}', '${train}', 1, 'train', 'Lisbon', 'Porto', '${ids.lisbon}');
    `)
    const leg = await one<Record<string, unknown>>(db, 'select mode from item_legs where item_id = $1', [train])
    expect(leg.mode).toBe('train')
  })

  it('a leg cannot point at another trip’s place', async () => {
    await db.exec(`
      insert into trips (id, name, created_by) values
        ('10000000-0000-0000-0000-000000000002', 'Other trip', '${ids.owner}');
      insert into places (id, trip_id, name) values
        ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'Elsewhere');
    `)
    expect(
      await refused(
        db,
        `update item_legs set after_place_id = '30000000-0000-0000-0000-000000000009'
         where item_id = '${train}'`,
      ),
    ).toBe(true)
  })

  it('deleting the ticket deletes its legs; deleting a place keeps the leg', async () => {
    await db.exec('begin')
    await db.exec(`delete from places where id = '${ids.lisbon}'`)
    const leg = await one<Record<string, unknown>>(db, 'select after_place_id from item_legs where item_id = $1', [
      train,
    ])
    expect(leg.after_place_id).toBeNull()
    await db.exec(`delete from items where id = '${train}'`)
    expect(await rows(db, 'select 1 from item_legs where item_id = $1', [train])).toEqual([])
    await db.exec('rollback')
  })

  it('legs follow the trip’s privacy', async () => {
    await actAs(db, { user: ids.stranger })
    expect(await rows(db, 'select 1 from item_legs')).toEqual([])
    expect(
      await refused(
        db,
        `insert into item_legs (trip_id, item_id, leg_number, from_name, to_name)
         values ('${t}', '${train}', 2, 'Porto', 'Lisbon')`,
      ),
    ).toBe(true)
    await actAs(db, 'anon')
    expect(await rows(db, 'select 1 from item_legs')).toEqual([])
    await actAs(db, { user: ids.owner })
    expect((await rows(db, 'select 1 from item_legs where trip_id = $1', [t])).length).toBe(3)
  })
})

describe('each traveller’s own share, by category and by place', () => {
  // The train added above has no option: it adds nothing to anyone's share.

  it('Ana, by category: insurance has no amount, so it stays a dash', async () => {
    expect(await totals('v_traveller_by_category', 'category', ids.ana)).toEqual({
      main_transport: { current: 260, confirmed: 260, estimated: null },
      local_transport: { current: null, confirmed: null, estimated: null },
      accommodation: { current: 240, confirmed: 150, estimated: 90 }, // big room 150 + Porto 90
      activities: { current: 90, confirmed: 90, estimated: null }, // photo 50 + surf 40
      food: { current: 130, confirmed: null, estimated: 130 }, // dinner 30 + daily food 100
      insurance: { current: null, confirmed: null, estimated: null },
    })
  })

  it('Dana, by category: the gift day and the surf lesson are not hers', async () => {
    const dana = await totals('v_traveller_by_category', 'category', ids.dana)
    expect(dana.activities).toBeUndefined()
    expect(dana.food).toEqual({ current: 100, confirmed: null, estimated: 100 })
    expect(dana.accommodation).toEqual({ current: 190, confirmed: 100, estimated: 90 }) // small room 100 + Porto 90
  })

  it('by place: whole-trip lines are left out', async () => {
    expect(await totals('v_traveller_by_place', 'place_id', ids.ana)).toEqual({
      [ids.lisbon]: { current: 230, confirmed: 200, estimated: 30 }, // room 150 + photo 50 + dinner 30
      [ids.porto]: { current: 130, confirmed: 40, estimated: 90 }, // hotel 90 + surf 40
    })
    expect(await totals('v_traveller_by_place', 'place_id', ids.dana)).toEqual({
      [ids.lisbon]: { current: 100, confirmed: 100, estimated: null },
      [ids.porto]: { current: 90, confirmed: null, estimated: 90 },
    })
  })

  it('the categories add up to each traveller’s share', async () => {
    const check = await rows<Record<string, unknown>>(
      db,
      `select s.traveller_id, s.share_current, sum(c.current) as by_category
       from v_traveller_shares s
       join v_traveller_by_category c on c.traveller_id = s.traveller_id
       where s.trip_id = $1
       group by s.traveller_id, s.share_current`,
      [t],
    )
    expect(check).toHaveLength(4)
    for (const r of check) expect(num(r.by_category)).toBe(num(r.share_current))
  })

  it('someone else sees no one’s share', async () => {
    await actAs(db, { user: ids.stranger })
    expect(await rows(db, 'select 1 from v_traveller_by_category')).toEqual([])
    expect(await rows(db, 'select 1 from v_traveller_by_place')).toEqual([])
  })
})
