// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, one, rows } from './helpers'

// Mockup invitations-v4 (14 Nov): the organizer invites Dana by link; Dana opens it,
// signs in and becomes Dana on the trip.
let db: PGlite
const guestId = '00000000-0000-0000-0000-0000000000a3'
const otherId = '00000000-0000-0000-0000-0000000000a4'
const owner = { user: ids.owner }
const guest = { user: guestId }
const other = { user: otherId }

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(`
    insert into auth.users (id) values ('${guestId}'), ('${otherId}');
    insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing;
    update travellers set user_id = '${ids.owner}' where id = '${ids.ana}';
  `)
})

afterEach(async () => {
  await actAs(db, 'owner')
})

const invite = async (traveller: string) =>
  one<{ token: string; expires_at: string }>(db, 'select * from invite_traveller($1)', [traveller])
const preview = (token: string) =>
  one<{ trip_name: string; traveller_name: string; invited_by_name: string; state: string; places: string[] }>(
    db,
    'select * from invitation_preview($1)',
    [token],
  )
const accept = (token: string) => db.query<{ trip: string }>('select accept_invitation($1) as trip', [token])
const danaUser = async () =>
  (await one<{ user_id: string | null }>(db, 'select user_id from travellers where id = $1', [ids.dana])).user_id

describe('inviting a traveller', () => {
  it('gives a link that works for 14 days; sending it again gives the same link', async () => {
    await actAs(db, owner)
    const first = await invite(ids.dana)
    expect(first.token).toMatch(/^[0-9a-f]{32}$/)
    const days = (new Date(first.expires_at).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(13.9)
    expect((await invite(ids.dana)).token).toBe(first.token)
  })

  it('someone already on the trip can’t be invited; a stranger can’t invite', async () => {
    await actAs(db, owner)
    await expect(invite(ids.ana)).rejects.toThrow('Ana is already on the trip.')
    await actAs(db, { user: ids.stranger })
    await expect(invite(ids.dana)).rejects.toThrow()
  })

  it('the link shows whose trip it is and who you are on it, even signed out', async () => {
    await actAs(db, owner)
    const { token } = await invite(ids.dana)
    await actAs(db, 'anon')
    const p = await preview(token)
    expect(p).toMatchObject({ traveller_name: 'Dana', invited_by_name: 'Ana', state: 'open' })
    expect(p.places).toEqual(['Lisbon', 'Porto'])
    expect(await rows(db, 'select * from invitation_preview($1)', ['nope'])).toHaveLength(0)
  })

  it('the tokens stay with the trip’s members', async () => {
    await actAs(db, owner)
    await invite(ids.dana)
    await actAs(db, { user: ids.stranger })
    expect(await rows(db, 'select * from invitations')).toHaveLength(0)
    await actAs(db, 'anon')
    await expect(db.query('select * from invitations')).rejects.toThrow()
  })
})

describe('accepting', () => {
  it('you join as that traveller and see the trip', async () => {
    await actAs(db, owner)
    const { token } = await invite(ids.dana)
    await actAs(db, guest)
    expect(await rows(db, 'select id from trips where id = $1', [ids.trip])).toHaveLength(0)
    expect((await accept(token)).rows[0].trip).toBe(ids.trip)
    expect(await rows(db, 'select id from trips where id = $1', [ids.trip])).toHaveLength(1)
    expect(await danaUser()).toBe(guestId)
    const member = await one<{ role: string }>(db, 'select role from trip_members where trip_id = $1 and user_id = $2', [ids.trip, guestId])
    expect(member.role).toBe('editor')
    expect((await preview(token)).state).toBe('joined')
    // Opening the link again just opens the trip.
    expect((await accept(token)).rows[0].trip).toBe(ids.trip)
  })

  it('a link works once', async () => {
    await actAs(db, owner)
    const { token } = await invite(ids.dana)
    await actAs(db, guest)
    await accept(token)
    await actAs(db, other)
    expect((await preview(token)).state).toBe('used')
    await expect(accept(token)).rejects.toThrow('This invitation was already used.')
    await actAs(db, 'owner')
    expect(await danaUser()).toBe(guestId)
  })

  it('a cancelled or expired link doesn’t work', async () => {
    await actAs(db, owner)
    const { token } = await invite(ids.dana)
    await db.query('select cancel_invitation($1)', [ids.dana])
    await actAs(db, guest)
    expect((await preview(token)).state).toBe('cancelled')
    await expect(accept(token)).rejects.toThrow('cancelled or has expired')

    await actAs(db, owner)
    const fresh = await invite(ids.dana)
    expect(fresh.token).not.toBe(token)
    await actAs(db, 'owner')
    await db.query(`update invitations set expires_at = now() - interval '1 minute' where token = $1`, [fresh.token])
    await actAs(db, guest)
    expect((await preview(fresh.token)).state).toBe('expired')
    await expect(accept(fresh.token)).rejects.toThrow('cancelled or has expired')
    await actAs(db, 'owner')
    expect(await danaUser()).toBeNull()
  })

  it('you can’t be two travellers on the same trip', async () => {
    await actAs(db, owner)
    const forCleo = await invite(ids.cleo)
    const forDana = await invite(ids.dana)
    await actAs(db, guest)
    await accept(forCleo.token)
    await expect(accept(forDana.token)).rejects.toThrow('You’re already on this trip as Cleo.'.replace('’', "'"))
  })

  it('needs an account', async () => {
    await actAs(db, owner)
    const { token } = await invite(ids.dana)
    await actAs(db, 'anon')
    await expect(accept(token)).rejects.toThrow()
  })
})

describe('leaving and removing', () => {
  async function danaJoins() {
    await actAs(db, owner)
    const { token } = await invite(ids.dana)
    await actAs(db, guest)
    await accept(token)
  }

  it('leaving: back to a name on the notebook, share and payments stay', async () => {
    await danaJoins()
    const before = await rows(db, 'select * from v_traveller_shares where traveller_id = $1', [ids.dana])
    await db.query('select leave_trip($1)', [ids.trip])
    expect(await rows(db, 'select id from trips where id = $1', [ids.trip])).toHaveLength(0)
    await actAs(db, owner)
    expect(await danaUser()).toBeNull()
    expect(await rows(db, 'select * from v_traveller_shares where traveller_id = $1', [ids.dana])).toEqual(before)
  })

  it('the creator can’t leave', async () => {
    await actAs(db, owner)
    await expect(db.query('select leave_trip($1)', [ids.trip])).rejects.toThrow('you can delete it, not leave it')
  })

  it('only the creator removes someone who has an account, and they lose access', async () => {
    await danaJoins()
    await actAs(db, 'owner')
    await db.exec(`update items set status = 'chosen', actual_amount = null, actual_currency = null, paid_by = null where trip_id = '${ids.trip}'`)
    // Cleo joins too, and tries to remove Dana.
    await actAs(db, owner)
    const forCleo = await invite(ids.cleo)
    await actAs(db, other)
    await accept(forCleo.token)
    await expect(db.query('select remove_traveller($1)', [ids.dana])).rejects.toThrow('only the person who created the trip can remove them')

    await actAs(db, owner)
    await db.query('select remove_traveller($1)', [ids.dana])
    await actAs(db, guest)
    expect(await rows(db, 'select id from trips where id = $1', [ids.trip])).toHaveLength(0)
  })
})
