// Links in our emails (confirm, reset, new email): what to do when one comes back with an error
// (sign-in polish, 15 Nov). Supabase puts the error in the address: after # (implicit flow) or ?.
import { supabase } from './supabase'

import type { LinkKind } from './linkAtStart'

export { linkError, linkKind, type LinkKind } from './linkAtStart'

/** Send a fresh link: a new confirmation, or a new password reset. */
export async function sendLink(kind: LinkKind, email: string, next = '/trips') {
  const { error } =
    kind === 'signup'
      ? await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        })
      : await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
  return error
}
