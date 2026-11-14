import { describe, expect, it } from 'vitest'
import { checkNameAndDates, checkTarget } from './tripFields'

describe('the trip’s fields', () => {
  it('a name, and both days in order unless not decided yet', () => {
    expect(checkNameAndDates({ name: ' ', noDates: true, start: '', end: '' })).toEqual({
      name: 'Give the trip a name.',
    })
    expect(checkNameAndDates({ name: 'Colombia', noDates: false, start: '2027-05-12', end: '' }).dates).toMatch(
      'both days',
    )
    expect(checkNameAndDates({ name: 'Colombia', noDates: false, start: '2027-05-12', end: '2027-05-01' }).dates).toBe(
      'The trip ends before it starts.',
    )
    expect(checkNameAndDates({ name: 'Colombia', noDates: false, start: '2027-05-01', end: '2027-05-12' })).toEqual({})
  })

  it('the target is optional, and must read as an amount', () => {
    expect(checkTarget('')).toEqual({ amount: null })
    expect(checkTarget('2 500')).toEqual({ amount: 2500 })
    expect(checkTarget('lots')).toEqual({ amount: null, error: 'Enter an amount, like 2 500.' })
  })
})
