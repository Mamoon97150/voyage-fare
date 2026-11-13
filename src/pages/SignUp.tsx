import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthSheet, FormMessage, SubmitButton, TextField } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import {
  MIN_PASSWORD,
  checkEmail,
  checkFirstName,
  checkPassword,
  explainAuthError,
  onlyErrors,
  safeNext,
  type FieldErrors,
} from '../lib/authForm'
import { supabase } from '../lib/supabase'

export function SignUp() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found = onlyErrors({
      firstName: checkFirstName(firstName),
      email: checkEmail(email),
      password: checkPassword(password, { isNew: true }),
    })
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Used as "you" in the travellers of every new trip.
        data: { first_name: firstName.trim() },
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    })
    setBusy(false)
    if (error) {
      const { field, message } = explainAuthError(error)
      if (field) setErrors({ [field]: message })
      else setFormError(message)
      return
    }
    // With email confirmation on, there is no session yet: the link in the email signs them in.
    if (data.session) navigate(next, { replace: true })
    else setSentTo(email.trim())
  }

  if (sentTo) return <CheckInbox email={sentTo} next={next} />

  return (
    <AuthSheet title="Create your account" intro="Plan the trip, and know what it really costs." drawing="welcome">
      <form onSubmit={submit} noValidate className="form">
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <SketchBox tape="mustard" className="form__sheet">
          <TextField
            field="firstName"
            label="Your first name"
            type="text"
            value={firstName}
            onChange={setFirstName}
            errors={errors}
            autoComplete="given-name"
            hint="Your travel partners will see it."
            autoFocus
          />
          <TextField
            field="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            errors={errors}
            autoComplete="email"
          />
          <TextField
            field="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            errors={errors}
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters.`}
          />
        </SketchBox>
        <SubmitButton busy={busy} label="Create account" busyLabel="Creating your account…" />
      </form>
      <p className="auth__switch">
        Already have an account?{' '}
        <Link to={`/sign-in${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link>
      </p>
    </AuthSheet>
  )
}

function CheckInbox({ email, next }: { email: string; next: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function resend() {
    setState('sending')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    })
    setState(error ? 'error' : 'sent')
  }

  return (
    <AuthSheet
      title="Check your inbox"
      intro={
        <>
          We sent a link to <strong>{email}</strong>. Open it to confirm your email, and you’re in.
        </>
      }
    >
      <SketchBox tape="green" className="form__sheet">
        <p className="field__hint">
          Nothing after a few minutes? Look in your spam, or{' '}
          <button type="button" className="link-button" onClick={resend} disabled={state === 'sending'}>
            {state === 'sending' ? 'sending…' : 'send the link again'}
          </button>
          .
        </p>
        {state === 'sent' && <FormMessage tone="info">A new link is on its way.</FormMessage>}
        {state === 'error' && (
          <FormMessage tone="error">Couldn’t send it. Wait a few minutes, then try again.</FormMessage>
        )}
      </SketchBox>
      <p className="auth__switch">
        <Link to="/sign-up" reloadDocument>
          Use another email
        </Link>
      </p>
    </AuthSheet>
  )
}
