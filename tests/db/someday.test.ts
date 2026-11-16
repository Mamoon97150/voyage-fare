// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, one, rows } from './helpers'

// Someday (build 8½, mockup menus-home-v6): ideas before there's a trip; only yours.
let db: PGlite

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await actAs(db, { user: ids.owner })
})

const save = (name: string, place: string | null, kind = 'restaurant', link: string | null = null) =>
  db.query(
    `insert into someday_ideas (place_name, place_latitude, place_longitude, kind, name, link)
     values ($1, 19.43, -99.13, $2, $3, $4)`,
    [place, kind, name, link],
  )

describe('Someday', () => {
  it('only yours: someone else sees nothing and can’t add to yours', async () => {
    await save('Mexico City', 'Mexico City')
    await actAs(db, { user: ids.stranger })
    expect(await rows(db, 'select * from someday_ideas')).toHaveLength(0)
    await expect(
      db.query(`insert into someday_ideas (user_id, name) values ($1, 'Mine now')`, [ids.owner]),
    ).rejects.toThrow()
  })

  it('a name and a web link only', async () => {
    await expect(save('  ', 'Lisbon')).rejects.toThrow()
    await expect(save('Pujol', 'Mexico City', 'restaurant', 'instagram')).rejects.toThrow()
    await expect(save('Pujol', 'Mexico City', 'hotel')).rejects.toThrow()
  })

  it('start a trip from a place’s ideas: the trip, you, the place, the ideas in its To try; they leave Someday', async () => {
    await save('Pujol', 'Mexico City', 'restaurant', 'https://www.instagram.com/p/abc')
    await save('Frida Kahlo museum', 'Mexico City', 'activity')
    await save('Taberna da Rua', 'Lisbon')
    const trip = (await one<{ id: string }>(db, `select start_trip_from_someday('Mexico City', 'Ana') as id`)).id
    expect(await one(db, 'select name from trips where id = $1', [trip])).toMatchObject({ name: 'Mexico City' })
    expect(await one(db, 'select name, user_id from travellers where trip_id = $1', [trip])).toMatchObject({
      name: 'Ana',
      user_id: ids.owner,
    })
    const place = await one<{ id: string; latitude: number }>(db, 'select * from places where trip_id = $1', [trip])
    expect(place.latitude).toBe(19.43)
    const lines = await rows<{
      name: string
      kind: string
      status: string
      day_number: number | null
      link: string | null
    }>(db, 'select name, kind, status, day_number, link from items where trip_id = $1 order by position', [trip])
    expect(lines).toEqual([
      { name: 'Pujol', kind: 'restaurant', status: 'idea', day_number: null, link: 'https://www.instagram.com/p/abc' },
      { name: 'Frida Kahlo museum', kind: 'activity', status: 'idea', day_number: null, link: null },
    ])
    expect((await rows<{ name: string }>(db, 'select name from someday_ideas')).map((r) => r.name)).toEqual([
      'Taberna da Rua',
    ])
  })

  it('nothing saved for that place: it says so', async () => {
    await expect(db.query(`select start_trip_from_someday('Nowhere')`)).rejects.toThrow('Nothing saved for that place.')
  })
})

describe('+ N from Someday', () => {
  it('a place of the same name takes your ideas into its To try; they leave Someday', async () => {
    await db.exec(
      `insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing`,
    )
    await save('Pastéis de Belém', 'lisbon')
    await save('Taberna', 'Elsewhere')
    const n = (await one<{ n: number }>(db, 'select someday_into_place($1) as n', [ids.lisbon])).n
    expect(n).toBe(1)
    expect(
      await rows(db, `select name, status from items where place_id = $1 and name = 'Pastéis de Belém'`, [ids.lisbon]),
    ).toEqual([{ name: 'Pastéis de Belém', status: 'idea' }])
    expect((await rows<{ name: string }>(db, 'select name from someday_ideas')).map((r) => r.name)).toEqual(['Taberna'])
  })

  it('someone not on the trip: nothing moves', async () => {
    await actAs(db, { user: ids.stranger })
    await save('Pastéis de Belém', 'Lisbon')
    await expect(db.query('select someday_into_place($1)', [ids.lisbon])).rejects.toThrow()
    expect(await rows(db, 'select * from someday_ideas')).toHaveLength(1)
  })
})
