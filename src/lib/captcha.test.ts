import { describe, expect, it } from 'vitest'
import { captchaToken } from './captcha'

describe('captcha', () => {
  it('without a site key (tests, local), the check is off: no token, nothing loaded', async () => {
    expect(await captchaToken()).toBeUndefined()
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull()
  })
})
