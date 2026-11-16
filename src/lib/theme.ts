// Dark mode (decided 16 Nov, direction A "Lamp-lit"): Me → Look = Auto (the phone's own setting),
// Light or Dark, kept on this phone. <html data-theme="light|dark"> carries what's shown; index.html
// sets it before the first paint so the app never flashes the wrong colours.
export type ThemeChoice = 'auto' | 'light' | 'dark'

const KEY = 'vf-theme'
const PAPER = { light: '#F6F0E3', dark: '#1C1814' }

export function themeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

const systemDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true

/** Show the chosen look now: the colours, the phone's status bar, and the drawings redrawn. */
export function applyTheme(choice: ThemeChoice = themeChoice()) {
  const shown = choice === 'auto' ? (systemDark() ? 'dark' : 'light') : choice
  document.documentElement.dataset.theme = shown
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAPER[shown])
  window.dispatchEvent(new Event('vf-theme'))
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // Private browsing: it still changes for now.
  }
  applyTheme(choice)
}

/** Once, at start: follow the phone when it switches between day and night (Auto only). */
export function watchSystemTheme() {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (themeChoice() === 'auto') applyTheme('auto')
  })
}
