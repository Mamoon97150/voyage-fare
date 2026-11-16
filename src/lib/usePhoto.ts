// An option's photo (build 9): the link's picture as it is, or your own photo through a
// short-lived address (the trip's files are private). Addresses are kept for 50 minutes.
import { useEffect, useState } from 'react'
import { photoUrls, type TripOption } from './trips'

const known = new Map<string, { url: string; until: number }>()

export function usePhoto(option: Pick<TripOption, 'photo_url' | 'photo_path'> | null | undefined): string | null {
  const path = option?.photo_path ?? null
  const [own, setOwn] = useState<{ path: string; url: string } | null>(null)
  const cached = path ? known.get(path)?.url : undefined

  useEffect(() => {
    if (!path) return
    if ((known.get(path)?.until ?? 0) > Date.now()) return
    let live = true
    photoUrls([path])
      .then((found) => {
        const u = found?.[path]
        if (!u) return
        known.set(path, { url: u, until: Date.now() + 50 * 60 * 1000 })
        if (live) setOwn({ path, url: u })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [path])

  if (path) return (own?.path === path ? own.url : cached) ?? option?.photo_url ?? null
  return option?.photo_url ?? null
}
