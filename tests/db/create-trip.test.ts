// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, one, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000b1'
const bea = '00000000-0000-0000-0000-0000000000b2'

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${bea}')`)
})

afterEach(async () => {
  await actAs(db, 'owner')
})

async function create(sql: string) {
  return (await one<{ id: string }>(db, `select create_trip(${sql}) as id`)).id
}

describe('creating a trip', () => {
  it('saves the trip, you as the first traveller, then the others in order', async () => {
    await actAs(db, { user: ana })
    const id = await create(`p_name => ' Colombia ', p_me => 'Ana', p_travellers => array['Bea', '  ', 'Cleo'],
      p_home_city => 'St Martin', p_home_latitude => 18.07, p_home_longitude => -63.05,
      p_currency => 'EUR', p_target_amount => 2500, p_target_scope => 'per_person'`)

    const trip = await one<Record<string, unknown>>(db, 'select * from trips where id = $1', [id])
    expect(trip).toMatchObject({ name: 'Colombia', home_city: 'St Martin', currency: 'EUR', target_scope: 'per_person' })
    expect(trip.created_by).toBe(ana)

    const travellers = await rows<Record<string, unknown>>(
      db,
      'select name, user_id from travellers where trip_id = $1 order by position',
      [id],
    )
    expect(travellers).toEqual([
      { name: 'Ana', user_id: ana },
      { name: 'Bea', user_id: null },
      { name: 'Cleo', user_id: null }, // the blank name was skipped
    ])

    const member = await one<{ role: string }>(db, 'select role from trip_members where trip_id = $1', [id])
    expect(member.role).toBe('owner')
  })

  it('only the name is needed', async () => {
    await actAs(db, { user: ana })
    const id = await create(`p_name => 'Somewhere', p_me => 'Ana'`)
    const trip = await one<Record<string, unknown>>(db, 'select * from trips where id = $1', [id])
    expect(trip).toMatchObject({ start_date: null, home_city: null, currency: 'EUR', target_amount: null })
    expect(await rows(db, 'select 1 from travellers where trip_id = $1', [id])).toHaveLength(1)
  })

  it('all or nothing: a bad value leaves no half-made trip', async () => {
    await actAs(db, { user: ana })
    const before = (await rows(db, 'select 1 from trips')).length
    await expect(create(`p_name => '   ', p_me => 'Ana'`)).rejects.toThrow()
    await expect(create(`p_name => 'Bad dates', p_me => 'Ana', p_start_date => '2027-02-10', p_end_date => '2027-02-01'`)).rejects.toThrow()
    expect(await rows(db, 'select 1 from trips')).toHaveLength(before)
  })

  it('needs an account, and the trip stays private', async () => {
    await actAs(db, 'anon')
    await expect(create(`p_name => 'Sneaky', p_me => 'X'`)).rejects.toThrow()

    await actAs(db, { user: bea })
    expect(await rows(db, 'select 1 from trips')).toHaveLength(0) // Ana's trips are not Bea's
  })
})
