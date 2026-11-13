import { useState } from 'react'
import { Sketch, SketchBox } from '../components/Sketch'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'

/** "Your trips". For now: the empty state, who is signed in, and a way out. The list comes with the trip view. */
export function Trips() {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const firstName = session?.user.user_metadata?.first_name as string | undefined

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    // The session listener sends the person back to sign in.
  }

  return (
    <div className="page">
      <header className="app-header">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span className="app-header__name">Voyage Fare</span>
        <span className="app-header__account">
          <span className="app-header__email">{firstName ?? session?.user.email}</span>
          <button type="button" className="button button--quiet" onClick={signOut} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </span>
      </header>
      <main className="trips">
        <h1 className="trips__title">Your trips</h1>
        <SketchBox tape="green" className="empty">
          <Sketch name="no-trips" width={240} />
          <h2 className="empty__title">No trips yet</h2>
          <p className="hand empty__note">the first page is the hardest</p>
          <p className="field__hint">Creating a trip comes next.</p>
        </SketchBox>
      </main>
    </div>
  )
}
