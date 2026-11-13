import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthSheet, FormMessage, SubmitButton, TextField } from '../components/AuthForm'
import {
  MIN_PASSWORD,
  checkConfirm,
  checkEmail,
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found = onlyErrors({
      email: checkEmail(email),
      password: checkPassword(password, { isNew: true }),
      confirm: checkConfirm(password, confirm),
    })
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
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

  if (sentTo) {
    return (
      <AuthSheet title="Check your inbox">
        <p className="auth__intro">
          We sent a link to <strong>{sentTo}</strong>. Open it to confirm your email, and you’re in.
        </p>
        <p className="auth__switch">
          Nothing after a few minutes? Look in your spam, or <Link to="/sign-up">try another address</Link>.
        </p>
      </AuthSheet>
    )
  }

  return (
    <AuthSheet title="Create your account" intro="Plan the trip, and know what it really costs.">
      <form onSubmit={submit} noValidate className="form">
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <TextField
          field="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          errors={errors}
          autoComplete="email"
          autoFocus
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
        <TextField
          field="confirm"
          label="Password again"
          type="password"
          value={confirm}
          onChange={setConfirm}
          errors={errors}
          autoComplete="new-password"
        />
        <SubmitButton busy={busy} label="Create account" busyLabel="Creating your account…" />
      </form>
      <p className="auth__switch">
        Already have an account? <Link to={`/sign-in${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link>
      </p>
    </AuthSheet>
  )
}
