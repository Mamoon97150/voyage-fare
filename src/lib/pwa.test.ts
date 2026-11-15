import { describe, expect, it } from 'vitest'
import { installCard, isIos, sharedPost } from './pwa'

const base = { standalone: false, installed: false, canPrompt: false, ios: false, snoozedUntil: null, now: 1000 }

describe('the "Keep it on your phone" card', () => {
  it('Android: a button once Chrome offers to install', () => {
    expect(installCard({ ...base, canPrompt: true })).toBe('button')
  })
  it('iPhone: the two steps in Safari', () => {
    expect(installCard({ ...base, ios: true })).toBe('ios')
  })
  it('nothing on a computer that offers nothing', () => {
    expect(installCard(base)).toBeNull()
  })
  it('never once it opens from the home screen, or after installing', () => {
    expect(installCard({ ...base, canPrompt: true, standalone: true })).toBeNull()
    expect(installCard({ ...base, ios: true, installed: true })).toBeNull()
  })
  it('"Not now" hides it until the month is over', () => {
    expect(installCard({ ...base, ios: true, snoozedUntil: 2000 })).toBeNull()
    expect(installCard({ ...base, ios: true, snoozedUntil: 900 })).toBe('ios')
  })
})

describe('iPhones and iPads', () => {
  it('reads the browser name', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(isIos('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(false)
  })
  it('an iPad says it is a Mac, but has a touch screen', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
  })
})

describe('a post shared from another app', () => {
  const shared = (q: Record<string, string>) => sharedPost(new URLSearchParams(q))
  it('Instagram puts the link in the text', () => {
    expect(shared({ text: 'Look at this https://www.instagram.com/p/C9xK2abc/?igsh=xyz' })).toEqual({
      link: 'https://www.instagram.com/p/C9xK2abc/?igsh=xyz',
      name: null,
    })
  })
  it('the url field wins, and a real title becomes the name', () => {
    expect(shared({ url: 'https://maps.app.goo.gl/abc', title: 'Cantinho do Avillez', text: 'x' })).toEqual({
      link: 'https://maps.app.goo.gl/abc',
      name: 'Cantinho do Avillez',
    })
  })
  it("an app's name or a link is not a restaurant's name", () => {
    expect(shared({ title: 'Instagram', text: 'https://instagram.com/p/1' }).name).toBeNull()
    expect(shared({ title: 'https://tiktok.com/@eat/video/1' })).toEqual({
      link: 'https://tiktok.com/@eat/video/1',
      name: null,
    })
  })
  it('nothing shared: no link', () => {
    expect(shared({})).toEqual({ link: null, name: null })
  })
})
