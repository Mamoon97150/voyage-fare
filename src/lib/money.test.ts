import { describe, expect, it } from 'vitest'
import { formatMoney, NO_AMOUNT, parseAmount } from './money'

// Normalise the non-breaking spaces so the expectations stay readable.
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('formatMoney', () => {
  it('shows a dash when there is no amount, never 0 € (BR-4)', () => {
    expect(formatMoney(null)).toBe(NO_AMOUNT)
    expect(formatMoney(undefined)).toBe(NO_AMOUNT)
  })

  it('still shows a real zero as 0 €', () => {
    expect(plain(formatMoney(0))).toBe('0 €')
  })

  it('groups thousands with a space and puts the symbol after (BR-11)', () => {
    expect(plain(formatMoney(1259))).toBe('1 259 €')
    expect(plain(formatMoney(1234567))).toBe('1 234 567 €')
  })

  it('adds the per-person or total suffix (BR-11)', () => {
    expect(plain(formatMoney(1259, 'EUR', 'pp'))).toBe('1 259 € pp')
    expect(plain(formatMoney(2518, 'EUR', 'total'))).toBe('2 518 € total')
  })

  it('shows cents only when there are some', () => {
    expect(plain(formatMoney(12.5))).toBe('12,50 €')
    expect(plain(formatMoney(12.004))).toBe('12 €')
  })

  it('uses the currency code when it has no symbol', () => {
    expect(plain(formatMoney(450, 'USD'))).toBe('450 $')
    expect(plain(formatMoney(1800000, 'COP'))).toBe('1 800 000 COP')
  })

  it('keeps the minus sign for negative amounts', () => {
    expect(plain(formatMoney(-230))).toBe('−230 €')
  })
})

describe('reading a typed amount', () => {
  it.each([
    ['1200', 1200],
    ['1 200', 1200],
    ['1 200', 1200], // a thin space, as phones type it
    ["1'200", 1200],
    ['1.200', 1200], // French thousands: this used to be read as 1.2
    ['1,200', 1200],
    ['2.400.000', 2400000],
    ['2,400,000', 2400000],
    ['2 400 000', 2400000],
    ['1200,50', 1200.5],
    ['1200.5', 1200.5],
    ['19,99', 19.99],
    ['1.200,50', 1200.5],
    ['1,200.50', 1200.5],
    ['1 200,50', 1200.5],
    ['0', 0],
  ])('%s → %s', (typed, expected) => {
    expect(parseAmount(typed)).toBe(expected)
  })

  it.each(['', 'a lot', '-5', '12.', '1.2345', '1.20.300', '1.200.50,3', ',50', '1,2,3'])('“%s” is refused', (typed) => {
    expect(parseAmount(typed)).toBeNull()
  })
})
