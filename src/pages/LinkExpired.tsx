import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AuthSheet, FormMessage, SubmitButton, TextField } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { checkEmail, onlyErrors, type FieldErrors } from '../lib/authForm'
import { sendLink, type LinkKind } from '../lib/authLinks'

/**
 * An email link that's too old or already used (sign-in polish, 15 Nov): say so, and send a fresh
 * one. The answer is the same whether the account exists or not.
 */
export function LinkExpired() {
  const [params] = useSearchParams()
  const kind: LinkKind = params.get('kind') === 'recovery' ? 'recovery' : 'signup'
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = onlyErrors({ email: checkEmail(email) })
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    const error = await sendLink(kind, email)
    setBusy(false)
    setState(error ? 'error' : 'sent')
  }

  if (state === 'sent')
    return (
      <AuthSheet
        title="Check your inbox"
        intro={
          kind === 'recovery' ? (
            <>
              If an account exists for <strong>{email.trim()}</strong>, a new link to choose a password is on its way.
            </>
          ) : (
            <>
              If <strong>{email.trim()}</strong> still needs confirming, a new link is on its way. Already confirmed?
              Just sign in.
            </>
          )
        }
      >
        <p className="auth__switch">
          <Link to="/sign-in">Sign in</Link>
        </p>
      </AuthSheet>
    )

  return (
    <AuthSheet
      title="This link has expired"
      intro="Links in our emails work once, for an hour. No problem: we’ll send you a fresh one."
    >
      <form onSubmit={submit} noValidate className="form">
        {state === 'error' && (
          <FormMessage tone="error">Couldn’t send it. Wait a few minutes, then try again.</FormMessage>
        )}
        <SketchBox tape="mustard" className="form__sheet">
          <TextField
            field="email"
            label="Your email"
            type="email"
            value={email}
            onChange={setEmail}
            errors={errors}
            autoComplete="email"
            autoFocus
          />
        </SketchBox>
        <SubmitButton busy={busy} label="Send me a new link" busyLabel="Sending…" />
      </form>
      <p className="auth__switch">
        {kind === 'recovery' ? 'Remember it after all?' : 'Already confirmed?'} <Link to="/sign-in">Sign in</Link>
      </p>
    </AuthSheet>
  )
}
