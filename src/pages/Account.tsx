import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { FormMessage, TextField } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { useAuth } from '../lib/authContext'
import {
  MIN_PASSWORD,
  checkFirstName,
  checkPassword,
  explainAuthError,
  onlyErrors,
  type FieldErrors,
} from '../lib/authForm'
import { supabase } from '../lib/supabase'

/**
 * Your account (mockup 9), with what works today: your first name, your email, a new password,
 * sign out. Deleting the account and defaults for new trips come with their database rules.
 */
export function Account() {
  const { session } = useAuth()
  const user = session?.user
  const [firstName, setFirstName] = useState((user?.user_metadata?.first_name as string | undefined) ?? '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string }>()
  const [busy, setBusy] = useState<'name' | 'password' | 'out' | null>(null)

  async function saveName(event: FormEvent) {
    event.preventDefault()
    setMessage(undefined)
    const found = onlyErrors({ firstName: checkFirstName(firstName) })
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy('name')
    const { error } = await supabase.auth.updateUser({ data: { first_name: firstName.trim() } })
    setBusy(null)
    setMessage(
      error
        ? { tone: 'error', text: explainAuthError(error).message }
        : { tone: 'info', text: 'Saved. New trips will use this name for you.' },
    )
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    setMessage(undefined)
    const found = onlyErrors({ password: checkPassword(password, { isNew: true }) })
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy('password')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(null)
    if (error) {
      const { field, message: text } = explainAuthError(error)
      if (field) setErrors({ [field]: text })
      else setMessage({ tone: 'error', text })
      return
    }
    setPassword('')
    setMessage({ tone: 'info', text: 'Your password is changed.' })
  }

  async function signOut() {
    setBusy('out')
    await supabase.auth.signOut()
  }

  return (
    <div className="screen">
      <header className="screen__top">
        <Link to="/trips" className="round-button" aria-label="Your trips">
          ‹
        </Link>
        <h1 className="screen__title">Your account</h1>
      </header>
      <div className="screen__body">
        {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}

        <SketchBox weight="light" className="form__sheet" seed={51}>
          <form onSubmit={saveName} noValidate className="account__form">
            <TextField
              field="firstName"
              label="First name"
              type="text"
              value={firstName}
              onChange={setFirstName}
              errors={errors}
              autoComplete="given-name"
              hint="You, in every new trip. Your travel partners see it."
            />
            <button type="submit" className="button button--quiet" disabled={busy !== null}>
              {busy === 'name' ? 'Saving…' : 'Save'}
            </button>
          </form>
          <div className="kv">
            <span>Email</span>
            <b>{user?.email}</b>
          </div>
        </SketchBox>

        <SketchBox weight="light" className="form__sheet" seed={52}>
          <form onSubmit={savePassword} noValidate className="account__form">
            <TextField
              field="password"
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              errors={errors}
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD} characters.`}
            />
            <button type="submit" className="button button--quiet" disabled={busy !== null}>
              {busy === 'password' ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </SketchBox>

        <button type="button" className="button button--quiet button--wide" onClick={signOut} disabled={busy !== null}>
          {busy === 'out' ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
