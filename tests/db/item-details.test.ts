// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one } from './helpers'

// Forms by kind (build 8¾, mockup kinds-v6, 16 Nov): each kind keeps its own details.
let db: PGlite

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(
    `insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`,
  )
  await actAs(db, { user: ids.owner })
})

const total = async () =>
  num((await one(db, 'select current_total from v_trip_budget where trip_id = $1', [ids.trip])).current_total)

describe('details by kind', () => {
  it('an activity, a car rental and getting around keep their details', async () => {
    const id = (
      await one<{ id: string }>(db, `select add_item($1, 'car_rental', 'Times', $2, 2, 4, 210) as id`, [
        ids.trip,
        ids.porto,
      ])
    ).id
    await db.query(
      `update items set from_place = 'Naha', to_place = 'Naha airport', insurance_included = false, deposit = 300
       where id = $1`,
      [id],
    )
    const row = await one<{ deposit: string; category: string }>(db, 'select * from items where id = $1', [id])
    expect(num(row.deposit)).toBe(300)
    expect(row.category).toBe('local_transport')

    const act = (
      await one<{ id: string }>(db, `select add_item($1, 'activity', 'Fushimi Inari', $2, 3, null, 50) as id`, [
        ids.trip,
        ids.porto,
      ])
    ).id
    await db.query(
      `update items set start_time = '07:00', duration = '2 h', needs_booking = true, price_per_person = true
       where id = $1`,
      [act],
    )
    expect(await one(db, 'select start_time, duration, needs_booking, price_per_person from items where id = $1', [act]))
      .toMatchObject({ start_time: '07:00:00', duration: '2 h', needs_booking: true, price_per_person: true })
  })

  it('the deposit is held, not spent: the budget only counts the rental', async () => {
    const before = await total()
    const id = (
      await one<{ id: string }>(db, `select add_item($1, 'car_rental', 'Times', $2, 2, 4, 210) as id`, [
        ids.trip,
        ids.porto,
      ])
    ).id
    await db.query('update items set deposit = 300 where id = $1', [id])
    expect(await total()).toBe((before as number) + 210)
  })

  it('a mode of getting around from the list only', async () => {
    const id = (
      await one<{ id: string }>(db, `select add_item($1, 'transport', 'Ferry', $2, 2) as id`, [ids.trip, ids.porto])
    ).id
    await db.query(`update items set local_mode = 'ferry' where id = $1`, [id])
    await expect(db.query(`update items set local_mode = 'rocket' where id = $1`, [id])).rejects.toThrow()
  })
})

describe('To try holds activities too', () => {
  it('an activity in the pool: no day, not counted; on a day it counts', async () => {
    const before = await total()
    const id = (
      await one<{ id: string }>(db, `select add_to_try($1, 'Tea ceremony', null, null, 100, 'activity') as id`, [
        ids.porto,
      ])
    ).id
    expect(await one(db, 'select kind, category, status from items where id = $1', [id])).toMatchObject({
      kind: 'activity',
      category: 'activities',
      status: 'idea',
    })
    expect(await total()).toBe(before)
    await db.query('select set_restaurant_day($1, 3, null)', [id])
    expect(await total()).toBe((before as number) + 100)
  })

  it('restaurants by default; nothing else goes in', async () => {
    const id = (await one<{ id: string }>(db, `select add_to_try($1, 'Taberna') as id`, [ids.porto])).id
    expect((await one<{ kind: string }>(db, 'select kind from items where id = $1', [id])).kind).toBe('restaurant')
    await expect(db.query(`select add_to_try($1, 'Hotel', null, null, null, 'housing')`, [ids.porto])).rejects.toThrow(
      'To try is for restaurants and activities.',
    )
  })
})

describe('a duplicated trip', () => {
  it('keeps the details', async () => {
    const id = (
      await one<{ id: string }>(db, `select add_item($1, 'restaurant', 'Kikunoi', $2, 3, null, 180) as id`, [
        ids.trip,
        ids.porto,
      ])
    ).id
    await db.query(
      `update items set food_kind = 'kaiseki', needs_booking = true, price_per_person = true where id = $1`,
      [id],
    )
    const copy = (await one<{ id: string }>(db, `select duplicate_trip($1, 'Again') as id`, [ids.trip])).id
    expect(
      await one(db, `select food_kind, needs_booking, price_per_person from items where trip_id = $1 and name = 'Kikunoi'`, [
        copy,
      ]),
    ).toMatchObject({ food_kind: 'kaiseki', needs_booking: true, price_per_person: true })
  })
})
