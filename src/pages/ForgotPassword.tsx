import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AuthSheet, FormMessage, SubmitButton, TextField } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { checkEmail, explainAuthError, onlyErrors, type FieldErrors } from '../lib/authForm'
import { supabase } from '../lib/supabase'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found = onlyErrors({ email: checkEmail(email) })
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) {
      const { field, message } = explainAuthError(error)
      if (field) setErrors({ [field]: message })
      else setFormError(message)
      return
    }
    setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <AuthSheet
        title="Check your inbox"
        // Same answer whether the account exists or not: nobody can test which emails are signed up.
        intro={
          <>
            If an account exists for <strong>{sentTo}</strong>, we sent it a link to choose a new password.
          </>
        }
      >
        <p className="auth__switch">
          <Link to="/sign-in">Back to sign in</Link>
        </p>
      </AuthSheet>
    )
  }

  return (
    <AuthSheet title="Forgot your password?" intro="Enter your email and we’ll send you a link to choose a new one.">
      <form onSubmit={submit} noValidate className="form">
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <SketchBox tape="mustard" className="form__sheet">
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
        </SketchBox>
        <SubmitButton busy={busy} label="Send the link" busyLabel="Sending…" />
      </form>
      <p className="auth__switch">
        <Link to="/sign-in">Back to sign in</Link>
      </p>
    </AuthSheet>
  )
}
