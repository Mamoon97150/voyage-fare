// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

// Build 10 (mockup money-v6, 16 Nov). From the fixture, what's paid so far:
//   Flights 1 040 paid by Ana, everyone (260 each) · Photo 150 paid by Bea, Ana/Bea/Cleo (50 each)
//   Surf 80 paid by Cleo, Ana/Cleo (40 each)
// Balances: Ana +690 · Bea −160 · Cleo −270 · Dana −260.
// The Lisbon flat (500 €, booked, by room) is shared 30 % · 30 % · 20 % · 20 %.
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
afterEach(async () => {
  await actAs(db, 'owner')
})

const group = async (people: string[], existing: string | null = null) =>
  (
    await one<{ id: string | null }>(db, 'select set_pay_group($1, $2::uuid[], $3) as id', [
      ids.trip,
      `{${people.join(',')}}`,
      existing,
    ])
  ).id
const groupOf = async (traveller: string) =>
  (await one<{ g: string | null }>(db, 'select pay_group_id as g from travellers where id = $1', [traveller])).g
const parties = async () =>
  rows<{ group_id: string | null; lead_traveller: string; balance: string }>(
    db,
    'select group_id, lead_traveller, balance from v_party_balances where trip_id = $1 order by position',
    [ids.trip],
  )
const settlement = () =>
  rows<{
    from_traveller: string
    to_traveller: string
    amount: string
    from_group: string | null
    to_group: string | null
  }>(db, 'select * from trip_settlement($1) order by amount desc', [ids.trip])
/** What one member owes another inside a group, netted (positive = owed_by owes owed_to). */
const between = async (owedBy: string, owedTo: string) => {
  const r = await rows<{ owed_by: string; owed_to: string; amount: string }>(
    db,
    'select owed_by, owed_to, amount from v_group_between where trip_id = $1',
    [ids.trip],
  )
  return r.reduce(
    (sum, x) =>
      sum +
      (x.owed_by === owedBy && x.owed_to === owedTo ? Number(x.amount) : 0) -
      (x.owed_by === owedTo && x.owed_to === owedBy ? Number(x.amount) : 0),
    0,
  )
}
const cash = (args: Record<string, unknown>) =>
  one<{ id: string }>(
    db,
    'select add_cash(p_trip_id => $1, p_amount => $2, p_name => $3, p_category => $4, p_paid_by => $5, p_for => $6::uuid[], p_place_id => $7, p_day_number => $8) as id',
    [
      ids.trip,
      args.amount,
      args.name ?? 'Taxi',
      args.category ?? 'local_transport',
      args.by,
      `{${((args.for as string[]) ?? []).join(',')}}`,
      args.place ?? null,
      args.day ?? null,
    ],
  )

describe('who pays together', () => {
  it('a group settles up as one: Ana & Bea are owed what Cleo and Dana owe', async () => {
    const g = await group([ids.ana, ids.bea])
    expect(await groupOf(ids.ana)).toBe(g)
    expect(await groupOf(ids.bea)).toBe(g)

    const p = await parties()
    expect(p.map((x) => [x.group_id, num(x.balance)])).toEqual([
      [g, 530],
      [null, -270],
      [null, -260],
    ])
    const s = await settlement()
    expect(s.map((x) => [x.from_traveller, x.to_traveller, num(x.amount), x.from_group, x.to_group])).toEqual([
      [ids.cleo, ids.ana, 270, null, g],
      [ids.dana, ids.ana, 260, null, g],
    ])
  })

  it('everyone keeps their own share: the per-person balances don’t change', async () => {
    await group([ids.ana, ids.bea])
    const b = await rows<{ traveller_id: string; balance: string }>(
      db,
      'select traveller_id, balance from v_traveller_balances where trip_id = $1',
      [ids.trip],
    )
    expect(Object.fromEntries(b.map((x) => [x.traveller_id, num(x.balance)]))).toEqual({
      [ids.ana]: 690,
      [ids.bea]: -160,
      [ids.cleo]: -270,
      [ids.dana]: -260,
    })
  })

  it('any size; the name reads "Ana, Bea & Cleo"', async () => {
    const g = await group([ids.ana, ids.bea, ids.cleo])
    expect((await one<{ n: string }>(db, 'select party_name($1, null) as n', [g])).n).toBe('Ana, Bea & Cleo')
    expect((await one<{ n: string }>(db, 'select party_name(null, $1) as n', [ids.dana])).n).toBe('Dana')
    // Ana, Bea & Cleo: +260 · Dana −260.
    expect((await settlement()).map((x) => num(x.amount))).toEqual([260])
  })

  it('changing a group: members replaced, someone moves, a group of one disappears', async () => {
    const g1 = await group([ids.ana, ids.bea, ids.cleo])
    await group([ids.ana, ids.bea], g1)
    expect(await groupOf(ids.cleo)).toBeNull()

    const g2 = await group([ids.cleo, ids.dana])
    // Bea moves to Cleo's group: Ana is left alone, her group goes.
    await group([ids.cleo, ids.bea], g2)
    expect(await groupOf(ids.bea)).toBe(g2)
    expect(await groupOf(ids.dana)).toBeNull()
    expect(await groupOf(ids.ana)).toBeNull()
    expect((await rows(db, 'select id from pay_groups where id = $1', [g1])).length).toBe(0)

    // Fewer than 2 = no group.
    expect(await group([ids.cleo], g2)).toBeNull()
    expect(await groupOf(ids.cleo)).toBeNull()
  })

  it('only the people on the trip can set groups', async () => {
    await actAs(db, { user: ids.stranger })
    await expect(db.query(`select set_pay_group('${ids.trip}', '{${ids.ana},${ids.bea}}')`)).rejects.toThrow(
      'Only the people on this trip',
    )
  })
})

describe('between you (option B)', () => {
  it('nothing between them when what one paid was also for herself', async () => {
    await group([ids.ana, ids.bea])
    expect(await between(ids.bea, ids.ana)).toBe(0)
    expect(await between(ids.ana, ids.bea)).toBe(0)
  })

  it('Bea paid something just for Ana: Ana owes Bea, the group’s balance doesn’t move; paying back clears it', async () => {
    await group([ids.ana, ids.bea])
    await cash({ amount: 40, name: 'Massage', category: 'buffer', by: ids.bea, for: [ids.ana] })
    expect(await between(ids.ana, ids.bea)).toBe(40)
    expect(num((await parties())[0].balance)).toBe(530)

    await db.query('insert into repayments (trip_id, from_traveller, to_traveller, amount) values ($1, $2, $3, 40)', [
      ids.trip,
      ids.ana,
      ids.bea,
    ])
    expect(await between(ids.ana, ids.bea)).toBe(0)
    expect(num((await parties())[0].balance)).toBe(530)
  })

  it('only inside the group: a line Ana paid just for Cleo is a normal debt, not "between you"', async () => {
    await group([ids.ana, ids.bea])
    await cash({ amount: 30, by: ids.ana, for: [ids.cleo] })
    expect((await rows(db, 'select * from v_group_between where trip_id = $1', [ids.trip])).length).toBe(0)
  })
})

describe('a deposit for everyone, then each their own bill', () => {
  const pay = (args: Record<string, unknown>) =>
    db.query(
      'select add_payment(p_item_id => $1, p_kind => $2, p_amount => $3, p_paid_by => $4, p_paid_on => $5, p_for_payer => $6)',
      [ids.flat, args.kind ?? 'balance', args.amount, args.by, '2027-02-01', args.own ?? false],
    )
  const bills = async () =>
    Object.fromEntries(
      (
        await rows<{ traveller_id: string; left_to_pay: string }>(
          db,
          'select traveller_id, left_to_pay from v_item_bills where item_id = $1',
          [ids.flat],
        )
      ).map((b) => [b.traveller_id, num(b.left_to_pay)]),
    )

  it('each bill = share − part of the deposit − what they paid themselves; all paid → the line is paid', async () => {
    await pay({ kind: 'deposit', amount: 100, by: ids.ana })
    expect(await bills()).toEqual({ [ids.ana]: 120, [ids.bea]: 120, [ids.cleo]: 80, [ids.dana]: 80 })

    await pay({ amount: 120, by: ids.bea, own: true })
    expect((await bills())[ids.bea]).toBe(0)
    const left = await one<{ left_to_pay: string }>(db, 'select left_to_pay from v_item_left where item_id = $1', [
      ids.flat,
    ])
    expect(num(left.left_to_pay)).toBe(280)

    await pay({ amount: 120, by: ids.ana, own: true })
    await pay({ amount: 80, by: ids.cleo, own: true })
    await pay({ amount: 80, by: ids.dana, own: true })
    expect((await one<{ status: string }>(db, 'select status from items where id = $1', [ids.flat])).status).toBe(
      'paid',
    )

    // Only the deposit moves money between people: Ana paid 100, her part is 30 → +70 on top of +690.
    const b = await rows<{ traveller_id: string; balance: string }>(
      db,
      'select traveller_id, balance from v_traveller_balances where trip_id = $1',
      [ids.trip],
    )
    expect(Object.fromEntries(b.map((x) => [x.traveller_id, num(x.balance)]))).toEqual({
      [ids.ana]: 760,
      [ids.bea]: -190,
      [ids.cleo]: -290,
      [ids.dana]: -280,
    })
  })

  it('a bill paid "for myself" needs who paid', async () => {
    await expect(
      db.query(
        `select add_payment(p_item_id => '${ids.flat}', p_kind => 'balance', p_amount => 50, p_paid_each => true, p_for_payer => true)`,
      ),
    ).rejects.toThrow('their own bill')
  })
})

describe('cash', () => {
  it('a cash line is paid and confirmed straight away, for whoever it’s for', async () => {
    const { id } = await cash({
      amount: 40,
      name: 'Taxi to the old town',
      by: ids.cleo,
      for: [ids.cleo],
      place: ids.lisbon,
      day: 2,
    })
    const item = await one<{ status: string; is_cash: boolean; category: string; kind: string }>(
      db,
      'select status, is_cash, category, kind from items where id = $1',
      [id],
    )
    expect(item).toEqual({ status: 'paid', is_cash: true, category: 'local_transport', kind: 'transport' })
    const a = await one<{ current: string; is_confirmed: boolean }>(
      db,
      'select current, is_confirmed from v_item_amounts where item_id = $1',
      [id],
    )
    expect([num(a.current), a.is_confirmed]).toEqual([40, true])
    // Cleo paid it, it's only hers: her balance doesn't move.
    const b = await one<{ balance: string }>(db, 'select balance from v_traveller_balances where traveller_id = $1', [
      ids.cleo,
    ])
    expect(num(b.balance)).toBe(-270)
  })

  it('for everyone when nobody is picked; checks the amount and the category', async () => {
    const { id } = await cash({ amount: 20, name: 'Tip', category: 'buffer', by: ids.ana })
    expect((await rows(db, 'select 1 from v_item_shares where item_id = $1', [id])).length).toBe(4)
    await expect(db.query(`select add_cash('${ids.trip}', 0, 'x', 'food', '${ids.ana}')`)).rejects.toThrow('How much')
    await expect(db.query(`select add_cash('${ids.trip}', 10, 'x', 'accommodation', '${ids.ana}')`)).rejects.toThrow(
      'Pick Getting around',
    )
  })
})

describe('Your trips', () => {
  it('"settle" speaks for your group: Bea (not the group’s first) sees Cleo and Dana owe them', async () => {
    await db.query('update travellers set user_id = $1 where id = $2', [ids.owner, ids.bea])
    await group([ids.ana, ids.bea])
    const card = await one<{ settle: { name: string; amount: number; you_pay: boolean }[] }>(
      db,
      'select settle from trip_cards() where id = $1',
      [ids.trip],
    )
    expect(card.settle.map((s) => [s.name, Number(s.amount), s.you_pay])).toEqual([
      ['Cleo', 270, false],
      ['Dana', 260, false],
    ])
  })
})
