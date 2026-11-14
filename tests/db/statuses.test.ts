// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000f1'
const stranger = '00000000-0000-0000-0000-0000000000f2'
let trip: string
let place: string
let item: string
let me: string

beforeEach(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colombia', p_me => 'Ana', p_travellers => array['Bea'], p_currency => 'EUR') as id`)).id
  place = (await one<{ id: string }>(db, `insert into places (trip_id, name, nights, position) values ($1, 'Cartagena', 5, 1) returning id`, [trip])).id
  item = (await one<{ id: string }>(db, `select add_item(p_trip_id => $1, p_kind => 'housing', p_name => 'Casona', p_place_id => $2, p_amount => 1000) as id`, [trip, place])).id
  me = (await one<{ id: string }>(db, `select id from travellers where trip_id = $1 and user_id = $2`, [trip, ana])).id
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const status = (args: string, params: unknown[] = []) => db.query(`select set_item_status(${args})`, params)
const line = () => one<Record<string, unknown>>(db, 'select status, actual_amount, paid_by, paid_on from items where id = $1', [item])
const budget = () => one<Record<string, unknown>>(db, 'select confirmed_total, estimated_total from v_trip_budget where trip_id = $1', [trip])

describe('statuses', () => {
  it('booked with the real amount: confirmed, at the real amount (BR-2, BR-3)', async () => {
    await status(`p_item_id => $1, p_status => 'booked', p_actual_amount => 950`, [item])
    expect(await line()).toMatchObject({ status: 'booked', paid_by: null })
    const b = await budget()
    expect(num(b.confirmed_total)).toBe(950)
    expect(b.estimated_total).toBeNull()
  })

  it('booked without the amount yet: still estimated', async () => {
    await status(`p_item_id => $1, p_status => 'booked'`, [item])
    const b = await budget()
    expect(b.confirmed_total).toBeNull()
    expect(num(b.estimated_total)).toBe(1000)
  })

  it('paid: the amount, who paid, and when (today by default)', async () => {
    await status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 980, p_paid_by => $2`, [item, me])
    const l = await line()
    expect(l).toMatchObject({ status: 'paid', paid_by: me })
    expect(l.paid_on).not.toBeNull()
    expect(num((await budget()).confirmed_total)).toBe(980)
  })

  it('paid needs the amount and the payer', async () => {
    await expect(status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 980`, [item])).rejects.toThrow('who paid it')
    await expect(status(`p_item_id => $1, p_status => 'paid', p_paid_by => $2`, [item, me])).rejects.toThrow('really paid')
  })

  it('nothing chosen yet: nothing to book', async () => {
    const idea = (await one<{ id: string }>(db, `select add_item(p_trip_id => $1, p_kind => 'activity', p_name => 'Islands', p_place_id => $2) as id`, [trip, place])).id
    await expect(status(`p_item_id => $1, p_status => 'booked'`, [idea])).rejects.toThrow('Choose an option first')
  })

  it('back to chosen clears the real amount and the payer', async () => {
    await status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 980, p_paid_by => $2`, [item, me])
    await status(`p_item_id => $1, p_status => 'chosen'`, [item])
    expect(await line()).toEqual({ status: 'chosen', actual_amount: null, paid_by: null, paid_on: null })
    expect(num((await budget()).estimated_total)).toBe(1000)
  })

  it('booked never goes back down on its own when the options change (BR-8)', async () => {
    await status(`p_item_id => $1, p_status => 'booked', p_actual_amount => 950`, [item])
    await db.query(`insert into options (trip_id, item_id, name, amount, currency) values ($1, $2, 'Other', 800, 'EUR')`, [trip, item])
    expect((await line()).status).toBe('booked')
  })

  it('someone else can’t change it', async () => {
    await actAs(db, { user: stranger })
    await expect(status(`p_item_id => $1, p_status => 'booked'`, [item])).rejects.toThrow()
  })
})

describe('review fixes (13 Nov)', () => {
  it('a price from the trip page lands in the main currency, even in a dollar option', async () => {
    await db.query(`update options set currency = 'USD', rate = 0.9, amount = 230 where item_id = $1`, [item])
    await db.query(`select update_item(p_item_id => $1, p_kind => 'housing', p_name => 'Casona', p_amount => 207)`, [item])
    const o = await one<Record<string, unknown>>(db, 'select amount, currency, rate from options where item_id = $1', [item])
    expect([num(o.amount), o.currency, num(o.rate)]).toEqual([207, 'EUR', 1])
  })

  it('a ticket keeps its options’ prices when asked', async () => {
    const t = (await one<{ id: string }>(db, `select add_ticket(p_trip_id => $1, p_from => 'Bogotá', p_to => 'Medellín', p_amount => 300) as id`, [trip])).id
    await db.query(`select update_ticket(p_item_id => $1, p_from => 'Bogotá', p_to => 'Medellín', p_via => 'Cali', p_keep_price => true)`, [t])
    expect(num((await one<{ amount: unknown }>(db, 'select amount from options where item_id = $1', [t])).amount)).toBe(300)
  })

  it('dropped: nothing chosen, out of the budget; choosing brings it back', async () => {
    await db.query(`select set_item_dropped($1, true)`, [item])
    expect((await line()).status).toBe('dropped')
    const b = await budget()
    expect(b.estimated_total).toBeNull()
    await db.query(`update options set is_chosen = true where item_id = $1`, [item])
    expect((await line()).status).toBe('chosen')
  })

  it('bring it back: its only option is chosen again', async () => {
    await db.query(`select set_item_dropped($1, true)`, [item])
    await db.query(`select set_item_dropped($1, false)`, [item])
    expect((await line()).status).toBe('chosen')
    expect(num((await budget()).estimated_total)).toBe(1000)
  })

  it('booked can’t be dropped', async () => {
    await status(`p_item_id => $1, p_status => 'booked'`, [item])
    await expect(db.query(`select set_item_dropped($1, true)`, [item])).rejects.toThrow('set it back to Chosen')
  })
})

describe('each paid their own share (build 4)', () => {
  it('counts as paid and creates no debts', async () => {
    await status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 1000, p_paid_each => true`, [item])
    const l = await one<Record<string, unknown>>(db, 'select status, paid_by, paid_each from items where id = $1', [item])
    expect(l).toMatchObject({ status: 'paid', paid_by: null, paid_each: true })
    expect(num((await budget()).confirmed_total)).toBe(1000)
    const b = await db.query<{ paid: unknown; balance: unknown }>(`select paid, balance from v_traveller_balances where trip_id = $1`, [trip])
    expect(b.rows.map((r) => [num(r.paid), num(r.balance)])).toEqual([
      [500, 0],
      [500, 0],
    ])
  })

  it('one payer and each-their-own together: only the one payer’s line makes a debt', async () => {
    await status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 1000, p_paid_each => true`, [item])
    const dinner = (await one<{ id: string }>(db, `select add_item(p_trip_id => $1, p_kind => 'restaurant', p_name => 'Dinner', p_place_id => $2, p_amount => 100) as id`, [trip, place])).id
    await status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 100, p_paid_by => $2`, [dinner, me])
    const b = await one<{ balance: unknown }>(db, `select balance from v_traveller_balances where traveller_id = $1`, [me])
    expect(num(b.balance)).toBe(50)
  })

  it('back to booked clears it', async () => {
    await status(`p_item_id => $1, p_status => 'paid', p_actual_amount => 1000, p_paid_each => true`, [item])
    await status(`p_item_id => $1, p_status => 'booked', p_actual_amount => 1000`, [item])
    expect((await one<{ paid_each: boolean }>(db, 'select paid_each from items where id = $1', [item])).paid_each).toBe(false)
  })
})

describe('split between… (build 4)', () => {
  const split = () => db.query<{ traveller_id: string }>('select traveller_id from item_split_travellers where item_id = $1', [item])
  const bea = async () => (await one<{ id: string }>(db, `select id from travellers where trip_id = $1 and name = 'Bea'`, [trip])).id

  it('just me: only my share; the budget follows', async () => {
    await db.query('select set_item_split($1, $2)', [item, [me]])
    expect((await split()).rows.map((r) => r.traveller_id)).toEqual([me])
    const s = await one<{ share_current: unknown }>(db, 'select share_current from v_traveller_shares where traveller_id = $1', [me])
    expect(num(s.share_current)).toBe(1000)
  })

  it('everyone picked = everyone (no rows), and so does an empty list', async () => {
    await db.query('select set_item_split($1, $2)', [item, [me]])
    await db.query('select set_item_split($1, $2)', [item, [me, await bea()]])
    expect((await split()).rows).toHaveLength(0)
    await db.query('select set_item_split($1, $2)', [item, [me]])
    await db.query('select set_item_split($1, $2)', [item, []])
    expect((await split()).rows).toHaveLength(0)
  })

  it('someone from another trip is refused', async () => {
    await expect(db.query('select set_item_split($1, $2)', [item, [me, '00000000-0000-0000-0000-00000000dead']])).rejects.toThrow('isn’t on this trip')
  })
})

describe('rooms (build 4)', () => {
  const bea = async () => (await one<{ id: string }>(db, `select id from travellers where trip_id = $1 and name = 'Bea'`, [trip])).id
  const option = async () => (await one<{ id: string }>(db, 'select id from options where item_id = $1', [item])).id
  const shares = () => db.query<{ traveller_id: string; fraction: unknown }>('select traveller_id, fraction from v_item_shares where item_id = $1 order by fraction desc', [item])

  it('by room: the price is the rooms added up, each split by who sleeps there', async () => {
    const o = await option()
    await db.query('select set_option_rooms($1, $2)', [o, JSON.stringify([
      { name: 'Superior', amount: 600, occupants: [me] },
      { name: 'Small', amount: 400, occupants: [await bea()] },
    ])])
    expect(num((await one<{ amount: unknown }>(db, 'select amount from options where id = $1', [o])).amount)).toBe(1000)
    expect((await shares()).rows.map((r) => [r.traveller_id, Math.round(Number(r.fraction) * 100) / 100])).toEqual([
      [me, 0.6],
      [await bea(), 0.4],
    ])
  })

  it('back to one price: no rooms, split equally again', async () => {
    const o = await option()
    await db.query('select set_option_rooms($1, $2)', [o, JSON.stringify([{ name: 'A', amount: 600, occupants: [me] }])])
    await db.query('select set_option_rooms($1, $2)', [o, JSON.stringify([])])
    expect((await db.query('select 1 from rooms where option_id = $1', [o])).rows).toHaveLength(0)
    expect((await shares()).rows.map((r) => Number(r.fraction))).toEqual([0.5, 0.5])
  })

  it('a room needs its price; someone from elsewhere is refused', async () => {
    const o = await option()
    await expect(db.query('select set_option_rooms($1, $2)', [o, JSON.stringify([{ name: 'A', occupants: [me] }])])).rejects.toThrow('needs its price')
    await expect(
      db.query('select set_option_rooms($1, $2)', [o, JSON.stringify([{ name: 'A', amount: 10, occupants: ['00000000-0000-0000-0000-00000000dead'] }])]),
    ).rejects.toThrow('isn’t on this trip')
  })
})
