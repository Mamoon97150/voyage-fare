import { describe, expect, it } from 'vitest'
import { checkConfirm, checkEmail, checkPassword, explainAuthError, onlyErrors, safeNext } from './authForm'

describe('field checks', () => {
  it('email: required and shaped like an address', () => {
    expect(checkEmail('')).toBe('Enter your email address.')
    expect(checkEmail('  ')).toBe('Enter your email address.')
    expect(checkEmail('dana')).toMatch(/doesn’t look like/)
    expect(checkEmail('dana@mail')).toMatch(/doesn’t look like/)
    expect(checkEmail(' dana@mail.com ')).toBeUndefined()
  })

  it('password: a new one needs 8 characters, signing in only needs one', () => {
    expect(checkPassword('', { isNew: true })).toBe('Choose a password.')
    expect(checkPassword('short', { isNew: true })).toBe('Use at least 8 characters.')
    expect(checkPassword('long enough', { isNew: true })).toBeUndefined()
    expect(checkPassword('', { isNew: false })).toBe('Enter your password.')
    expect(checkPassword('short', { isNew: false })).toBeUndefined()
  })

  it('confirm: must match', () => {
    expect(checkConfirm('secret123', '')).toBe('Type your password again.')
    expect(checkConfirm('secret123', 'secret124')).toMatch(/don’t match/)
    expect(checkConfirm('secret123', 'secret123')).toBeUndefined()
  })

  it('keeps only the fields with an error', () => {
    expect(onlyErrors({ email: undefined, password: 'x' })).toEqual({ password: 'x' })
    expect(onlyErrors({ email: undefined })).toEqual({})
  })
})

describe('server answers, in words', () => {
  it('wrong credentials stay vague on purpose (no field)', () => {
    expect(explainAuthError({ code: 'invalid_credentials' })).toEqual({
      message: 'Wrong email or password. Check them, or reset your password.',
    })
  })

  it('points at the right field', () => {
    expect(explainAuthError({ code: 'user_already_exists' }).field).toBe('email')
    expect(explainAuthError({ code: 'email_not_confirmed' }).field).toBe('email')
    expect(explainAuthError({ code: 'weak_password' }).field).toBe('password')
    expect(explainAuthError({ code: 'same_password' }).field).toBe('password')
  })

  it('too many attempts, no connection, anything else', () => {
    expect(explainAuthError({ status: 429 }).message).toMatch(/Too many attempts/)
    expect(explainAuthError({ message: 'Failed to fetch' }).message).toMatch(/connection/)
    expect(explainAuthError({ message: 'boom' }).message).toMatch(/Something went wrong/)
  })
})

describe('where to go after signing in', () => {
  it('goes back to the page asked for', () => {
    expect(safeNext('/trips/abc')).toBe('/trips/abc')
  })

  it('never leaves the app', () => {
    expect(safeNext('https://evil.example')).toBe('/trips')
    expect(safeNext('//evil.example')).toBe('/trips')
    expect(safeNext('/\\evil.example')).toBe('/trips')
    expect(safeNext(null)).toBe('/trips')
  })
})
