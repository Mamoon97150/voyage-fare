// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { createDb, num, rows } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
  await seedTrip(db)
})

const names: Record<string, string> = {
  [ids.ana]: 'Ana',
  [ids.bea]: 'Bea',
  [ids.cleo]: 'Cleo',
  [ids.dana]: 'Dana',
}

/** Each traveller's part of an item, in euros. */
async function parts(itemId: string) {
  const result = await rows<Record<string, unknown>>(
    db,
    `select s.traveller_id, round(s.fraction * a.current, 2) as part
     from v_item_shares s join v_item_amounts a on a.item_id = s.item_id
     where s.item_id = $1`,
    [itemId],
  )
  return Object.fromEntries(result.map((r) => [names[r.traveller_id as string], num(r.part)]))
}

async function byTraveller(sql: string, column: string) {
  const result = await rows<Record<string, unknown>>(db, sql, [ids.trip])
  return Object.fromEntries(result.map((r) => [names[r.traveller_id as string], num(r[column])]))
}

const balances = () =>
  byTraveller('select traveller_id, balance from v_traveller_balances where trip_id = $1', 'balance')

async function settlement() {
  const result = await rows<Record<string, unknown>>(db, 'select * from trip_settlement($1)', [ids.trip])
  return result.map(
    (r) => `${names[r.from_traveller as string]} → ${names[r.to_traveller as string]} ${num(r.amount)}`,
  )
}

describe('who shares what', () => {
  it('SR-1: by default an item is split equally between everyone', async () => {
    expect(await parts(ids.flights)).toEqual({ Ana: 260, Bea: 260, Cleo: 260, Dana: 260 })
  })

  it('SR-2: "split between…" on an item leaves the others out', async () => {
    expect(await parts(ids.surf)).toEqual({ Ana: 40, Cleo: 40 })
  })

  it('SR-3: a split set on a day applies to that day’s items (the gift day)', async () => {
    expect(await parts(ids.photo)).toEqual({ Ana: 50, Bea: 50, Cleo: 50 }) // Dana pays nothing
    expect(await parts(ids.dinner)).toEqual({ Ana: 30, Bea: 30, Cleo: 30 })
  })

  it('SR-3: an item’s own split wins over the day’s', async () => {
    await db.exec('begin')
    await db.exec(`insert into item_split_travellers (item_id, traveller_id, trip_id) values
      ('${ids.dinner}', '${ids.ana}', '${ids.trip}'), ('${ids.dinner}', '${ids.dana}', '${ids.trip}')`)
    expect(await parts(ids.dinner)).toEqual({ Ana: 45, Dana: 45 })
    await db.exec('rollback')
  })

  it('SR-3: an item that spans several days does not follow one day’s split', async () => {
    await db.exec('begin')
    await db.exec(`update items set day_number = 2, end_day_number = 4 where id = '${ids.hotel}'`)
    expect(await parts(ids.hotel)).toEqual({ Ana: 90, Bea: 90, Cleo: 90, Dana: 90 })
    await db.exec('rollback')
  })

  it('SR-4: housing by room — each room is split between its occupants', async () => {
    expect(await parts(ids.flat)).toEqual({ Ana: 150, Bea: 150, Cleo: 100, Dana: 100 })
  })

  it('SR-4: a room with nobody in it is shared by everyone', async () => {
    await db.exec('begin')
    await db.exec(`delete from room_occupants where room_id = '${ids.room2}'`)
    expect(await parts(ids.flat)).toEqual({ Ana: 200, Bea: 200, Cleo: 50, Dana: 50 })
    await db.exec('rollback')
  })

  it('BR-6: each traveller’s share adds up to the trip total', async () => {
    const shares = await byTraveller(
      'select traveller_id, share_current from v_traveller_shares where trip_id = $1',
      'share_current',
    )
    expect(shares).toEqual({ Ana: 720, Bea: 680, Cleo: 670, Dana: 550 })
    expect(Object.values(shares).reduce((a, b) => a! + b!, 0)).toBe(2620)
  })
})

describe('who paid what (SR-7)', () => {
  it('balance = what each paid − their share of what is paid', async () => {
    // Paid so far: flights 1 040 (Ana), photo 150 (Bea), surf 80 (Cleo).
    expect(await balances()).toEqual({ Ana: 690, Bea: -160, Cleo: -270, Dana: -260 })
  })

  it('balances always add up to zero', async () => {
    expect(Object.values(await balances()).reduce((a, b) => a! + b!, 0)).toBe(0)
  })

  it('settles in at most travellers − 1 payments', async () => {
    expect(await settlement()).toEqual(['Cleo → Ana 270', 'Dana → Ana 260', 'Bea → Ana 160'])
  })

  it('a repayment brings the balances back towards zero', async () => {
    await db.exec('begin')
    await db.exec(`insert into repayments (trip_id, from_traveller, to_traveller, amount)
      values ('${ids.trip}', '${ids.cleo}', '${ids.ana}', 270)`)
    expect(await balances()).toEqual({ Ana: 420, Bea: -160, Cleo: 0, Dana: -260 })
    expect(await settlement()).toEqual(['Dana → Ana 260', 'Bea → Ana 160'])

    await db.exec(`insert into repayments (trip_id, from_traveller, to_traveller, amount) values
      ('${ids.trip}', '${ids.dana}', '${ids.ana}', 260), ('${ids.trip}', '${ids.bea}', '${ids.ana}', 160)`)
    expect(await balances()).toEqual({ Ana: 0, Bea: 0, Cleo: 0, Dana: 0 })
    expect(await settlement()).toEqual([])
    await db.exec('rollback')
  })

  it('booked but unpaid items create no debt yet', async () => {
    // The Lisbon flat is booked (500 €) but nobody has paid it: it is in no balance above.
    await db.exec('begin')
    await db.exec(`update items set status = 'paid', paid_by = '${ids.dana}' where id = '${ids.flat}'`)
    expect(await balances()).toEqual({ Ana: 540, Bea: -310, Cleo: -370, Dana: 140 })
    await db.exec('rollback')
  })

  it('SR-8: a payment in another currency is counted in the trip’s currency', async () => {
    await db.exec('begin')
    await db.exec(`update items set status = 'paid', actual_amount = 410, actual_currency = 'USD',
      actual_rate = 0.9, paid_by = '${ids.dana}' where id = '${ids.hotel}'`) // 369 €, 92.25 each
    expect(await balances()).toEqual({ Ana: 597.75, Bea: -252.25, Cleo: -362.25, Dana: 16.75 })
    await db.exec('rollback')
  })

  it('a cent lost to rounding never blocks the settlement (100 € in 3)', async () => {
    await db.exec('begin')
    await db.exec(`delete from repayments; update items set status = 'chosen', paid_by = null
      where trip_id = '${ids.trip}' and status = 'paid'`)
    await db.exec(`insert into item_split_travellers (item_id, traveller_id, trip_id) values
      ('${ids.dinner}', '${ids.ana}', '${ids.trip}'), ('${ids.dinner}', '${ids.bea}', '${ids.trip}'),
      ('${ids.dinner}', '${ids.cleo}', '${ids.trip}')`)
    await db.exec(`update items set status = 'paid', actual_amount = 100, actual_currency = 'EUR',
      paid_by = '${ids.ana}' where id = '${ids.dinner}'`)
    expect(await balances()).toEqual({ Ana: 66.67, Bea: -33.33, Cleo: -33.33, Dana: 0 })
    expect(await settlement()).toEqual(['Bea → Ana 33.33', 'Cleo → Ana 33.33'])
    await db.exec('rollback')
  })

  it('SR-6: a traveller who paid something cannot be deleted by mistake', async () => {
    await expect(db.exec(`delete from travellers where id = '${ids.ana}'`)).rejects.toThrow()
  })
})
