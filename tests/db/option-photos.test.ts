// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, one } from './helpers'

let db: PGlite

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(
    `insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`,
  )
  await actAs(db, { user: ids.owner })
})

describe('photos and places on options (maps-v6)', () => {
  it('a picture from a link (https only), a place with its spot', async () => {
    const item = (
      await one<{ id: string }>(db, `select add_item($1, 'housing', 'Where we sleep', $2) as id`, [ids.trip, ids.porto])
    ).id
    const opt = (
      await one<{ id: string }>(
        db,
        `insert into options (trip_id, item_id, name, amount, currency, rate, photo_url, location_name, latitude, longitude)
         values ($1, $2, 'Gracery', 540, 'EUR', 1, 'https://img.example/a.jpg', 'Shinjuku', 35.69, 139.70) returning id`,
        [ids.trip, item],
      )
    ).id
    expect(await one(db, 'select photo_url, location_name from options where id = $1', [opt])).toMatchObject({
      photo_url: 'https://img.example/a.jpg',
      location_name: 'Shinjuku',
    })
    await expect(
      db.query(`update options set photo_url = 'http://img.example/a.jpg' where id = $1`, [opt]),
    ).rejects.toThrow()
    await expect(
      db.query(`update options set photo_url = 'javascript:alert(1)' where id = $1`, [opt]),
    ).rejects.toThrow()
  })
})
