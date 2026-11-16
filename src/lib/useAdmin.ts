// Is the person an admin, and how many new messages wait (checked by the database: am_i_admin and
// admin_overview only answer admins). Null for everyone else: nothing admin shows.
import { useEffect, useState } from 'react'
import { adminOverview, amIAdmin } from './trips'

export function useAdmin(): { fresh: number } | null {
  const [admin, setAdmin] = useState<{ fresh: number } | null>(null)
  useEffect(() => {
    let active = true
    amIAdmin()
      .then(async (yes) => {
        if (!yes || !active) return
        const o = await adminOverview().catch(() => null)
        if (active) setAdmin({ fresh: o?.new_messages ?? 0 })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return admin
}
