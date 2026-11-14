// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

// Mockup left-to-pay-v4 (14 Nov). The Lisbon flat is booked at 500 € by room:
// room 1 (300) Ana + Bea, room 2 (200) Cleo + Dana → shares 30 % · 30 % · 20 % · 20 %.
let db: PGlite
const owner = { user: ids.owner }

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(`insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`)
  await actAs(db, owner)
})
afterEach(async () => {
  await actAs(db, 'owner')
})

const pay = (args: Record<string, unknown>) =>
  one<{ id: string }>(
    db,
    'select add_payment(p_item_id => $1, p_kind => $2, p_amount => $3, p_currency => $4, p_rate => $5, p_paid_by => $6, p_paid_each => $7, p_paid_on => $8) as id',
    [args.item ?? ids.flat, args.kind ?? 'deposit', args.amount, args.currency ?? null, args.rate ?? null, args.by ?? null, args.each ?? false, args.on ?? '2027-02-01'],
  )
const left = (item = ids.flat) =>
  one<{ price: string; paid: string; left_to_pay: string }>(db, 'select price, paid, left_to_pay from v_item_left where item_id = $1', [item])
const status = async (item = ids.flat) => (await one<{ status: string }>(db, 'select status from items where id = $1', [item])).status
const balances = async () =>
  Object.fromEntries(
    (await rows<{ traveller_id: string; balance: string }>(db, 'select traveller_id, balance from v_traveller_balances where trip_id = $1', [ids.trip])).map(
      (b) => [b.traveller_id, num(b.balance)!],
    ),
  )

describe('paying a booked line in parts', () => {
  it('a deposit: paid so far and left to pay; the budget doesn’t move; Ana is owed the others’ part', async () => {
    const budget = async () => num((await one<{ t: string }>(db, 'select confirmed_total as t from v_trip_budget where trip_id = $1', [ids.trip])).t)
    const before = await balances()
    const confirmed = await budget()
    await pay({ amount: 150, by: ids.ana })
    expect(await left()).toEqual({ price: '500.00', paid: '150.00', left_to_pay: '350.00' })
    expect(await status()).toBe('booked')
    expect(await budget()).toBe(confirmed)
    const after = await balances()
    const diff = (t: string) => Math.round((after[t] - before[t]) * 100) / 100
    expect([diff(ids.ana), diff(ids.bea), diff(ids.cleo), diff(ids.dana)]).toEqual([105, -45, -30, -30])
  })

  it('the balance makes it paid; deleting a payment brings it back to booked', async () => {
    await pay({ amount: 150, by: ids.ana })
    const { id } = await pay({ kind: 'balance', amount: 350, by: ids.bea, on: '2027-03-01' })
    expect(await status()).toBe('paid')
    expect(num((await left()).left_to_pay)).toBe(0)
    await db.query('select delete_payment($1)', [id])
    expect(await status()).toBe('booked')
    expect(num((await left()).left_to_pay)).toBe(350)
  })

  it('each their own share: no debts; another currency with its rate', async () => {
    const before = await balances()
    await pay({ kind: 'instalment', amount: 100, currency: 'USD', rate: 0.9, each: true })
    expect(num((await left()).paid)).toBe(90)
    expect(await balances()).toEqual(before)
    await expect(pay({ amount: 10, currency: 'USD' , by: ids.ana })).rejects.toThrow('needs its rate')
  })

  it('a due date for what’s left', async () => {
    await db.query(`select set_item_due($1, '2027-03-10')`, [ids.flat])
    expect((await one<{ due_on: string }>(db, 'select due_on::text from v_item_left where item_id = $1', [ids.flat])).due_on).toBe('2027-03-10')
  })
})

describe('what payments refuse', () => {
  it('only booked lines; not one in a package; not one paid in one go', async () => {
    await expect(pay({ item: ids.hotel, amount: 50, by: ids.ana })).rejects.toThrow('Book it first')
    await expect(pay({ item: ids.flights, amount: 50, by: ids.ana })).rejects.toThrow('paid in one go') // paid by Ana already
    const pkg = (await one<{ id: string }>(db, `select add_item($1, 'package', 'Pkg', null, null, null, 100) as id`, [ids.trip])).id
    await db.query('select set_package_cover($1, $2)', [pkg, [ids.flat]])
    await expect(pay({ amount: 50, by: ids.ana })).rejects.toThrow('in a package')
  })

  it('who paid: one person or each their own share, not both or neither', async () => {
    await expect(pay({ amount: 50 })).rejects.toThrow('Say who paid')
    await expect(pay({ amount: 50, by: ids.ana, each: true })).rejects.toThrow('Say who paid')
  })

  it('with payments, the line can’t go back to chosen or be marked paid in one go', async () => {
    await pay({ amount: 150, by: ids.ana })
    await expect(db.query(`select set_item_status($1, 'chosen')`, [ids.flat])).rejects.toThrow('delete them first')
    await expect(db.query(`select set_item_status($1, 'paid', 500, $2)`, [ids.flat, ids.bea])).rejects.toThrow('add the rest as a payment')
  })

  it('strangers can’t', async () => {
    await actAs(db, { user: ids.stranger })
    await expect(pay({ amount: 50, by: ids.ana })).rejects.toThrow()
  })
})
