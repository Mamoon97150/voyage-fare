// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

// Mockup package-v4 (14 Nov): an agency package covers the flights and the Lisbon flat.
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

const addPackage = async (amount: number | null = 1200) =>
  (await one<{ id: string }>(db, `select add_item($1, 'package', 'Agency package', null, null, null, $2) as id`, [ids.trip, amount])).id
const amounts = (id: string) =>
  one<{ current: string; is_confirmed: boolean; category: string }>(db, 'select current, is_confirmed, category from v_item_amounts where item_id = $1', [id])
const total = async () => num((await one<{ t: string }>(db, 'select current_total as t from v_trip_budget where trip_id = $1', [ids.trip])).t)

describe('agency packages', () => {
  it('a package is its own category, on the whole trip only', async () => {
    await actAs(db, owner)
    const pkg = await addPackage()
    expect((await amounts(pkg)).category).toBe('package')
    await expect(db.query(`select add_item($1, 'package', 'Nope', $2)`, [ids.trip, ids.lisbon])).rejects.toThrow('belongs to the whole trip')
  })

  it('covered lines count 0, and are confirmed once the package is booked', async () => {
    await actAs(db, owner)
    const before = await total()
    const pkg = await addPackage(1200)
    await db.query('select set_package_cover($1, $2)', [pkg, [ids.flights, ids.flat]])
    expect(num((await amounts(ids.flights)).current)).toBe(0)
    expect(num((await amounts(ids.flat)).current)).toBe(0)
    expect((await amounts(ids.flat)).is_confirmed).toBe(false) // the package is only chosen
    // Flights (1 040) and flat (500) leave; the package (1 200) comes in.
    expect(await total()).toBe(before! - 1040 - 500 + 1200)
    await db.query(`select set_item_status($1, 'booked', 1200)`, [pkg])
    expect((await amounts(ids.flat)).is_confirmed).toBe(true)
  })

  it('setting what it covers replaces the list; a line can join or leave on its own', async () => {
    await actAs(db, owner)
    const pkg = await addPackage()
    await db.query('select set_package_cover($1, $2)', [pkg, [ids.flights, ids.flat]])
    await db.query('select set_package_cover($1, $2)', [pkg, [ids.flat]])
    const covered = await rows<{ id: string }>(db, 'select id from items where package_id = $1', [pkg])
    expect(covered.map((r) => r.id)).toEqual([ids.flat])
    await db.query('select set_item_package($1, $2)', [ids.hotel, pkg])
    await db.query('select set_item_package($1, null)', [ids.flat])
    expect((await rows<{ id: string }>(db, 'select id from items where package_id = $1', [pkg])).map((r) => r.id)).toEqual([ids.hotel])
  })

  it('no package in a package, no line from elsewhere; deleting the package frees its lines', async () => {
    await actAs(db, owner)
    const pkg = await addPackage()
    const other = await addPackage()
    await expect(db.query('select set_package_cover($1, $2)', [pkg, [other]])).rejects.toThrow('not another package')
    await expect(db.query('select set_item_package($1, $2)', [ids.flat, ids.flights])).rejects.toThrow('isn’t on this trip'.replace('’', '’'))
    await db.query('select set_package_cover($1, $2)', [pkg, [ids.flat]])
    await db.query('delete from items where id = $1', [pkg])
    expect((await one<{ package_id: string | null }>(db, 'select package_id from items where id = $1', [ids.flat])).package_id).toBeNull()
    expect(num((await amounts(ids.flat)).current)).toBe(500)
  })

  it('strangers can’t', async () => {
    await actAs(db, owner)
    const pkg = await addPackage()
    await actAs(db, { user: ids.stranger })
    await db.query('select set_package_cover($1, $2)', [pkg, [ids.flat]]).catch(() => {})
    await actAs(db, 'owner')
    expect((await rows(db, 'select 1 from items where package_id = $1', [pkg]))).toHaveLength(0)
  })
})
