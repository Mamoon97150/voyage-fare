// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, refused, rows } from './helpers'

let db: PGlite
const owner = { user: ids.owner }
const stranger = { user: ids.stranger }

beforeAll(async () => {
  db = await createDb()
  await seedTrip(db)
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const count = async (table: string) =>
  Number((await one<{ n: string }>(db, `select count(*) as n from ${table}`)).n)

describe('a trip is visible only to its members', () => {
  it('whoever creates a trip becomes its owner', async () => {
    const member = await one<{ role: string }>(
      db,
      'select role from trip_members where trip_id = $1 and user_id = $2',
      [ids.trip, ids.owner],
    )
    expect(member.role).toBe('owner')
  })

  it('a member sees the trip and its budget', async () => {
    await actAs(db, owner)
    expect(await count('trips')).toBe(1)
    expect(await count('items')).toBe(8)
    const b = await one<Record<string, unknown>>(db, 'select * from v_trip_budget')
    expect(num(b.current_total)).toBe(2620)
    expect((await rows(db, 'select * from trip_settlement($1)', [ids.trip])).length).toBe(3)
  })

  it('someone else sees nothing at all, through tables or through the budget', async () => {
    await actAs(db, stranger)
    for (const table of ['trips', 'travellers', 'items', 'options', 'rooms', 'repayments']) {
      expect(await count(table)).toBe(0)
    }
    expect(await count('v_trip_budget')).toBe(0)
    expect(await count('v_traveller_balances')).toBe(0)
    expect((await rows(db, 'select * from trip_settlement($1)', [ids.trip])).length).toBe(0)
  })

  it('someone else cannot change or add anything', async () => {
    await actAs(db, stranger)
    await db.exec(`update items set name = 'hacked' where trip_id = '${ids.trip}'`)
    await db.exec(`delete from options where trip_id = '${ids.trip}'`)
    await expect(
      db.exec(`insert into travellers (trip_id, name) values ('${ids.trip}', 'Intruder')`),
    ).rejects.toThrow()
    await actAs(db, 'owner')
    expect(await count(`items where name = 'hacked'`)).toBe(0)
    expect(await count('options')).toBe(10)
    expect(await count('travellers')).toBe(4)
  })

  it('a visitor without an account sees nothing', async () => {
    await actAs(db, 'anon')
    expect(await count('trips')).toBe(0)
    expect(await count('items')).toBe(0)
  })

  it('a signed-in user can create their own trip, and only as themselves', async () => {
    await db.exec('begin')
    await actAs(db, stranger)
    const trip = await one<{ id: string }>(db, `insert into trips (name) values ('Mine') returning id`)
    await db.exec(`insert into travellers (trip_id, name) values ('${trip.id}', 'Me')`)
    expect(await count('trips')).toBe(1)
    expect(
      await refused(db, `insert into trips (name, created_by) values ('Not mine', '${ids.owner}')`),
    ).toBe(true)
    await actAs(db, 'owner')
    await db.exec('rollback')
  })
})

describe('the demo trip is public and read-only', () => {
  it('anyone can read it, nobody can change it', async () => {
    await db.exec('begin')
    await db.exec(`update trips set is_demo = true, created_by = null where id = '${ids.trip}';
                   delete from trip_members where trip_id = '${ids.trip}'`)

    await actAs(db, 'anon')
    expect(await count('trips')).toBe(1)
    expect(await count('items')).toBe(8)
    expect(num((await one<Record<string, unknown>>(db, 'select * from v_trip_budget')).current_total)).toBe(2620)
    expect(await refused(db, `update items set name = 'x'`)).toBe(true) // no write right at all

    await actAs(db, stranger)
    expect(await count('items')).toBe(8)
    await db.exec(`update items set name = 'x'`)
    await db.exec(`update trips set name = 'x'`)
    await actAs(db, 'owner')
    expect(await count(`items where name = 'x'`)).toBe(0)
    expect(await count(`trips where name = 'x'`)).toBe(0)
    await db.exec('rollback')
  })
})
