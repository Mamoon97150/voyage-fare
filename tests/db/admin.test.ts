// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { actAs, createDb, one, refused as refusedIn, rows } from './helpers'

let db: PGlite
const dj = '00000000-0000-0000-0000-0000000000c1'
const ana = '00000000-0000-0000-0000-0000000000c2'
const jo = '00000000-0000-0000-0000-0000000000c3'

beforeAll(async () => {
  db = await createDb()
  // The few auth.users columns Supabase has and the admin functions read.
  await db.exec(`
    alter table auth.users add column email text, add column raw_user_meta_data jsonb,
      add column created_at timestamptz default now(), add column last_sign_in_at timestamptz,
      add column email_confirmed_at timestamptz;
    insert into auth.users (id, email, raw_user_meta_data, last_sign_in_at, email_confirmed_at) values
      ('${dj}', 'dj@mail.test', '{"first_name":"Djamina"}', now(), now()),
      ('${ana}', 'ana@mail.test', '{"first_name":"Ana"}', now() - interval '10 days', null),
      ('${jo}', 'jo@mail.test', '{"first_name":"Jo"}', null, now());
    insert into admins (user_id, is_first) values ('${dj}', true);
  `)
  await actAs(db, { user: ana })
  await db.exec(`select create_trip(p_name => 'Lisbon', p_me => 'Ana')`)
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

describe('admin role and feedback', () => {
  it('anyone signed in sends feedback; only admins read it, with the email only if they may write back', async () => {
    await actAs(db, { user: ana })
    await db.exec(
      `insert into feedback (kind, message, page, device, can_reply) values ('broken', 'Budget shows 0 €', 'Budget', 'iPhone', true)`,
    )
    await db.exec(`insert into feedback (kind, message, can_reply) values ('idea', 'Hotels on a map', false)`)
    expect(await rows(db, 'select * from feedback')).toEqual([]) // can't read back
    expect(
      await refused(db, `insert into feedback (user_id, kind, message) values ('${jo}', 'love', 'pretending')`),
    ).toBe(true)
    expect(await refused(db, 'select * from admin_feedback()')).toBe(true)
    expect((await one<{ a: boolean }>(db, 'select am_i_admin() as a')).a).toBe(false)

    await actAs(db, { user: dj })
    expect((await one<{ a: boolean }>(db, 'select am_i_admin() as a')).a).toBe(true)
    const list = await rows<{ kind: string; first_name: string; email: string | null }>(
      db,
      'select kind, first_name, email from admin_feedback() order by kind',
    )
    expect(list).toEqual([
      { kind: 'broken', first_name: 'Ana', email: 'ana@mail.test' },
      { kind: 'idea', first_name: 'Ana', email: null },
    ])
    await db.exec(`update feedback set status = 'done' where kind = 'idea'`)
    expect((await one<{ n: number }>(db, `select count(*)::int as n from feedback where status = 'new'`)).n).toBe(1)
  })

  it('overview and people: numbers and accounts, for admins only', async () => {
    await actAs(db, { user: ana })
    expect(await refused(db, 'select admin_overview()')).toBe(true)
    expect(await refused(db, 'select * from admin_people()')).toBe(true)
    await actAs(db, { user: dj })
    const o = (await one<{ o: Record<string, number> }>(db, 'select admin_overview() as o')).o
    expect(o).toMatchObject({ accounts: 3, trips: 1, active_week: 1, new_messages: 1, files_bytes: 0 })
    const people = await rows<{ first_name: string; trips: string; confirmed: boolean; is_admin: boolean }>(
      db,
      'select first_name, trips, confirmed, is_admin from admin_people() order by first_name',
    )
    expect(people.map((p) => [p.first_name, Number(p.trips), p.confirmed, p.is_admin])).toEqual([
      ['Ana', 1, false, false],
      ['Djamina', 0, true, true],
      ['Jo', 0, true, false],
    ])
  })

  it('admins add and remove admins; the first one stays; nobody else can', async () => {
    await actAs(db, { user: ana })
    expect(await refused(db, `select admin_add('ana@mail.test')`)).toBe(true)
    expect(await refused(db, 'insert into admins (user_id) values (auth.uid())')).toBe(true)
    await actAs(db, { user: dj })
    expect(await refused(db, `select admin_add('nobody@mail.test')`)).toBe(true)
    await db.exec(`select admin_add('JO@mail.test')`)
    const admins = await rows<{ first_name: string; added_by_name: string | null }>(
      db,
      'select first_name, added_by_name from admin_list()',
    )
    expect(admins).toEqual([
      { first_name: 'Djamina', added_by_name: null },
      { first_name: 'Jo', added_by_name: 'Djamina' },
    ])
    await actAs(db, { user: jo })
    expect(await refused(db, `select admin_remove('${dj}')`)).toBe(true)
    await db.exec(`select admin_remove('${jo}')`)
    expect((await one<{ a: boolean }>(db, 'select am_i_admin() as a')).a).toBe(false)
  })
})
