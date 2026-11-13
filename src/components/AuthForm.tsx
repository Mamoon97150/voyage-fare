import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Field, FieldErrors } from '../lib/authForm'
import { Sketch, Underlined, type Drawing } from './Sketch'

/** The account pages: the compass, a drawing, the title, then the form (mockup 6, look B). */
export function AuthSheet({
  title,
  intro,
  drawing,
  children,
}: {
  title: string
  intro?: ReactNode
  drawing?: Drawing
  children: ReactNode
}) {
  return (
    <div className="auth">
      <Link to="/" className="auth__brand">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span>Voyage Fare</span>
      </Link>
      <main className="auth__page">
        {drawing && <Sketch name={drawing} width={330} />}
        <h1 className="auth__title">
          <Underlined>{title}</Underlined>
        </h1>
        {intro && <p className="auth__intro">{intro}</p>}
        {children}
      </main>
    </div>
  )
}

type InputProps = {
  field: Field
  label: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  errors: FieldErrors
  autoComplete: string
  hint?: string
  autoFocus?: boolean
}

export function TextField({ field, label, type, value, onChange, errors, autoComplete, hint, autoFocus }: InputProps) {
  const [shown, setShown] = useState(false)
  const id = `field-${field}`
  const error = errors[field]
  const describedBy = [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const isPassword = type === 'password'
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="field__box">
        <input
          id={id}
          name={field}
          type={isPassword && shown ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize={type === 'text' ? 'words' : 'off'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="field__input"
        />
        {isPassword && (
          <button
            type="button"
            className="field__show"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={shown ? 'Hide password' : 'Show password'}
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

/** A message about the whole form (not one field). */
export function FormMessage({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p className={`form-message form-message--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button type="submit" className="button button--primary button--wide" disabled={busy} aria-busy={busy || undefined}>
      {busy ? busyLabel : label}
    </button>
  )
}
