import { describe, expect, it } from 'vitest'
import { balanceLines, betweenLines, headline, joinNames, parties, settleWords } from './moneyPages'
import type { TripDetail, TripMoney } from './trips'

// Build 10 (mockup money-v6): Djamina & Danielle pay together, so do Peggy & Gabriel.
const t = (id: string, name: string, position: number, group: string | null) =>
  ({ id, name, position, trip_id: 'trip', user_id: null, pay_group_id: group }) as TripDetail['travellers'][number]
const detail = {
  trip: { id: 'trip', currency: 'EUR', is_demo: false },
  travellers: [
    t('dj', 'Djamina', 0, 'g1'),
    t('da', 'Danielle', 1, 'g1'),
    t('pe', 'Peggy', 2, 'g2'),
    t('ga', 'Gabriel', 3, 'g2'),
  ],
  items: [{ id: 'massage', name: 'Massage in Cartagena' }],
} as unknown as TripDetail
const money = {
  categories: [],
  travellerCategories: [],
  balances: [],
  repayments: [],
  settlement: [{ from_traveller: 'pe', to_traveller: 'dj', amount: 134, from_group: 'g2', to_group: 'g1' }],
  parties: [
    {
      trip_id: 'trip',
      group_id: 'g1',
      traveller_id: null,
      lead_traveller: 'dj',
      position: 0,
      paid: 5388,
      share_of_paid: 5254,
      balance: 134,
    },
    {
      trip_id: 'trip',
      group_id: 'g2',
      traveller_id: null,
      lead_traveller: 'pe',
      position: 2,
      paid: 4986,
      share_of_paid: 5120,
      balance: -134,
    },
  ],
  between: [
    {
      trip_id: 'trip',
      group_id: 'g1',
      owed_by: 'dj',
      owed_to: 'da',
      amount: 40,
      item_id: 'massage',
      paid_on: '2026-09-08',
    },
  ],
} as unknown as TripMoney

describe('who pays together', () => {
  it('names a group "Djamina & Danielle", "Ana, Bea & Cleo"', () => {
    expect(joinNames(['Djamina', 'Danielle'])).toBe('Djamina & Danielle')
    expect(joinNames(['Ana', 'Bea', 'Cleo'])).toBe('Ana, Bea & Cleo')
    expect(parties(detail).map((p) => p.name)).toEqual(['Djamina & Danielle', 'Peggy & Gabriel'])
  })

  it('the answer speaks to the group; settling up names both sides', () => {
    expect(headline(detail, money, 'da')).toMatchObject({ words: 'You two are owed', amount: 134, owed: true })
    expect(settleWords(detail, 'pe', 'dj', 'da', { from: 'g2', to: 'g1' })).toBe('Peggy & Gabriel pay you two')
    expect(settleWords(detail, 'pe', 'dj', 'pe', { from: 'g2', to: 'g1' })).toBe('You two pay Djamina & Danielle')
  })

  it('balances: one row per group', () => {
    const lines = balanceLines(detail, money)
    expect(lines.map((l) => [l.name, l.balance, l.tag])).toEqual([
      ['Djamina & Danielle', 134, 'are owed'],
      ['Peggy & Gabriel', -134, 'owe'],
    ])
  })

  it('"between you two": only for the group, netted, with what it comes from', () => {
    expect(betweenLines(detail, money, 'dj')).toEqual([
      { from: 'dj', to: 'da', amount: 40, words: 'You owe Danielle', why: 'Danielle paid Massage in Cartagena' },
    ])
    expect(betweenLines(detail, money, 'pe')).toEqual([])
    const repaid = {
      ...money,
      between: [...money.between!, { ...money.between![0], owed_by: 'da', owed_to: 'dj', item_id: null }],
    }
    expect(betweenLines(detail, repaid as TripMoney, 'dj')).toEqual([])
  })
})
