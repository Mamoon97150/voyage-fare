// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, num, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000e1'
const stranger = '00000000-0000-0000-0000-0000000000e2'
const dj = '00000000-0000-0000-0000-0000000000e3'
let trip: string
let cartagena: string
let hotel: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}'), ('${dj}');
                 insert into admins (user_id, is_first) values ('${dj}', true);`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colombia', p_me => 'Ana') as id`)).id
  cartagena = (
    await one<{ id: string }>(
      db,
      `insert into places (trip_id, name, nights) values ($1, 'Cartagena', 5) returning id`,
      [trip],
    )
  ).id
  hotel = (
    await one<{ id: string }>(
      db,
      `select add_item(p_trip_id => $1, p_kind => 'housing', p_name => 'Casona del Porvenir', p_place_id => $2, p_amount => 1200) as id`,
      [trip, cartagena],
    )
  ).id
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

const apply = (args: string) => `select apply_booking(p_trip_id => '${trip}', ${args}) as id`

describe('mark it booked from an email', () => {
  it('on a line with a chosen option: booked, the email’s price, confirmation and link', async () => {
    await actAs(db, { user: ana })
    await db.exec(
      apply(`p_item_id => '${hotel}', p_kind => null, p_name => null, p_place_id => null, p_day_number => null,
             p_option_name => 'Hotel Casona', p_amount => 1140, p_currency => 'EUR', p_rate => null,
             p_ref => 'CP-48213', p_link => 'https://booking.test/cp'`),
    )
    const item = await one<Record<string, unknown>>(
      db,
      'select status, actual_amount, booking_ref, booking_link from items where id = $1',
      [hotel],
    )
    expect({ ...item, actual_amount: num(item.actual_amount) }).toEqual({
      status: 'booked',
      actual_amount: 1140,
      booking_ref: 'CP-48213',
      booking_link: 'https://booking.test/cp',
    })
    expect(await rows(db, 'select count(*)::int as n from options where item_id = $1', [hotel])).toEqual([{ n: 1 }])
  })

  it('nothing matches: a new line, in its place and day, already booked, in another currency', async () => {
    await actAs(db, { user: ana })
    const { id } = await one<{ id: string }>(
      db,
      apply(`p_item_id => null, p_kind => 'activity', p_name => 'Tuk-tuk tour', p_place_id => '${cartagena}',
             p_day_number => 11, p_option_name => 'Resmont Travel', p_amount => 240000, p_currency => 'cop',
             p_rate => 0.00024, p_ref => 'RT-9', p_link => null`),
    )
    const item = await one<Record<string, unknown>>(
      db,
      'select name, kind, place_id, day_number, status, actual_currency, booking_ref from items where id = $1',
      [id],
    )
    expect(item).toEqual({
      name: 'Tuk-tuk tour',
      kind: 'activity',
      place_id: cartagena,
      day_number: 11,
      status: 'booked',
      actual_currency: 'COP',
      booking_ref: 'RT-9',
    })
    expect(await one(db, 'select name, currency, is_chosen from options where item_id = $1', [id])).toEqual({
      name: 'Resmont Travel',
      currency: 'COP',
      is_chosen: true,
    })
  })

  it('several options, none chosen: the one with the email’s name gets chosen', async () => {
    await actAs(db, { user: ana })
    const { id } = await one<{ id: string }>(
      db,
      `select add_item(p_trip_id => $1, p_kind => 'housing', p_name => 'Medellín stay') as id`,
      [trip],
    )
    await db.query(
      `insert into options (trip_id, item_id, name, amount, currency) values ($1, $2, 'Hotel A', 500, 'EUR'), ($1, $2, 'Hotel B', 450, 'EUR')`,
      [trip, id],
    )
    await db.exec(
      apply(`p_item_id => '${id}', p_kind => null, p_name => null, p_place_id => null, p_day_number => null,
             p_option_name => 'hotel b', p_amount => null, p_currency => null, p_rate => null, p_ref => null, p_link => null`),
    )
    expect(await rows(db, 'select name from options where item_id = $1 and is_chosen', [id])).toEqual([
      { name: 'Hotel B' },
    ])
    expect(await one(db, 'select status from items where id = $1', [id])).toEqual({ status: 'booked' })
  })

  it('a paid line stays paid; a stranger can’t; a bad link is refused', async () => {
    await actAs(db, { user: ana })
    await db.query(`select set_item_status($1, 'paid', 1140, (select id from travellers where trip_id = $2 limit 1))`, [
      hotel,
      trip,
    ])
    await db.exec(
      apply(`p_item_id => '${hotel}', p_kind => null, p_name => null, p_place_id => null, p_day_number => null,
             p_option_name => null, p_amount => 1100, p_currency => null, p_rate => null, p_ref => 'NEW-1', p_link => null`),
    )
    expect(await one(db, 'select status, booking_ref from items where id = $1', [hotel])).toEqual({
      status: 'paid',
      booking_ref: 'NEW-1',
    })
    expect(
      await refused(
        db,
        apply(`p_item_id => '${hotel}', p_kind => null, p_name => null, p_place_id => null, p_day_number => null,
               p_option_name => null, p_amount => null, p_currency => null, p_rate => null, p_ref => null,
               p_link => 'javascript:alert(1)'`),
      ),
    ).toBe(true)

    await actAs(db, { user: stranger })
    expect(
      await refused(
        db,
        apply(`p_item_id => '${hotel}', p_kind => null, p_name => null, p_place_id => null, p_day_number => null,
               p_option_name => null, p_amount => 1, p_currency => null, p_rate => null, p_ref => 'X', p_link => null`),
      ),
    ).toBe(true)
  })
})

describe('the AI budget', () => {
  it('nobody reads the settings or the readings; admins see the month and can turn it off', async () => {
    await actAs(db, 'owner')
    await db.exec(`insert into private.ai_readings (user_id, kind, input_tokens, output_tokens, cost_usd)
                   values ('${ana}', 'trip', 3000, 2000, 0.0013), ('${ana}', 'booking', 2000, 500, 0.00045)`)

    await actAs(db, { user: ana })
    expect(await refused(db, 'select * from private.ai_readings')).toBe(true)
    expect(await refused(db, 'select * from private.ai_settings')).toBe(true)
    expect(await refused(db, 'select admin_ai()')).toBe(true)
    expect(await refused(db, 'select admin_set_ai(false)')).toBe(true)

    await actAs(db, { user: dj })
    const ai = (await one<{ ai: Record<string, unknown> }>(db, 'select admin_ai() as ai')).ai
    expect({ ...ai, used_usd: Number(ai.used_usd), cap_usd: Number(ai.cap_usd) }).toEqual({
      enabled: true,
      cap_usd: 5.8,
      used_usd: 0.00175,
      readings: 2,
      bookings: 1,
      people: 1,
    })
    await db.exec('select admin_set_ai(false)')
    expect((await one<{ ai: { enabled: boolean } }>(db, 'select admin_ai() as ai')).ai.enabled).toBe(false)
  })
})
