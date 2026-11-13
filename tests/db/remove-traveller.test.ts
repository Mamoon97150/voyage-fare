// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

// The made-up trip: Ana paid the flights, Bea the photo shoot, Cleo the surf lesson;
// the surf lesson is split between Ana and Cleo; Dana paid nothing but shares paid items.
let db: PGlite
const owner = { user: ids.owner }

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(`insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`)
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const remove = (id: string) => db.query('select remove_traveller($1)', [id])
const travellerNames = async () =>
  (await rows<{ name: string }>(db, 'select name from travellers where trip_id = $1 order by position', [ids.trip])).map((r) => r.name)

describe('removing a traveller', () => {
  it('someone who paid, or owes for paid items, must settle up first', async () => {
    await actAs(db, owner)
    await expect(remove(ids.bea)).rejects.toThrow('Bea has paid or owes money on this trip: settle up first.')
    await expect(remove(ids.dana)).rejects.toThrow('settle up first') // owes her part of the flights
    expect(await travellerNames()).toEqual(['Ana', 'Bea', 'Cleo', 'Dana'])
  })

  it('once nothing is paid, they can go and the others share more', async () => {
    await actAs(db, 'owner')
    await db.exec(`update items set status = 'chosen', actual_amount = null, actual_currency = null, paid_by = null where trip_id = '${ids.trip}'`)
    await actAs(db, owner)
    const before = num((await one<{ s: string }>(db, 'select share_current as s from v_traveller_shares where traveller_id = $1', [ids.ana])).s)
    await remove(ids.dana)
    expect(await travellerNames()).toEqual(['Ana', 'Bea', 'Cleo'])
    const after = num((await one<{ s: string }>(db, 'select share_current as s from v_traveller_shares where traveller_id = $1', [ids.ana])).s)
    expect(after).toBeGreaterThan(before!)
  })

  it('the only one on an item: change that item first', async () => {
    await actAs(db, 'owner')
    await db.exec(`
      update items set status = 'chosen', actual_amount = null, actual_currency = null, paid_by = null where trip_id = '${ids.trip}';
      delete from item_split_travellers where item_id = '${ids.surf}' and traveller_id = '${ids.ana}';
    `)
    await actAs(db, owner)
    await expect(remove(ids.cleo)).rejects.toThrow('Cleo is the only one on “Surf lesson”: change that first.')
  })

  it('not yourself, and not the last traveller', async () => {
    await actAs(db, 'owner')
    await db.exec(`update travellers set user_id = '${ids.owner}' where id = '${ids.ana}'`)
    await actAs(db, owner)
    await expect(remove(ids.ana)).rejects.toThrow('You can’t remove yourself'.replace('’', "'"))

    await actAs(db, 'owner')
    const solo = (await one<{ id: string }>(db, `insert into trips (name, created_by) values ('Solo', '${ids.owner}') returning id`)).id
    const me = (await one<{ id: string }>(db, `insert into travellers (trip_id, name) values ($1, 'Me') returning id`, [solo])).id
    await actAs(db, owner)
    await expect(remove(me)).rejects.toThrow('A trip needs at least one traveller.')
  })

  it('someone else can’t remove anyone', async () => {
    await actAs(db, { user: ids.stranger })
    await expect(remove(ids.dana)).rejects.toThrow()
    await actAs(db, 'owner')
    expect(await travellerNames()).toHaveLength(4)
  })
})
