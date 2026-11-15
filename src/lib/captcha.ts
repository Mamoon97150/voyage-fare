// "Not a robot" check on sign-up, sign-in and the forms that send an email (15 Nov 2026):
// Cloudflare Turnstile. A robot signed up 5 minutes after going online; this stops that kind.
// Real people usually see nothing: the box only appears when Cloudflare needs a tap.
// Supabase checks the token (Authentication → Attack protection → CAPTCHA, Turnstile).

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const WAIT = 60_000 // time to tap the box if Cloudflare asks

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let loading: Promise<Turnstile | null> | null = null

function load(): Promise<Turnstile | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => resolve(window.turnstile ?? null)
    script.onerror = () => {
      loading = null // offline or blocked: try again next time
      resolve(null)
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Start loading Cloudflare's script as soon as a sign-in page opens, so the check is quick. */
export function preloadCaptcha() {
  if (SITE_KEY) void load()
}

let widget: string | null = null

/**
 * A fresh token for one Supabase call (each token works once). Undefined when the check is off
 * (no site key: tests, local without it) or couldn't run: then Supabase refuses with
 * captcha_failed, which explainAuthError turns into a clear message.
 */
export async function captchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined
  const turnstile = await load()
  if (!turnstile) return undefined
  let box = document.getElementById('vf-captcha')
  if (!box) {
    box = document.createElement('div')
    box.id = 'vf-captcha'
    box.className = 'captcha-box'
    document.body.appendChild(box)
  }
  const host = box
  return new Promise((resolve) => {
    let settled = false
    const finish = (token?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(token)
    }
    const timer = setTimeout(() => finish(undefined), WAIT)
    if (widget) turnstile.remove(widget)
    widget = turnstile.render(host, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      theme: 'light', // the notebook's paper, not Cloudflare's dark box
      callback: (token: string) => finish(token),
      'error-callback': () => finish(undefined),
      'expired-callback': () => finish(undefined),
    })
  })
}
