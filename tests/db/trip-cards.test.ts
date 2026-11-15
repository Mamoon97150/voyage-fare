// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { ids, seedTrip } from './fixture'
import { actAs, createDb, num, one, rows } from './helpers'

// Mockup trips-welcome-v5 (15 Nov): "Your trips" as a shelf of notebooks, one call for every card.
let db: PGlite
const owner = { user: ids.owner }

type Card = {
  id: string
  name: string
  places: { id: string; name: string; nights: number }[]
  travellers: { id: string; name: string; me: boolean }[]
  share_confirmed: string
  share_estimated: string
  next_due: { name: string; due_on: string; left: number } | null
  undecided: { name: string; options: number } | null
  undecided_count: number
  today: string[] | null
  settle: { name: string; amount: number; you_pay: boolean }[] | null
  settled: boolean
}
const cards = () => rows<Card>(db, 'select * from trip_cards()')

beforeEach(async () => {
  db = await createDb()
  await seedTrip(db)
  await db.exec(`
    insert into trip_members (trip_id, user_id, role) values ('${ids.trip}', '${ids.owner}', 'owner') on conflict do nothing;
    update travellers set user_id = '${ids.owner}' where id = '${ids.ana}';
  `)
})

describe('your trips: one card per trip', () => {
  it('the route, who’s going (you marked), and your share', async () => {
    await actAs(db, owner)
    const [card] = await cards()
    expect(card.name).toBe('Lisbon & Porto')
    expect(card.places.map((p) => `${p.name} ${p.nights}`)).toEqual(['Lisbon 3', 'Porto 2'])
    expect(card.travellers.map((t) => (t.me ? `${t.name}*` : t.name))).toEqual(['Ana*', 'Bea', 'Cleo', 'Dana'])
    const share = await one<{ share_confirmed: string; share_estimated: string }>(
      db,
      'select * from v_traveller_shares where traveller_id = $1',
      [ids.ana],
    )
    expect(num(card.share_confirmed)).toBe(num(share.share_confirmed))
    expect(num(card.share_estimated)).toBe(num(share.share_estimated))
  })

  it('only your trips: not a stranger’s, not the public demo', async () => {
    await actAs(db, 'owner')
    await db.exec(`update trips set is_demo = true where id = '${ids.trip}'`)
    await actAs(db, { user: ids.stranger })
    expect(await cards()).toHaveLength(0)
    await actAs(db, 'anon')
    await expect(cards()).rejects.toThrow()
  })

  it('the things to sort out: the next payment due, the lines with no option chosen', async () => {
    await actAs(db, owner)
    let [card] = await cards()
    expect(card.next_due).toBeNull()
    expect(card.undecided).toBeNull()
    expect(card.undecided_count).toBe(0)

    await actAs(db, 'owner')
    await db.exec(`
      update items set due_on = current_date + 30 where id = '${ids.flat}';
      update options set is_chosen = false where item_id = '${ids.flights}';
    `)
    await actAs(db, owner)
    ;[card] = await cards()
    expect(card.next_due).toMatchObject({ name: 'Lisbon flat', left: 500 })
    expect(card.undecided).toEqual({ name: 'Flights', options: 2 })
    expect(card.undecided_count).toBe(1)
  })

  it('while travelling: today’s plans, not the stay or the tickets', async () => {
    await actAs(db, owner)
    expect((await cards())[0].today).toBeNull()
    await actAs(db, 'owner')
    // Day 2 is today: the photo shoot (paid) and the birthday dinner (chosen).
    await db.exec(
      `update trips set start_date = current_date - 1, end_date = current_date + 3 where id = '${ids.trip}'`,
    )
    await actAs(db, owner)
    expect((await cards())[0].today).toEqual(['Birthday dinner', 'Photo shoot'])
  })

  it('who pays whom, for what concerns you: Ana paid the flights, the others pay her back', async () => {
    await actAs(db, owner)
    const [card] = await cards()
    expect(card.settled).toBe(false)
    expect(card.settle).toEqual([
      { name: 'Cleo', amount: 270, you_pay: false },
      { name: 'Dana', amount: 260, you_pay: false },
      { name: 'Bea', amount: 160, you_pay: false },
    ])
    // Bea sees only what concerns her.
    await actAs(db, 'owner')
    await db.exec(`update travellers set user_id = null where id = '${ids.ana}';
      update travellers set user_id = '${ids.owner}' where id = '${ids.bea}'`)
    await actAs(db, owner)
    expect((await cards())[0].settle).toEqual([{ name: 'Ana', amount: 160, you_pay: true }])
  })
})
