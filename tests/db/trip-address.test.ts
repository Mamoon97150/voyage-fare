// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const ana = '00000000-0000-0000-0000-0000000000f1'
const stranger = '00000000-0000-0000-0000-0000000000f2'
let trip: string

beforeAll(async () => {
  db = await createDb()
  await db.exec(`insert into auth.users (id) values ('${ana}'), ('${stranger}')`)
  await actAs(db, { user: ana })
  trip = (await one<{ id: string }>(db, `select create_trip(p_name => 'Colômbia & Panamá!', p_me => 'Ana') as id`)).id
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

describe('the trip’s email address', () => {
  it('made the first time it’s asked, then the same; a new one replaces it', async () => {
    await actAs(db, { user: ana })
    const { a } = await one<{ a: string }>(db, 'select trip_mail_address($1) as a', [trip])
    expect(a).toMatch(/^colombia-panama-[a-z2-9]{4}@voyagefare\.app$/)
    expect((await one<{ a: string }>(db, 'select trip_mail_address($1) as a', [trip])).a).toBe(a)
    const { b } = await one<{ b: string }>(db, 'select trip_mail_address($1, true) as b', [trip])
    expect(b).not.toBe(a)
    expect(b).toMatch(/^colombia-panama-/)
  })

  it('a stranger can’t get it', async () => {
    await actAs(db, { user: stranger })
    expect(await refused(db, `select trip_mail_address('${trip}')`)).toBe(true)
  })
})

describe('To review', () => {
  it('members see what was forwarded and mark it; nobody else sees it; only the server adds', async () => {
    await actAs(db, 'owner')
    const { id } = await one<{ id: string }>(
      db,
      `insert into trip_mails (trip_id, resend_id, forwarded_by, forwarder, subject, found)
       values ($1, 'em_1', $2, 'Ana', 'Your booking is confirmed', '{"is_booking": true, "name": "Casona"}') returning id`,
      [trip, ana],
    )

    await actAs(db, { user: ana })
    expect(await rows(db, 'select subject, status from trip_mails')).toEqual([
      { subject: 'Your booking is confirmed', status: 'new' },
    ])
    await db.query(`update trip_mails set status = 'done' where id = $1`, [id])
    expect(await one(db, 'select status from trip_mails where id = $1', [id])).toEqual({ status: 'done' })
    expect(await refused(db, `update trip_mails set found = null where id = '${id}'`)).toBe(true)
    expect(await refused(db, `insert into trip_mails (trip_id, resend_id) values ('${trip}', 'em_fake')`)).toBe(true)

    await actAs(db, { user: stranger })
    expect(await rows(db, 'select * from trip_mails')).toEqual([])
  })

  it('the same email is never read twice', async () => {
    await actAs(db, 'owner')
    expect(await refused(db, `insert into trip_mails (trip_id, resend_id) values ('${trip}', 'em_1')`)).toBe(true)
  })
})
