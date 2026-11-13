import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'

/** Your initial at the top right of "Your trips" (mockup 5): opens your account, or signs you out. */
export function AccountMenu() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const firstName = (session?.user.user_metadata?.first_name as string | undefined) ?? session?.user.email ?? ''

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    // The session listener sends the person back to sign in.
  }

  return (
    <div className="account-menu" ref={box}>
      <button
        type="button"
        className="avatar avatar--me account-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Your account (${firstName})`}
        onClick={() => setOpen((o) => !o)}
      >
        {firstName.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="account-menu__list" role="menu">
          <p className="account-menu__who">{firstName}</p>
          <Link to="/account" role="menuitem" className="account-menu__item" onClick={() => setOpen(false)}>
            Your account
          </Link>
          <button type="button" role="menuitem" className="account-menu__item" onClick={signOut} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
