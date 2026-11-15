import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FormMessage, TextField } from '../components/AuthForm'
import { SketchBox } from '../components/Sketch'
import { useAuth } from '../lib/authContext'
import {
  MIN_PASSWORD,
  checkEmail,
  checkFirstName,
  checkPassword,
  explainAuthError,
  onlyErrors,
  type FieldErrors,
} from '../lib/authForm'
import { supabase } from '../lib/supabase'

/**
 * Your account (mockup 9): your first name, your email (and changing it), a new password, sign
 * out, and deleting the account (sign-in polish, 15 Nov).
 */
export function Account() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const user = session?.user
  const [firstName, setFirstName] = useState((user?.user_metadata?.first_name as string | undefined) ?? '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string }>()
  const [busy, setBusy] = useState<'name' | 'password' | 'email' | 'delete' | 'out' | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  // Supabase sends a link to the new address; the change happens when it's opened.
  async function saveEmail(event: FormEvent) {
    event.preventDefault()
    setMessage(undefined)
    const found = onlyErrors({ email: checkEmail(newEmail) })
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy('email')
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/account` },
    )
    setBusy(null)
    if (error) {
      const { field, message: text } = explainAuthError(error)
      if (field) setErrors({ [field]: text })
      else setMessage({ tone: 'error', text })
      return
    }
    setChangingEmail(false)
    setMessage({
      tone: 'info',
      text: `We sent a link to ${newEmail.trim()}. Open it to finish the change; until then, keep signing in with ${user?.email}.`,
    })
    setNewEmail('')
  }

  async function deleteAccount() {
    setMessage(undefined)
    setBusy('delete')
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setBusy(null)
      setMessage({ tone: 'error', text: explainAuthError(error).message })
      return
    }
    // The account is gone: sign out on this device too; the session listener sends them home.
    await supabase.auth.signOut()
    navigate('/', { replace: true })
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
          {changingEmail ? (
            <form onSubmit={saveEmail} noValidate className="account__form">
              <TextField
                field="email"
                label="New email"
                type="email"
                value={newEmail}
                onChange={setNewEmail}
                errors={errors}
                autoComplete="email"
                hint="We send a link to the new address; the change happens when you open it."
                autoFocus
              />
              <div className="add-item__actions">
                <button type="button" className="button button--quiet" onClick={() => setChangingEmail(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button--primary" disabled={busy !== null}>
                  {busy === 'email' ? 'Sending…' : 'Send the link'}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="link-button account__change" onClick={() => setChangingEmail(true)}>
              Change my email
            </button>
          )}
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

        <SketchBox weight="light" className="form__sheet account__delete" seed={53}>
          <h2 className="account__title">Delete my account</h2>
          {confirmDelete ? (
            <div className="confirm-delete" role="group" aria-label="Delete my account">
              <p>
                <b>Delete your account for good?</b>
              </p>
              <ul>
                <li>The trips only you are on are deleted.</li>
                <li>
                  On shared trips, you become a name again: your share and what you paid stay, for the others. A trip
                  you created goes to the next person on it.
                </li>
              </ul>
              <p className="field__hint">This can’t be undone.</p>
              <div className="add-item__actions">
                <button type="button" className="button button--quiet" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={deleteAccount}
                  disabled={busy !== null}
                >
                  {busy === 'delete' ? 'Deleting…' : 'Yes, delete it'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button--quiet account__danger"
              onClick={() => setConfirmDelete(true)}
            >
              Delete my account…
            </button>
          )}
        </SketchBox>
      </div>
    </div>
  )
}
