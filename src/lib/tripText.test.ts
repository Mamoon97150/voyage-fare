import { describe, expect, it } from 'vitest'
import { currencyLabel, formatDates, plural } from './tripText'

describe('trip dates in words', () => {
  it('no dates yet', () => expect(formatDates(null, null)).toBeNull())
  it('same month', () => expect(formatDates('2027-05-12', '2027-05-24')).toBe('12 – 24 May 2027'))
  it('across months', () => expect(formatDates('2027-04-28', '2027-05-03')).toBe('28 Apr – 3 May 2027'))
  it('across years', () => expect(formatDates('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027'))
  it('one day', () => expect(formatDates('2027-05-12', '2027-05-12')).toBe('12 May 2027'))
})

describe('small words', () => {
  it('plural', () => {
    expect(plural(1, 'traveller')).toBe('1 traveller')
    expect(plural(4, 'traveller')).toBe('4 travellers')
  })
  it('currency names', () => expect(currencyLabel('COP')).toBe('COP · Colombian Peso'))
})
