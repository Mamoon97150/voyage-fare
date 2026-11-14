// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
  await seedTrip(db)
})

const check = () =>
  one<{ days: number; expected_days: number | null; days_mismatch: boolean }>(
    db,
    'select days, expected_days, days_mismatch from v_daily_estimate_checks where trip_id = $1',
    [ids.trip],
  )

describe('daily estimate days vs the trip', () => {
  it('no dates yet: nothing to compare, no flag', async () => {
    expect(await check()).toEqual({ days: 5, expected_days: null, days_mismatch: false })
  })

  it('dates that match the estimate: no flag', async () => {
    await db.exec('begin')
    await db.exec(`update trips set start_date = '2027-03-01', end_date = '2027-03-05' where id = '${ids.trip}'`)
    expect(await check()).toEqual({ days: 5, expected_days: 5, days_mismatch: false })
    await db.exec('rollback')
  })

  it('dates that do not match: flagged, and the estimate is left as the person typed it', async () => {
    await db.exec('begin')
    await db.exec(`update trips set start_date = '2027-03-01', end_date = '2027-03-08' where id = '${ids.trip}'`)
    expect(await check()).toEqual({ days: 5, expected_days: 8, days_mismatch: true })
    const line = await one<{ current: string }>(
      db,
      `select current from v_budget_lines where trip_id = $1 and source = 'daily_estimate'`,
      [ids.trip],
    )
    expect(Number(line.current)).toBe(400) // still 20 × 5 × 4: nothing is readjusted silently
    await db.exec('rollback')
  })

  it('an estimate for one place is compared with that place’s nights', async () => {
    await db.exec('begin')
    await db.exec(`update daily_estimates set place_id = '${ids.lisbon}', days = 3 where trip_id = '${ids.trip}'`)
    expect((await check()).days_mismatch).toBe(false) // 3 nights, 3 days
    await db.exec(`update daily_estimates set days = 4 where trip_id = '${ids.trip}'`)
    expect((await check()).days_mismatch).toBe(false) // 3 nights can be 4 days
    await db.exec(`update daily_estimates set days = 6 where trip_id = '${ids.trip}'`)
    expect(await check()).toEqual({ days: 6, expected_days: 3, days_mismatch: true })
    await db.exec('rollback')
  })
})

describe('saving a daily estimate from the app (build 6)', () => {
  const owner = { user: ids.owner }
  const save = (args: unknown[]) =>
    one<{ id: string }>(db, 'select save_daily_estimate($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as id', args)

  it('adds one for a place, for some travellers, and the budget counts it as estimated', async () => {
    await actAs(db, 'owner')
    await db.exec(`insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`)
    await actAs(db, owner)
    const { id } = await save([null, ids.trip, ids.lisbon, 'local_transport', ' Taxis ', 10, 'EUR', null, 3, [ids.ana, ids.bea]])
    const row = await one<{ label: string; rate: string }>(db, 'select label, rate from daily_estimates where id = $1', [id])
    expect(row).toEqual({ label: 'Taxis', rate: '1.00000000' })
    const people = await rows(db, 'select traveller_id from v_daily_estimate_people where daily_estimate_id = $1', [id])
    expect(people).toHaveLength(2)
    const line = await one<{ current: string; is_confirmed: boolean }>(
      db, `select current, is_confirmed from v_budget_lines where source_id = $1`, [id])
    expect(num(line.current)).toBe(60) // 10 € × 3 days × 2 people
    expect(line.is_confirmed).toBe(false)
  })

  it('changes it: everyone again, another currency with its rate', async () => {
    await actAs(db, owner)
    const { id } = await save([null, ids.trip, ids.porto, 'food', 'Food', 20, 'EUR', null, 2, []])
    await save([id, ids.trip, ids.porto, 'food', 'Food', 30, 'USD', 0.9, 2, [ids.ana, ids.bea, ids.cleo, ids.dana]])
    expect(await rows(db, 'select 1 from daily_estimate_travellers where daily_estimate_id = $1', [id])).toHaveLength(0)
    const line = await one<{ current: string }>(db, `select current from v_budget_lines where source_id = $1`, [id])
    expect(num(line.current)).toBe(216) // 27 € × 2 days × 4 people
    await expect(save([id, ids.trip, ids.porto, 'food', 'Food', 30, 'USD', null, 2, []])).rejects.toThrow('needs its rate')
  })

  it('says what’s missing, and strangers can’t', async () => {
    await actAs(db, owner)
    await expect(save([null, ids.trip, null, 'food', ' ', 30, 'EUR', null, 2, []])).rejects.toThrow('Give it a name')
    await expect(save([null, ids.trip, null, 'food', 'Food', 30, 'EUR', null, 0, []])).rejects.toThrow('at least one day')
    await actAs(db, { user: ids.stranger })
    await expect(save([null, ids.trip, null, 'food', 'Food', 30, 'EUR', null, 2, []])).rejects.toThrow()
    await actAs(db, 'owner')
  })
})
