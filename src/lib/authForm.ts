// Checks and messages for the account forms (cahier des charges §6.6:
// errors shown per field, and they say what happened and what to do).

export type Field = 'firstName' | 'email' | 'password'
export type FieldErrors = Partial<Record<Field, string>>

export const MIN_PASSWORD = 8

/** A password known from a data leak (our own check, or Supabase's on the Pro plan). */
export const LEAKED_PASSWORD =
  'This password has appeared in a data leak on another site. Choose another one: a short sentence works well.'

export function checkEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Enter your email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'This doesn’t look like an email address.'
  return undefined
}

export function checkPassword(password: string, { isNew }: { isNew: boolean }): string | undefined {
  if (!password) return isNew ? 'Choose a password.' : 'Enter your password.'
  if (isNew && password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters.`
  }
  return undefined
}

export function checkFirstName(name: string): string | undefined {
  if (!name.trim()) return 'Enter your first name.'
  if (name.trim().length > 40) return 'Keep it under 40 characters.'
  return undefined
}

/** Drop the fields without an error, so an empty object means "all good". */
export function onlyErrors(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as FieldErrors
}

/** What Supabase answered, turned into a message for a person, on the right field when there is one. */
export function explainAuthError(error: { message?: string; code?: string; status?: number; reasons?: string[] }): {
  field?: Field
  message: string
  /** The email isn't confirmed yet: the page offers to send the link again. */
  unconfirmed?: boolean
} {
  const code = error.code ?? ''
  // Our own database rules explain themselves ("Bea has paid or owes money…"): show them as they are.
  if (code === 'P0001' && error.message) return { message: error.message }
  const text = (error.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return { message: 'Wrong email or password. Check them, or reset your password.' }
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return {
      message: 'Confirm your email first: open the link we sent you when you signed up, then sign in.',
      unconfirmed: true,
    }
  }
  if (code === 'user_already_exists' || code === 'email_exists' || text.includes('already registered')) {
    return { field: 'email', message: 'An account already exists with this email. Sign in instead.' }
  }
  // Leaked password protection (Supabase checks Have I Been Pwned): the password is known to attackers.
  if (error.reasons?.includes('pwned') || text.includes('pwned') || text.includes('leaked')) {
    return { field: 'password', message: LEAKED_PASSWORD }
  }
  if (code === 'weak_password' || text.includes('password should')) {
    return { field: 'password', message: 'This password is too weak. Try a longer one.' }
  }
  if (code === 'same_password') {
    return { field: 'password', message: 'Choose a password different from the old one.' }
  }
  if (code === 'email_address_invalid') {
    return { field: 'email', message: 'This email address can’t be used. Try another one.' }
  }
  // The "not a robot" check (Turnstile) didn't pass or couldn't load.
  if (code === 'captcha_failed' || text.includes('captcha')) {
    return { message: 'We couldn’t check that you’re not a robot. Wait a moment, then try again.' }
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) {
    return { message: 'Too many attempts. Wait a few minutes, then try again.' }
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return { message: 'Can’t reach Voyage Fare. Check your connection and try again.' }
  }
  return { message: 'Something went wrong. Try again in a moment.' }
}

/**
 * Where to go after signing in. Only a path inside the app is accepted,
 * so a link can't send someone to another site.
 */
export function safeNext(next: string | null | undefined, fallback = '/trips'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
