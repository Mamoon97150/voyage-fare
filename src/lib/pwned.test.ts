// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { isPwned } from './pwned'

// SHA-1("password") = 5BAA6 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const answer = (body: string, ok = true) => vi.fn(async () => ({ ok, text: async () => body }) as Response)

describe('is a password known from a leak?', () => {
  it('only the first 5 characters of the hash are sent', async () => {
    const fetcher = answer('0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365')
    expect(await isPwned('password', fetcher)).toBe(true)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6')
    expect(url.split('/range/')[1]).toHaveLength(5)
    expect(init.headers).toEqual({ 'Add-Padding': 'true' })
  })

  it('not in the list, or only as padding (count 0): fine', async () => {
    expect(await isPwned('password', answer('0018A45C4D1DEF81644B54AB7F969B88D65:3'))).toBe(false)
    expect(await isPwned('password', answer('1E4C9B93F3F0682250B6CF8331B7EE68FD8:0'))).toBe(false)
  })

  it('the service is down or unreachable: the password is accepted', async () => {
    expect(await isPwned('password', answer('', false))).toBe(false)
    expect(
      await isPwned(
        'password',
        vi.fn(async () => {
          throw new Error('offline')
        }),
      ),
    ).toBe(false)
  })
})
