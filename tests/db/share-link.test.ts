// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, one, refused as refusedIn } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000c1'
const stranger = '00000000-0000-0000-0000-0000000000c2'
let trip: string
let hotel: string

type Shared = {
  share: { show_prices: boolean; show_names: boolean }
  trip: Record<string, unknown>
  travellers: { name: string; user_id: string | null }[]
  items: Record<string, unknown>[]
  options: { amount: number | null }[]
  amounts: unknown[]
  budget: unknown
  payments: unknown[]
}

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (
    await one<{ id: string }>(
      db,
      `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea'], p_target_amount => 2500) as id`,
    )
  ).id
  hotel = (
    await one<{ id: string }>(
      db,
      `select add_item(p_trip_id => $1, p_kind => 'housing', p_name => 'Casona', p_amount => 1140) as id`,
      [trip],
    )
  ).id
  await db.query(
    `select set_item_status($1, 'paid', 1140, (select id from travellers where trip_id = $2 order by position limit 1))`,
    [hotel, trip],
  )
  await db.query(`update items set booking_ref = 'CP-48213', booking_link = 'https://booking.test/x' where id = $1`, [
    hotel,
  ])
  await actAs(db, 'owner')
})

afterEach(async () => {
  await actAs(db, 'owner')
})

async function refused(database: PGlite, sql: string) {
  await database.exec('begin')
  const result = await refusedIn(database, sql)
  await database.exec('commit')
  return result
}

const shared = async (token: string) => (await one<{ t: Shared | null }>(db, 'select shared_trip($1) as t', [token])).t

describe('the read-only share link', () => {
  it('a traveller makes it; a visitor sees the trip without names, booking details or who paid', async () => {
    await actAs(db, { user: ana })
    const link = await one<{ token: string; show_prices: boolean; show_names: boolean }>(
      db,
      'select * from share_link($1)',
      [trip],
    )
    expect(link).toMatchObject({ show_prices: true, show_names: false })
    expect(link.token).toMatch(/^[0-9a-f]{16}$/)
    expect((await one<{ token: string }>(db, 'select token from share_link($1)', [trip])).token).toBe(link.token)

    await actAs(db, 'anon')
    const t = (await shared(link.token))!
    expect(t.trip.name).toBe('Colombia')
    expect(t.trip).not.toHaveProperty('mail_code')
    expect(t.travellers.map((x) => x.name)).toEqual(['Traveller 1', 'Traveller 2'])
    expect(t.travellers.every((x) => x.user_id === null)).toBe(true)
    expect(t.items[0]).toMatchObject({ booking_ref: null, booking_link: null, paid_by: null, actual_amount: 1140 })
    expect(t.options[0].amount).not.toBeNull()
    expect(t.payments).toEqual([])
    expect(Number(t.trip.target_amount)).toBe(2500)
  })

  it('names on, prices off: real names, no amounts, no budget', async () => {
    await actAs(db, { user: ana })
    await db.query('select set_share($1, false, true)', [trip])
    const { token } = await one<{ token: string }>(db, 'select token from share_link($1)', [trip])
    await actAs(db, 'anon')
    const t = (await shared(token))!
    expect(t.travellers.map((x) => x.name)).toEqual(['Ana', 'Bea'])
    expect(t.options[0].amount).toBeNull()
    expect(t.items[0].actual_amount).toBeNull()
    expect(t.amounts).toEqual([])
    expect(t.budget).toBeNull()
    expect(t.trip.target_amount).toBeNull()
  })

  it('turned off: the old link is dead (same as one that never existed); the next one is new', async () => {
    await actAs(db, { user: ana })
    const { token: old } = await one<{ token: string }>(db, 'select token from share_link($1)', [trip])
    await db.query('select stop_share($1)', [trip])
    await actAs(db, 'anon')
    expect(await shared(old)).toBeNull()
    expect(await shared('0000000000000000')).toBeNull()
    await actAs(db, { user: ana })
    const { token: fresh } = await one<{ token: string }>(db, 'select token from share_link($1)', [trip])
    expect(fresh).not.toBe(old)
  })

  it('strangers can’t make, change or stop it, nor read the links', async () => {
    await actAs(db, { user: stranger })
    expect(await refused(db, `select * from share_link('${trip}')`)).toBe(true)
    expect(await refused(db, `select set_share('${trip}', true, true)`)).toBe(true)
    expect(await refused(db, `select stop_share('${trip}')`)).toBe(true)
    expect(await refused(db, 'select * from trip_shares')).toBe(true)
    await actAs(db, 'anon')
    expect(await refused(db, 'select * from trip_shares')).toBe(true)
    expect(await refused(db, `select * from share_link('${trip}')`)).toBe(true)
  })
})
