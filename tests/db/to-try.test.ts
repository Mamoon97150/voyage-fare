// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

// Mockup to-try-v5 (15 Nov): restaurants kept with a place, not a day, put on a day later.
let db: PGlite
const owner = { user: ids.owner }

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(
    `insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`,
  )
  await actAs(db, owner)
})

const add = async (name: string, amount: number | null = null, link: string | null = null) =>
  (
    await one<{ id: string }>(db, 'select add_to_try($1, $2, $3, $4, $5) as id', [
      ids.porto,
      name,
      link,
      'the octopus!',
      amount,
    ])
  ).id
const item = (id: string) =>
  one<{
    status: string
    day_number: number | null
    meal: string | null
    link: string | null
    note: string | null
    kind: string
  }>(db, 'select * from items where id = $1', [id])
const total = async () =>
  num((await one(db, 'select current_total from v_trip_budget where trip_id = $1', [ids.trip])).current_total)
const missing = async () =>
  num(
    (await one(db, 'select missing_amount_count from v_trip_budget where trip_id = $1', [ids.trip]))
      .missing_amount_count,
  )

describe('the pool', () => {
  it('a restaurant with its link and note, in the place, no day, not in the budget', async () => {
    const before = await total()
    const id = await add('Taberna', 120, 'https://www.instagram.com/p/abc')
    expect(await item(id)).toMatchObject({
      kind: 'restaurant',
      status: 'idea',
      day_number: null,
      link: 'https://www.instagram.com/p/abc',
      note: 'the octopus!',
    })
    expect(await total()).toBe(before)
    expect(await rows(db, 'select * from options where item_id = $1 and not is_chosen', [id])).toHaveLength(1)
  })

  it('needs a name; a link must be a web address', async () => {
    await expect(add('  ')).rejects.toThrow('Give it a name.')
    await expect(add('Taberna', null, 'instagram')).rejects.toThrow()
  })

  it('on a day its price counts; back to To try, it stops counting', async () => {
    const before = await total()
    const id = await add('Taberna', 120)
    await db.query('select set_restaurant_day($1, 4, $2)', [id, 'dinner'])
    expect(await item(id)).toMatchObject({ status: 'chosen', day_number: 4, meal: 'dinner' })
    expect(await total()).toBe((before as number) + 120)

    await db.query('select set_restaurant_day($1, null)', [id])
    expect(await item(id)).toMatchObject({ status: 'idea', day_number: null, meal: null })
    expect(await total()).toBe(before)
  })

  it('no price, on a day: no missing price, nothing added (it’s in the food estimate)', async () => {
    const [before, missingBefore] = [await total(), await missing()]
    const id = await add('Café')
    await db.query('select set_restaurant_day($1, 5, null)', [id])
    expect(await item(id)).toMatchObject({ status: 'idea', day_number: 5 })
    expect(await total()).toBe(before)
    expect(await missing()).toBe(missingBefore)
  })

  it('loved it, fine, skip', async () => {
    const id = await add('Taberna', 120)
    await db.query('select set_restaurant_day($1, 4, $2)', [id, 'lunch'])
    await db.query(`update items set verdict = 'loved' where id = $1`, [id])
    expect((await one<{ verdict: string }>(db, 'select verdict from items where id = $1', [id])).verdict).toBe('loved')
    await expect(db.query(`update items set verdict = 'meh' where id = $1`, [id])).rejects.toThrow()
  })

  it('change it: name, place, note, price (still not counting)', async () => {
    const before = await total()
    const id = await add('Taberna')
    await db.query('select update_to_try($1, $2, $3, $4, $5, $6)', [
      id,
      ids.lisbon,
      'Taberna da Rua',
      null,
      'go early',
      90,
    ])
    expect(await item(id)).toMatchObject({ status: 'idea', note: 'go early', link: null })
    expect((await one<{ place_id: string }>(db, 'select place_id from items where id = $1', [id])).place_id).toBe(
      ids.lisbon,
    )
    expect(num((await one(db, 'select amount from options where item_id = $1', [id])).amount)).toBe(90)
    expect(await total()).toBe(before)
    await db.query('select update_to_try($1, $2, $3, null, null, null)', [id, ids.lisbon, 'Taberna da Rua'])
    expect(await rows(db, 'select * from options where item_id = $1', [id])).toHaveLength(0)
  })

  it('only for the trip’s people', async () => {
    await actAs(db, { user: ids.stranger })
    await expect(add('Taberna')).rejects.toThrow()
  })
})
