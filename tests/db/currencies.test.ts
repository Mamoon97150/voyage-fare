// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000c1'
let trip: string
let place: string
let me: string

beforeEach(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}')`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea'], p_currency => 'EUR', p_target_amount => 3000) as id`)).id
  place = (await one<{ id: string }>(db, `insert into places (trip_id, name, nights, position) values ($1, 'Cartagena', 5, 1) returning id`, [trip])).id
  me = (await one<{ id: string }>(db, `select id from travellers where trip_id = $1 and user_id = $2`, [trip, ana])).id
})

afterEach(async () => {
  await actAs(db, 'owner')
})

/** An item with one chosen option in a currency, at a rate (EUR per 1 unit). */
async function priced(name: string, amount: number, currency: string, rate: number) {
  const item = (await one<{ id: string }>(db, `select add_item(p_trip_id => $1, p_kind => 'activity', p_name => $2, p_place_id => $3) as id`, [trip, name, place])).id
  await db.query(`insert into options (trip_id, item_id, name, amount, currency, rate, is_chosen) values ($1, $2, $3, $4, $5, $6, true)`, [trip, item, name, amount, currency, rate])
  return item
}
const total = async () => num((await one<{ t: unknown }>(db, `select current_total as t from v_trip_budget where trip_id = $1`, [trip])).t)

describe('prices in other currencies (BR-10)', () => {
  it('each at its saved rate, added up in the main currency', async () => {
    await priced('Photoshoot', 230, 'USD', 0.9) // 207 €
    await priced('Nails', 615000, 'COP', 0.00022) // 135,30 €
    expect(await total()).toBe(342.3)
  })

  it('what was really paid, in its own currency', async () => {
    const item = await priced('Photoshoot', 230, 'USD', 0.9)
    await db.query(`select set_item_status(p_item_id => $1, p_status => 'paid', p_actual_amount => 310, p_paid_by => $2, p_actual_currency => 'USD', p_actual_rate => 0.9)`, [item, me])
    const row = await one<Record<string, unknown>>(db, 'select actual_currency, actual_rate from items where id = $1', [item])
    expect(row.actual_currency).toBe('USD')
    expect(await total()).toBe(279)
  })

  it('another currency needs its rate', async () => {
    const item = await priced('Photoshoot', 230, 'USD', 0.9)
    await expect(
      db.query(`select set_item_status(p_item_id => $1, p_status => 'booked', p_actual_amount => 310, p_actual_currency => 'USD')`, [item]),
    ).rejects.toThrow('needs its rate')
  })
})

describe('changing the main currency (until the first payment)', () => {
  it('converts every saved rate and the target: the totals only change unit', async () => {
    await priced('Photoshoot', 230, 'USD', 0.9)
    await priced('Nails', 615000, 'COP', 0.00022)
    await priced('Dinner', 100, 'EUR', 1)
    await db.query(`select change_trip_currency($1, 'COP', 4550)`, [trip])

    const rates = await db.query<{ currency: string; rate: unknown }>(`select currency, rate from options where trip_id = $1 order by currency`, [trip])
    expect(rates.rows.map((r) => [r.currency, num(r.rate)])).toEqual([
      ['COP', 1], // its own currency now: exactly 1
      ['EUR', 4550],
      ['USD', 4095],
    ])
    expect(await total()).toBe(230 * 4095 + 615000 + 100 * 4550)
    const t = await one<Record<string, unknown>>(db, 'select currency, target_amount from trips where id = $1', [trip])
    expect(t.currency).toBe('COP')
    expect(num(t.target_amount)).toBe(3000 * 4550)
  })

  it('a booked amount in dollars follows too', async () => {
    const item = await priced('Photoshoot', 230, 'USD', 0.9)
    await db.query(`select set_item_status(p_item_id => $1, p_status => 'booked', p_actual_amount => 310, p_actual_currency => 'USD', p_actual_rate => 0.9)`, [item])
    await db.query(`select change_trip_currency($1, 'USD', 1.1111)`, [trip])
    const row = await one<Record<string, unknown>>(db, 'select actual_rate from items where id = $1', [item])
    expect(num(row.actual_rate)).toBe(1)
  })

  it('fixed once someone has paid', async () => {
    const item = await priced('Dinner', 100, 'EUR', 1)
    await db.query(`select set_item_status(p_item_id => $1, p_status => 'paid', p_actual_amount => 100, p_paid_by => $2)`, [item, me])
    await expect(db.query(`select change_trip_currency($1, 'USD', 1.1)`, [trip])).rejects.toThrow('fixed since the first payment')
  })

  it('needs a rate; the same currency changes nothing', async () => {
    await expect(db.query(`select change_trip_currency($1, 'USD', null)`, [trip])).rejects.toThrow('needs the rate')
    await db.query(`select change_trip_currency($1, 'EUR', null)`, [trip])
    expect((await one<{ currency: string }>(db, 'select currency from trips where id = $1', [trip])).currency).toBe('EUR')
  })
})
