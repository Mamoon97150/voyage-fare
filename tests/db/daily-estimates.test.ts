// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { createDb, one } from './helpers'

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
