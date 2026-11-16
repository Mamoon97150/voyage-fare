// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const dj = '00000000-0000-0000-0000-0000000000d7'
const ana = '00000000-0000-0000-0000-0000000000d8'

beforeAll(async () => {
  db = await createDb()
  await db.exec(
    `insert into auth.users (id) values ('${dj}'), ('${ana}'); insert into admins (user_id, is_first) values ('${dj}', true);`,
  )
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

const sub = (endpoint: string) =>
  `insert into push_subscriptions (endpoint, p256dh, auth) values ('${endpoint}', 'k', 'a')`

describe('phone notifications (admins, and reminders for everyone since build 10)', () => {
  it('anyone subscribes their own phone; nobody sees another’s, and nobody reads the keys', async () => {
    await actAs(db, { user: dj })
    await db.exec(sub('https://push.test/dj-phone'))
    expect(await rows(db, 'select endpoint from push_subscriptions')).toEqual([
      { endpoint: 'https://push.test/dj-phone' },
    ])
    expect(await refused(db, 'select * from private.push_settings')).toBe(true)

    await actAs(db, { user: ana })
    await db.exec(sub('https://push.test/ana')) // reminders: not only admins (build 10)
    expect(await rows(db, 'select endpoint from push_subscriptions')).toEqual([{ endpoint: 'https://push.test/ana' }])
    expect(await refused(db, 'select * from private.push_settings')).toBe(true)

    await actAs(db, 'owner')
    const settings = await one<{ token: string }>(db, 'select hook_token as token from private.push_settings')
    expect(settings.token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('turning it off removes the phone', async () => {
    await actAs(db, { user: dj })
    await db.exec(`delete from push_subscriptions where endpoint = 'https://push.test/dj-phone'`)
    expect(await rows(db, 'select * from push_subscriptions')).toEqual([])
  })
})
