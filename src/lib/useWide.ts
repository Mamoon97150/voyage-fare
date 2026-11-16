// Computer or phone (build 8½, mockup desktop-v6): from 760 px wide the trip shows in columns (three
// from 1180 px). Without a window (tests) it's the phone layout.
import { useEffect, useState } from 'react'

export const WIDE = '(min-width: 760px)'

export function useWide(query = WIDE): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return wide
}
