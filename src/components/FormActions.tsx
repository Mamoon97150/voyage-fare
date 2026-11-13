import { useState } from 'react'
import { explainAuthError } from '../lib/authForm'
import { FormMessage } from './AuthForm'

/**
 * Cancel and save, and on an existing thing a delete that asks once ("Yes, delete Casa Lola").
 * The delete can't be undone, so it says what goes with it.
 */
export function FormActions({
  busy,
  submitLabel,
  onCancel,
  onDelete,
  deleteName,
  deleteNote,
}: {
  busy: boolean
  submitLabel: string
  onCancel: () => void
  onDelete?: () => Promise<void>
  deleteName?: string
  deleteNote?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()

  async function remove() {
    if (!onDelete) return
    setDeleting(true)
    setError(undefined)
    try {
      await onDelete()
    } catch (e) {
      setDeleting(false)
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  if (confirming) {
    return (
      <div className="confirm-delete" role="group" aria-label="Delete">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <p className="field__hint">{deleteNote ?? 'This can’t be undone.'}</p>
        <div className="add-item__actions">
          <button type="button" className="button button--quiet" onClick={() => setConfirming(false)} disabled={deleting}>
            Keep it
          </button>
          <button type="button" className="button button--danger" onClick={remove} disabled={deleting} aria-busy={deleting || undefined}>
            {deleting ? 'Deleting…' : `Yes, delete ${deleteName ?? 'it'}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="add-item__actions">
      {onDelete && (
        <button type="button" className="link-button add-item__delete" onClick={() => setConfirming(true)} disabled={busy}>
          Delete
        </button>
      )}
      <button type="button" className="button button--quiet" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </div>
  )
}
