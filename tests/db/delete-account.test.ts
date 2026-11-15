// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, one, rows } from './helpers'

// "Delete my account" (sign-in polish, 15 Nov).
let db: PGlite
const beaUser = '00000000-0000-0000-0000-0000000000b2'
const solo = '10000000-0000-0000-0000-000000000099'

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(`
    insert into auth.users (id) values ('${beaUser}');
    insert into trip_members (trip_id, user_id, role) values
      ('${ids.trip}', '${ids.owner}', 'owner'), ('${ids.trip}', '${beaUser}', 'editor')
      on conflict do nothing;
    update travellers set user_id = '${ids.owner}' where id = '${ids.ana}';
    update travellers set user_id = '${beaUser}' where id = '${ids.bea}';
    insert into trips (id, name, created_by) values ('${solo}', 'Just me', '${ids.owner}');
    insert into trip_members (trip_id, user_id, role) values ('${solo}', '${ids.owner}', 'owner') on conflict do nothing;
  `)
})

describe('deleting my account', () => {
  it('my own trip goes; the shared one is handed over, and I stay a name on it', async () => {
    const shareBefore = await rows(db, 'select * from v_traveller_shares where traveller_id = $1', [ids.ana])
    await actAs(db, { user: ids.owner })
    await db.query('select delete_my_account()')
    await actAs(db, 'owner')
    expect(await rows(db, 'select id from trips where id = $1', [solo])).toHaveLength(0)
    expect(
      (await one<{ created_by: string }>(db, 'select created_by from trips where id = $1', [ids.trip])).created_by,
    ).toBe(beaUser)
    expect(
      (
        await one<{ role: string }>(db, 'select role from trip_members where trip_id = $1 and user_id = $2', [
          ids.trip,
          beaUser,
        ])
      ).role,
    ).toBe('owner')
    const ana = await one<{ name: string; user_id: string | null }>(
      db,
      'select name, user_id from travellers where id = $1',
      [ids.ana],
    )
    expect(ana).toEqual({ name: 'Ana', user_id: null })
    expect(await rows(db, 'select * from v_traveller_shares where traveller_id = $1', [ids.ana])).toEqual(shareBefore)
    expect(await rows(db, 'select id from auth.users where id = $1', [ids.owner])).toHaveLength(0)
  })

  it('Bea still sees the trip; nobody else’s account is touched', async () => {
    await actAs(db, { user: ids.owner })
    await db.query('select delete_my_account()')
    await actAs(db, { user: beaUser })
    expect(await rows(db, 'select id from trips where id = $1', [ids.trip])).toHaveLength(1)
    await actAs(db, 'owner')
    expect(await rows(db, 'select id from auth.users where id in ($1, $2)', [beaUser, ids.stranger])).toHaveLength(2)
  })

  it('needs to be signed in', async () => {
    await actAs(db, 'anon')
    await expect(db.query('select delete_my_account()')).rejects.toThrow()
  })
})
