import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { AuthContext, useAuth, type AuthState } from './authContext'
import { safeNext } from './authForm'
import { supabase } from './supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: undefined })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session }))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

/** A calm placeholder while the session is being read: never flash the wrong page. */
export function Loading() {
  return (
    <p className="loading" role="status">
      Opening your notebook…
    </p>
  )
}

/** Pages that need an account. Signed out → sign in, then come back here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (session === undefined) return <Loading />
  if (session === null) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?next=${next}`} replace />
  }
  return children
}

/**
 * Sign in / create account: already signed in → the page asked for, else the trips.
 * This also runs the instant sign-in succeeds, so it must honour "next" too (it used to win
 * the race and always land on Your trips).
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (session === undefined) return <Loading />
  if (session) return <Navigate to={safeNext(new URLSearchParams(location.search).get('next'))} replace />
  return children
}
