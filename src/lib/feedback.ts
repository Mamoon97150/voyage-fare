// Feedback from the app (build 8): where it was sent from, said simply.

/** "iPhone, Safari": the phone and browser, said simply (sent with feedback). */
export function deviceOf(userAgent: string): string {
  const device = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent)
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Macintosh/.test(userAgent)
          ? 'Mac'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'Other'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox|FxiOS/.test(userAgent)
      ? 'Firefox'
      : /Chrome|CriOS/.test(userAgent)
        ? 'Chrome'
        : /Safari/.test(userAgent)
          ? 'Safari'
          : 'a browser'
  return `${device}, ${browser}`
}

const PAGES: [RegExp, string][] = [
  [/^\/trips\/[^/]+\/compare/, 'Compare'],
  [/^\/trips\/[^/]+\/budget/, 'Budget'],
  [/^\/trips\/[^/]+\/who-paid/, 'Who paid'],
  [/^\/trips\/[^/]+\/route/, 'The route'],
  [/^\/trips\/[^/]+\/settings/, 'Trip settings'],
  [/^\/trips\/[^/]+\/import/, 'Import from my AI'],
  [/^\/trips\/(new|import)$/, 'New trip'],
  [/^\/trips\/[^/]+/, 'Trip'],
  [/^\/trips$/, 'Your trips'],
  [/^\/demo/, 'The demo'],
  [/^\/account/, 'Your account'],
  [/^\/admin/, 'Admin'],
]

/** "Budget · Colombia & Panama": where in the app, with the trip's name when there is one. */
export function pageOf(pathname: string, tripName: string | null): string {
  const page = PAGES.find(([re]) => re.test(pathname))?.[1] ?? pathname
  return tripName && /^\/(trips\/[^/]+|demo)/.test(pathname) && !/^\/trips\/(new|import)$/.test(pathname)
    ? `${page} · ${tripName}`
    : page
}
