import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthSheet, FormMessage, SubmitButton, TextField } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { MIN_PASSWORD, checkPassword, explainAuthError, onlyErrors, type FieldErrors } from '../lib/authForm'
import { supabase } from '../lib/supabase'

/** Reached from the "choose a new password" email: the link signs the person in for this. */
export function ResetPassword() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (session === undefined) return <Loading />

  if (session === null) {
    return (
      <AuthSheet title="This link has expired" intro="Reset links work once, for a short time. Ask for a new one.">
        <p className="auth__switch">
          <Link to="/forgot-password">Send me a new link</Link>
        </p>
      </AuthSheet>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found = onlyErrors({ password: checkPassword(password, { isNew: true }) })
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      const { field, message } = explainAuthError(error)
      if (field) setErrors({ [field]: message })
      else setFormError(message)
      return
    }
    navigate('/trips', { replace: true })
  }

  return (
    <AuthSheet title="Choose a new password">
      <form onSubmit={submit} noValidate className="form">
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <SketchBox tape="mustard" className="form__sheet">
          <TextField
            field="password"
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            errors={errors}
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters.`}
            autoFocus
          />
        </SketchBox>
        <SubmitButton busy={busy} label="Save the new password" busyLabel="Saving…" />
      </form>
    </AuthSheet>
  )
}
