import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, setThemeChoice, themeChoice } from './theme'

// Dark mode (16 Nov): Auto follows the phone; Light / Dark are kept on this phone.
const phoneIsDark = (dark: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: dark, addEventListener: () => undefined }))

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('the look', () => {
  it('Auto follows the phone', () => {
    phoneIsDark(true)
    applyTheme()
    expect(themeChoice()).toBe('auto')
    expect(document.documentElement.dataset.theme).toBe('dark')
    phoneIsDark(false)
    applyTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('Light or Dark is kept, whatever the phone says; drawings are told to redraw', () => {
    phoneIsDark(true)
    const redraw = vi.fn()
    window.addEventListener('vf-theme', redraw)
    setThemeChoice('light')
    expect(themeChoice()).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(redraw).toHaveBeenCalled()
    setThemeChoice('auto')
    expect(localStorage.getItem('vf-theme')).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
