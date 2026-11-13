import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Field, FieldErrors } from '../lib/authForm'
import { Logo } from './Logo'

/** One notebook sheet in the middle of the paper, for every account page. */
export function AuthSheet({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="auth">
      <Link to="/" className="auth__brand">
        <Logo size={28} />
        <span>Voyage Fare</span>
      </Link>
      <main className="sheet auth__sheet">
        <h1 className="auth__title">{title}</h1>
        {intro && <p className="auth__intro">{intro}</p>}
        {children}
      </main>
    </div>
  )
}

type InputProps = {
  field: Field
  label: string
  type: 'email' | 'password'
  value: string
  onChange: (value: string) => void
  errors: FieldErrors
  autoComplete: string
  hint?: string
  autoFocus?: boolean
}

export function TextField({ field, label, type, value, onChange, errors, autoComplete, hint, autoFocus }: InputProps) {
  const id = `field-${field}`
  const error = errors[field]
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <input
        id={id}
        name={field}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field__input"
      />
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
    <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy || undefined}>
      {busy ? busyLabel : label}
    </button>
  )
}
