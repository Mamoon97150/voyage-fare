// Email links that come back with an error (sign-in polish, 15 Nov). Read before anything else:
// the Supabase client clears the error from the address as soon as it starts, so main.tsx imports
// this file first, and the app can still say "This link has expired". No Supabase import here.

export type LinkKind = 'signup' | 'recovery'

/** The error a link came back with, if any: "otp_expired", "access_denied"… */
export function linkError(url: { hash: string; search: string }): string | null {
  for (const part of [url.hash.replace(/^#/, ''), url.search.replace(/^\?/, '')]) {
    const params = new URLSearchParams(part)
    const code = params.get('error_code') ?? params.get('error')
    if (code) return code
  }
  return null
}

/** A reset link comes back to /reset-password; any other link was a sign-up confirmation. */
export const linkKind = (pathname: string): LinkKind => (pathname.startsWith('/reset-password') ? 'recovery' : 'signup')

/** The error the page was opened with, captured before Supabase clears it; used once. */
let atStart: { code: string; kind: LinkKind } | null =
  typeof window === 'undefined'
    ? null
    : (() => {
        const code = linkError(window.location)
        return code ? { code, kind: linkKind(window.location.pathname) } : null
      })()

/** The error the page opened with, until the app has shown it. */
export const linkErrorAtStart = () => atStart

/** Shown: forget it, so leaving /link-expired doesn't come back to it. */
export function clearLinkErrorAtStart() {
  atStart = null
}
