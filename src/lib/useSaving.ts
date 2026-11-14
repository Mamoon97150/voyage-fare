import { useCallback, useState } from 'react'
import { explainAuthError } from './authForm'

/**
 * Saving something (code review, 14 Nov: this was written out 24 times). `busy` while it runs;
 * a failure becomes a readable message for the form to show, and the form keeps its own way
 * of showing it (a line under a field, a message at the top…).
 *
 *   const { busy, run } = useSaving()
 *   await run(() => addPlace(…), setError)
 */
export function useSaving() {
  const [busy, setBusy] = useState(false)
  const run = useCallback(async <T,>(action: () => Promise<T>, onError: (message: string) => void): Promise<T | undefined> => {
    setBusy(true)
    try {
      return await action()
    } catch (e) {
      onError(explainAuthError(e as { message?: string }).message)
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, run }
}
