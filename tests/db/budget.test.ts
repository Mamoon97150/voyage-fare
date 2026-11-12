// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { createDb, num, one, rows } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
  await seedTrip(db)
})

const item = (id: string) =>
  one<Record<string, unknown>>(db, 'select * from v_item_amounts where item_id = $1', [id])

describe('amounts per item', () => {
  it('BR-1: only the chosen option counts', async () => {
    expect(num((await item(ids.flights)).planned)).toBe(1000) // not the 1 200 € option
    const idea = await item(ids.idea)
    expect(idea.planned).toBeNull() // a 60 € option exists, but it is not chosen
    expect(idea.current).toBeNull()
  })

  it('BR-2: current is the actual amount when known, the planned one otherwise', async () => {
    const flights = await item(ids.flights)
    expect(num(flights.planned)).toBe(1000)
    expect(num(flights.actual)).toBe(1040)
    expect(num(flights.current)).toBe(1040)
    const dinner = await item(ids.dinner)
    expect(dinner.actual).toBeNull()
    expect(num(dinner.current)).toBe(90)
  })

  it('BR-3: confirmed needs booked or paid AND an actual amount', async () => {
    expect((await item(ids.flights)).is_confirmed).toBe(true) // paid + actual
    expect((await item(ids.flat)).is_confirmed).toBe(true) // booked + actual
    expect((await item(ids.hotel)).is_confirmed).toBe(false) // priced, not booked

    await db.exec('begin')
    await db.exec(`update items set status = 'booked' where id = '${ids.hotel}'`)
    expect((await item(ids.hotel)).is_confirmed).toBe(false) // booked, but no actual amount
    await db.exec('rollback')
  })

  it('BR-4: no amount stays empty, it is never turned into 0', async () => {
    const insurance = await item(ids.insurance)
    expect(insurance.planned).toBeNull()
    expect(insurance.current).toBeNull()
  })

  it('BR-10: a foreign price is converted with the rate saved at entry', async () => {
    expect(num((await item(ids.hotel)).planned)).toBe(360) // 400 USD × 0.90
  })

  it('SR-4: with rooms, the price of the option is the sum of its rooms', async () => {
    expect(num((await item(ids.flat)).planned)).toBe(500) // 300 + 200
  })
})

describe('trip budget', () => {
  it('adds up planned, current, confirmed and estimated', async () => {
    const b = await one<Record<string, unknown>>(db, 'select * from v_trip_budget where trip_id = $1', [
      ids.trip,
    ])
    expect(num(b.planned_total)).toBe(2580)
    expect(num(b.current_total)).toBe(2620)
    expect(num(b.confirmed_total)).toBe(1770) // flights 1 040 + flat 500 + photo 150 + surf 80
    expect(num(b.estimated_total)).toBe(850) // hotel 360 + dinner 90 + food 400
    expect(num(b.confirmed_total)! + num(b.estimated_total)!).toBe(num(b.current_total))
    expect(Number(b.missing_amount_count)).toBe(1) // the insurance
  })

  it('BR-6: per person is the total divided by the travellers', async () => {
    const b = await one<Record<string, unknown>>(db, 'select * from v_trip_budget where trip_id = $1', [
      ids.trip,
    ])
    expect(Number(b.traveller_count)).toBe(4)
    expect(num(b.current_per_person)).toBe(655)
  })

  it('BR-7: a daily estimate is amount × days × travellers, and always estimated', async () => {
    const line = await one<Record<string, unknown>>(
      db,
      `select * from v_budget_lines where trip_id = $1 and source = 'daily_estimate'`,
      [ids.trip],
    )
    expect(num(line.current)).toBe(400) // 20 × 5 × 4
    expect(line.is_confirmed).toBe(false)
  })

  it('BR-12: compares with the target, per person or total', async () => {
    const read = () =>
      one<Record<string, unknown>>(db, 'select * from v_trip_budget where trip_id = $1', [ids.trip])

    let b = await read() // 700 € per person × 4 = 2 800
    expect(num(b.target_total)).toBe(2800)
    expect(num(b.difference_total)).toBe(-180)
    expect(b.target_status).toBe('under')

    await db.exec('begin')
    await db.exec(`update trips set target_amount = 2500, target_scope = 'total' where id = '${ids.trip}'`)
    b = await read()
    expect(num(b.difference_total)).toBe(120)
    expect(b.target_status).toBe('over')

    await db.exec(`update trips set target_amount = 2620 where id = '${ids.trip}'`)
    expect((await read()).target_status).toBe('on_target')

    await db.exec(`update trips set target_amount = null where id = '${ids.trip}'`)
    b = await read()
    expect(b.target_status).toBeNull()
    expect(b.difference_total).toBeNull()
    await db.exec('rollback')
  })

  it('BR-4: a trip with no amounts has empty totals, not zeros', async () => {
    await db.exec('begin')
    const trip = await one<{ id: string }>(db, `insert into trips (name) values ('Empty') returning id`)
    const b = await one<Record<string, unknown>>(db, 'select * from v_trip_budget where trip_id = $1', [
      trip.id,
    ])
    expect(b.current_total).toBeNull()
    expect(b.current_per_person).toBeNull()
    await db.exec('rollback')
  })

  it('splits the budget by category', async () => {
    const byCategory = Object.fromEntries(
      (
        await rows<Record<string, unknown>>(db, 'select * from v_budget_by_category where trip_id = $1', [
          ids.trip,
        ])
      ).map((r) => [r.category, num(r.current)]),
    )
    expect(byCategory).toEqual({
      main_transport: 1040,
      accommodation: 860,
      activities: 230,
      food: 490, // dinner 90 + daily estimate 400
      insurance: null,
    })
  })

  it('BR-9: by place leaves whole-trip items out', async () => {
    const byPlace = Object.fromEntries(
      (
        await rows<Record<string, unknown>>(db, 'select * from v_budget_by_place where trip_id = $1', [
          ids.trip,
        ])
      ).map((r) => [r.place_id, num(r.current)]),
    )
    expect(byPlace).toEqual({ [ids.lisbon]: 740, [ids.porto]: 440 })
    // 740 + 440 = 1 180, well under the 2 620 trip total: flights, insurance and food are not here.
  })
})

describe('status follows the choice (BR-8)', () => {
  const status = async (id: string) =>
    (await one<{ status: string }>(db, 'select status from items where id = $1', [id])).status

  it('choosing moves an idea to chosen, unchoosing moves it back', async () => {
    await db.exec('begin')
    expect(await status(ids.idea)).toBe('idea')
    await db.exec(`update options set is_chosen = true where item_id = '${ids.idea}'`)
    expect(await status(ids.idea)).toBe('chosen')
    await db.exec(`update options set is_chosen = false where item_id = '${ids.idea}'`)
    expect(await status(ids.idea)).toBe('idea')
    await db.exec('rollback')
  })

  it('choosing another option replaces the first one', async () => {
    await db.exec('begin')
    await db.exec(`update options set is_chosen = true where id = '${ids.flightsDear}'`)
    const chosen = await rows<{ id: string }>(
      db,
      'select id from options where item_id = $1 and is_chosen',
      [ids.flights],
    )
    expect(chosen.map((o) => o.id)).toEqual([ids.flightsDear])
    expect(num((await item(ids.flights)).planned)).toBe(1200)
    await db.exec('rollback')
  })

  it('booked and paid never go back down on their own', async () => {
    await db.exec('begin')
    await db.exec(`update options set is_chosen = false where item_id = '${ids.flat}'`)
    expect(await status(ids.flat)).toBe('booked')
    await db.exec(`update options set is_chosen = false where item_id = '${ids.flights}'`)
    expect(await status(ids.flights)).toBe('paid')
    await db.exec('rollback')
  })

  it('paid needs an actual amount and a payer (SR-6)', async () => {
    await expect(
      db.exec(`update items set status = 'paid' where id = '${ids.dinner}'`),
    ).rejects.toThrow()
  })
})
