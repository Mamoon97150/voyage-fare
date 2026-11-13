import { useState } from 'react'
import { Logo } from '../components/Logo'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'

/** "Your trips". For now: who is signed in, and a way out. The list comes with the trip view. */
export function Trips() {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    // The session listener sends the person back to sign in.
  }

  return (
    <div className="page">
      <header className="app-header">
        <Logo />
        <span className="app-header__name">Voyage Fare</span>
        <span className="app-header__account">
          <span className="app-header__email">{session?.user.email}</span>
          <button type="button" className="button button--quiet" onClick={signOut} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </span>
      </header>
      <main className="hero">
        <h1>Your trips</h1>
        <p>No trips yet. Creating a trip comes next.</p>
      </main>
    </div>
  )
}
