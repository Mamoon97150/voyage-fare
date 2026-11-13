// One-time hints, remembered on this device only. Storage can be missing or blocked
// (private browsing): then the hint simply shows again, nothing breaks.
const PREFIX = 'vf-hint:'

export function hintSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === '1'
  } catch {
    return false
  }
}

export function markHintSeen(key: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, '1')
  } catch {
    // Not remembered: fine.
  }
}
