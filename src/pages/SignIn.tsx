import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthSheet, FormMessage, SubmitButton, TextField } from '../components/AuthForm'
import { checkEmail, checkPassword, explainAuthError, onlyErrors, safeNext, type FieldErrors } from '../lib/authForm'
import { supabase } from '../lib/supabase'

export function SignIn() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found = onlyErrors({
      email: checkEmail(email),
      password: checkPassword(password, { isNew: false }),
    })
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      const { field, message } = explainAuthError(error)
      if (field) setErrors({ [field]: message })
      else setFormError(message)
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <AuthSheet title="Sign in" intro="Welcome back. Your trips are where you left them.">
      <form onSubmit={submit} noValidate className="form">
        {params.get('reset') === 'done' && (
          <FormMessage tone="info">Your password is changed. Sign in with the new one.</FormMessage>
        )}
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
          autoComplete="current-password"
        />
        <p className="form__aside">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <SubmitButton busy={busy} label="Sign in" busyLabel="Signing in…" />
      </form>
      <p className="auth__switch">
        New here? <Link to={`/sign-up${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
      </p>
    </AuthSheet>
  )
}
