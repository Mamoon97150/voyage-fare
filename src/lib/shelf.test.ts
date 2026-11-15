import { describe, expect, it } from 'vitest'
import {
  countdown,
  dayOfTrip,
  greeting,
  monthYear,
  placeOn,
  settleLines,
  shelve,
  sortOutNote,
  toSortOut,
} from './shelf'
import { card } from '../test/cards'

const colombia = card({
  id: 'co',
  name: 'Colombia & Panama',
  start_date: '2026-09-04',
  end_date: '2026-09-18',
  places: [
    { id: 'b', name: 'Bogotá', nights: 2 },
    { id: 'g', name: 'Guatapé', nights: 2 },
    { id: 'm', name: 'Medellín', nights: 4 },
  ],
})
const lisbon = card({
  id: 'li',
  name: 'Lisbon & Porto',
  start_date: '2027-04-12',
  end_date: '2027-04-20',
  places: [{ id: 'l', name: 'Lisbon', nights: 3 }],
})
const japan = card({ id: 'ja', name: 'Japan' })

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('the shelf', () => {
  it('the next trip big; coming, dreams and past apart', () => {
    const s = shelve([japan, lisbon, colombia], '2026-11-15')
    expect(s.featured?.id).toBe('li')
    expect(s.travelling).toBe(false)
    expect(s.coming).toEqual([])
    expect(s.dreams.map((t) => t.id)).toEqual(['ja'])
    expect(s.past.map((t) => t.id)).toEqual(['co'])
  })

  it('while travelling, the trip you’re on goes on top', () => {
    const s = shelve([lisbon, colombia], '2026-09-09')
    expect(s.featured?.id).toBe('co')
    expect(s.travelling).toBe(true)
    expect(s.coming.map((t) => t.id)).toEqual(['li'])
    expect(dayOfTrip(colombia, '2026-09-09')).toEqual({ day: 6, of: 15 })
    expect(placeOn(colombia, 6)?.name).toBe('Medellín')
    expect(placeOn(colombia, 1)?.name).toBe('Bogotá')
    expect(placeOn(colombia, 3)?.name).toBe('Guatapé')
    expect(placeOn(colombia, 15)?.name).toBe('Medellín')
  })

  it('the hand note at the top', () => {
    expect(greeting(shelve([lisbon], '2026-11-15'), 'Djamina', '2026-11-15')).toBe('Hi Djamina, 148 days to Lisbon')
    expect(greeting(shelve([lisbon], '2027-04-11'), 'Djamina', '2027-04-11')).toBe(
      'Hi Djamina, you leave for Lisbon tomorrow',
    )
    expect(greeting(shelve([colombia], '2026-09-09'), 'Djamina', '2026-09-09')).toBe('Day 6, enjoy Medellín!')
    expect(greeting(shelve([japan], '2026-11-15'), 'Djamina', '2026-11-15')).toBe('Hi Djamina, where to next?')
  })

  it('the countdown: days, then months on a small card', () => {
    expect(countdown(1)).toBe('Tomorrow')
    expect(countdown(148)).toBe('In 148 days')
    expect(countdown(40, true)).toBe('In 40 days')
    expect(countdown(148, true)).toBe('In 5 months')
    expect(countdown(365, true)).toBe('In 1 year')
  })

  it('what’s left to sort out, and who owes whom', () => {
    const t = card({
      nextDue: { name: 'Hotel deposit', dueOn: '2026-12-15', left: 180 },
      undecided: { name: 'Porto → Lisbon train', options: 3 },
      undecidedCount: 2,
      settle: [
        { name: 'Danielle', amount: 42, youPay: true },
        { name: 'Peggy', amount: 69, youPay: false },
      ],
    })
    const { lines, count } = toSortOut(t)
    expect(lines.map(plain)).toEqual([
      'Hotel deposit, 180 € · due 15 Dec',
      'Porto → Lisbon train: 3 options, none chosen',
    ])
    expect(sortOutNote(count)).toBe('3 things to sort out')
    expect(sortOutNote(0)).toBe('all sorted')
    expect(settleLines(t).map((l) => plain(l.text))).toEqual(['You owe Danielle 42 €', 'Peggy owes you 69 €'])
    expect(monthYear('2026-09-04')).toBe('Sept 2026')
  })
})
