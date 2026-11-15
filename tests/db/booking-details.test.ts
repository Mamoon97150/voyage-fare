// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000a7'
const stranger = '00000000-0000-0000-0000-0000000000a8'
let trip: string
let hotel: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colombia', p_me => 'Ana') as id`)).id
  hotel = (
    await one<{ id: string }>(
      db,
      `select add_item(p_trip_id => $1, p_kind => 'housing', p_name => 'Casona', p_amount => 1140) as id`,
      [trip],
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

describe('booking details', () => {
  it('a confirmation number and a link on the line', async () => {
    await actAs(db, { user: ana })
    await db.query(`update items set booking_ref = 'CP-48213', booking_link = 'https://booking.test/x' where id = $1`, [
      hotel,
    ])
    expect(await one(db, 'select booking_ref, booking_link from items where id = $1', [hotel])).toEqual({
      booking_ref: 'CP-48213',
      booking_link: 'https://booking.test/x',
    })
    expect(await refused(db, `update items set booking_link = 'javascript:alert(1)' where id = '${hotel}'`)).toBe(true)
  })

  it('a file row: in its trip’s folder, a PDF or photo up to 10 MB, who added it', async () => {
    await actAs(db, { user: ana })
    const path = `${trip}/${hotel}/a1-confirmation.pdf`
    await db.query(
      `insert into item_files (trip_id, item_id, path, name, size, mime) values ($1, $2, $3, 'Confirmation.pdf', 212000, 'application/pdf')`,
      [trip, hotel, path],
    )
    expect(await one(db, 'select name, added_by from item_files where item_id = $1', [hotel])).toEqual({
      name: 'Confirmation.pdf',
      added_by: ana,
    })
    expect(
      await refused(
        db,
        `insert into item_files (trip_id, item_id, path, name, size, mime) values ('${trip}', '${hotel}', 'elsewhere/x.pdf', 'x.pdf', 10, 'application/pdf')`,
      ),
    ).toBe(true)
    expect(
      await refused(
        db,
        `insert into item_files (trip_id, item_id, path, name, size, mime) values ('${trip}', '${hotel}', '${trip}/${hotel}/big.pdf', 'big.pdf', 20000000, 'application/pdf')`,
      ),
    ).toBe(true)
    expect(
      await refused(
        db,
        `insert into item_files (trip_id, item_id, path, name, size, mime) values ('${trip}', '${hotel}', '${trip}/${hotel}/x.exe', 'x.exe', 10, 'application/x-msdownload')`,
      ),
    ).toBe(true)
  })

  it('someone else can’t see or add files; deleting the line removes its file rows', async () => {
    await actAs(db, { user: stranger })
    expect(await rows(db, 'select * from item_files')).toEqual([])
    expect(
      await refused(
        db,
        `insert into item_files (trip_id, item_id, path, name, size, mime) values ('${trip}', '${hotel}', '${trip}/${hotel}/s.pdf', 's.pdf', 10, 'application/pdf')`,
      ),
    ).toBe(true)
    await actAs(db, { user: ana })
    await db.query('delete from items where id = $1', [hotel])
    expect(await rows(db, 'select * from item_files where trip_id = $1', [trip])).toEqual([])
  })
})
