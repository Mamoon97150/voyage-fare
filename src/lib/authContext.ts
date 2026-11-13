import type { Session } from '@supabase/supabase-js'
import { createContext, use } from 'react'

export type AuthState = {
  /** undefined while we don't know yet, null when signed out. */
  session: Session | null | undefined
}

export const AuthContext = createContext<AuthState>({ session: undefined })

export function useAuth() {
  return use(AuthContext)
}
