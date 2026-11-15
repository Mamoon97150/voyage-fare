// The app on the phone (build 7 step 5, mockup pwa-v5, 15 Nov): the service worker, the
// "Keep it on your phone" card, being offline, and what a post shared from another app carries.
import { useEffect, useState, useSyncExternalStore } from 'react'

/** Keep the app itself on the phone, so it opens without the internet. Built app only. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No service worker: the app still works, it just needs the internet to open.
    })
  })
}

// ── "Keep it on your phone" ───────────────────────────────────────────────────

/** Chrome's install prompt (Android): kept from the moment it's offered, used on "Add to home screen". */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let installPrompt: InstallPrompt | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e as InstallPrompt
    changed()
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    markInstalled()
    changed()
  })
}

const SNOOZE_KEY = 'vf-install-snoozed-until'
const INSTALLED_KEY = 'vf-installed'
const MONTH = 30 * 24 * 60 * 60_000

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Not remembered on this device: the card simply comes back.
  }
}

function markInstalled() {
  write(INSTALLED_KEY, '1')
}

/** Opened from the home screen (full screen, no browser bar). */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** An iPhone or iPad: Apple allows no install button, only Safari's Share → Add to Home Screen. */
export function isIos(userAgent: string, touchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  // iPads say they're a Mac: the touch screen gives them away.
  return /Macintosh/.test(userAgent) && touchPoints > 1
}

export type InstallCard = 'button' | 'ios' | null

/**
 * Which card to show: none once it's on the home screen, or for a month after "Not now";
 * on Android, a button (when Chrome offers it); on an iPhone, the two steps in Safari.
 */
export function installCard(state: {
  standalone: boolean
  installed: boolean
  canPrompt: boolean
  ios: boolean
  snoozedUntil: number | null
  now: number
}): InstallCard {
  if (state.standalone || state.installed) return null
  if (state.snoozedUntil !== null && state.now < state.snoozedUntil) return null
  if (state.canPrompt) return 'button'
  if (state.ios) return 'ios'
  return null
}

/** The card's state and its two actions. */
export function useInstallCard() {
  const canPrompt = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => installPrompt !== null,
    () => false,
  )
  const [snoozedUntil, setSnoozedUntil] = useState(() => Number(read(SNOOZE_KEY)) || null)
  const [now] = useState(() => Date.now())
  const card = installCard({
    standalone: isStandalone(),
    installed: read(INSTALLED_KEY) === '1',
    canPrompt,
    ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
    snoozedUntil,
    now,
  })

  return {
    card,
    notNow() {
      const until = Date.now() + MONTH
      write(SNOOZE_KEY, String(until))
      setSnoozedUntil(until)
    },
    async install() {
      const prompt = installPrompt
      if (!prompt) return
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      installPrompt = null
      if (outcome === 'accepted') markInstalled()
      changed()
    },
  }
}

// ── Offline ───────────────────────────────────────────────────────────────────

/** Is there a connection? Follows the phone's own online / offline events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

// ── Shared from another app ───────────────────────────────────────────────────

/**
 * What the phone's Share menu sends (/share?title=…&text=…&url=…): the link, and a name when
 * the post gives one. Instagram and TikTok put the link inside the text, not in "url".
 */
export function sharedPost(params: URLSearchParams): { link: string | null; name: string | null } {
  const findLink = (s: string | null) => s?.match(/https?:\/\/[^\s<>"]+/)?.[0] ?? null
  const link = findLink(params.get('url')) ?? findLink(params.get('text')) ?? findLink(params.get('title'))
  const title = params.get('title')?.trim() ?? ''
  // A title that's only an app's name or a link isn't the restaurant's name.
  const name = title && !findLink(title) && !/^(instagram|tiktok|google maps)$/i.test(title) ? title : null
  return { link, name }
}

/** Can the app read what was copied (the 📋 Paste button)? */
export const canPaste = () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
