import { describe, expect, it } from 'vitest'
import { deviceOf, pageOf } from './feedback'

describe('where feedback comes from', () => {
  it('the page, with the trip’s name on trip pages', () => {
    expect(pageOf('/trips/t1/budget', 'Colombia & Panama')).toBe('Budget · Colombia & Panama')
    expect(pageOf('/trips/t1', 'Colombia')).toBe('Trip · Colombia')
    expect(pageOf('/trips/new', 'x')).toBe('New trip')
    expect(pageOf('/trips', null)).toBe('Your trips')
  })
  it('the phone and browser', () => {
    expect(
      deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari'),
    ).toBe('iPhone, Safari')
    expect(deviceOf('Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile Safari')).toBe('Android, Chrome')
  })
})
