import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FormMessage } from '../AuthForm'
import { SketchBox } from '../Sketch'
import { explainAuthError } from '../../lib/authForm'
import { addTraveller, cancelInvitation, inviteTraveller, joinLink, listOpenInvitations, removeTraveller, renameTraveller, type Invitation, type Traveller, type TripDetail } from '../../lib/trips'
import { sentAgo } from '../../lib/tripText'

/** Each traveller has their own share. Rename, add, or remove (when it's safe). */
export function Travellers({
  detail,
  userId,
  owner,
  onChanged,
}: {
  detail: TripDetail
  userId?: string
  owner: boolean
  onChanged: () => void
}) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [invites, setInvites] = useState<Invitation[]>([])
  const travellers = detail.travellers
  const tripId = detail.trip.id
  const canInvite = !detail.trip.is_demo

  const loadInvites = useCallback(() => {
    listOpenInvitations(tripId)
      .then(setInvites)
      .catch(() => setInvites([]))
  }, [tripId])
  useEffect(() => {
    let active = true
    listOpenInvitations(tripId)
      .then((list) => active && setInvites(list))
      .catch(() => active && setInvites([]))
    return () => {
      active = false
    }
  }, [tripId, travellers.length])

  async function add(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    if (!newName.trim()) {
      setError('Type a name first.')
      return
    }
    setBusy(true)
    try {
      await addTraveller(detail.trip.id, newName.trim(), Math.max(0, ...travellers.map((t) => t.position)) + 1)
      setNewName('')
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <SketchBox weight="strong" tape="green" className="form__sheet settings__travellers" seed={73}>
      <h2 className="sheet-title">
        Travellers <small className="sheet-title__note hand-note">each has their own share</small>
      </h2>
      <ul className="people">
        {travellers.map((t) => (
          <TravellerRow
            key={t.id}
            traveller={t}
            isYou={Boolean(t.user_id && t.user_id === userId)}
            isCreator={Boolean(t.user_id && t.user_id === detail.trip.created_by)}
            amOwner={owner}
            canInvite={canInvite && travellers.length > 1}
            invite={invites.find((i) => i.traveller_id === t.id)}
            onChanged={onChanged}
            onInvitesChanged={loadInvites}
          />
        ))}
      </ul>
      <form onSubmit={add} noValidate className="settings__add">
        <label htmlFor="settings-new-traveller" className="visually-hidden">
          New traveller
        </label>
        <input
          id="settings-new-traveller"
          className="field__input"
          placeholder="Add someone: Dana"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="button button--quiet" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </SketchBox>
    {canInvite && travellers.length > 1 && (
      <p className="settings__margin-note">No need to invite everyone: a name is enough to count their share.</p>
    )}
    </>
  )
}

function TravellerRow({
  traveller,
  isYou,
  isCreator,
  amOwner,
  canInvite,
  invite,
  onChanged,
  onInvitesChanged,
}: {
  traveller: Traveller
  isYou: boolean
  isCreator: boolean
  amOwner: boolean
  canInvite: boolean
  invite?: Invitation
  onChanged: () => void
  onInvitesChanged: () => void
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'remove'>('view')
  const [showLink, setShowLink] = useState(false)
  const onTrip = Boolean(traveller.user_id)
  // Someone who opens the trip with their own account: only the creator removes them.
  const removable = !isYou && (!onTrip || amOwner)
  const [name, setName] = useState(traveller.name)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      setMode('view')
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="people__row">
      <div className="people__line">
        <span className={`avatar${isYou ? ' avatar--me' : ''}`} aria-hidden="true">
          {traveller.name.slice(0, 1).toUpperCase()}
        </span>
        {mode === 'rename' ? (
          <form
            className="settings__rename"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) void run(() => renameTraveller(traveller.id, name.trim()))
            }}
          >
            <input
              className="field__input people__input"
              aria-label={`New name for ${traveller.name}`}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="button button--quiet" disabled={busy}>
              Save
            </button>
          </form>
        ) : (
          <span className="people__name">
            <b>{traveller.name}</b>
            <TravellerState isYou={isYou} isCreator={isCreator} onTrip={onTrip} invite={invite} canInvite={canInvite} />
          </span>
        )}
        {mode === 'view' && (
          <>
            <button type="button" className="place__edit" onClick={() => setMode('rename')} aria-label={`Rename ${traveller.name}`}>
              Rename
            </button>
            {removable && (
              <button
                type="button"
                className="people__remove"
                onClick={() => setMode('remove')}
                aria-label={`Remove ${traveller.name}`}
              >
                ✕
              </button>
            )}
          </>
        )}
        {mode === 'rename' && (
          <button type="button" className="place__edit" onClick={() => setMode('view')}>
            Cancel
          </button>
        )}
      </div>
      {mode === 'view' && canInvite && !onTrip && (
        <InviteActions
          traveller={traveller}
          invite={invite}
          open={showLink}
          onOpen={setShowLink}
          onInvitesChanged={onInvitesChanged}
        />
      )}
      {mode === 'remove' && (
        <div className="confirm-delete">
          <p className="field__hint">
            Their share is spread over the others.{onTrip ? ` ${traveller.name} won’t see the trip any more.` : ''}
          </p>
          <div className="add-item__actions">
            <button type="button" className="button button--quiet" onClick={() => setMode('view')} disabled={busy}>
              Keep {traveller.name}
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void run(() => removeTraveller(traveller.id))}
              disabled={busy}
            >
              {busy ? 'Removing…' : `Yes, remove ${traveller.name}`}
            </button>
          </div>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </li>
  )
}

/** Where a traveller stands: small caps for the status, handwriting for the detail. */
function TravellerState({
  isYou,
  isCreator,
  onTrip,
  invite,
  canInvite,
}: {
  isYou: boolean
  isCreator: boolean
  onTrip: boolean
  invite?: Invitation
  canInvite: boolean
}) {
  if (isYou) return <small className="people__state">{isCreator ? 'You · created the trip' : 'You'}</small>
  if (onTrip)
    return (
      <>
        <small className="people__state people__state--in">On the trip</small>
        <span className="people__hand">opens it on their phone</span>
      </>
    )
  if (invite)
    return (
      <>
        <small className="people__state people__state--wait">Invited</small>
        <span className="people__hand">{sentAgo(invite.created_at)}, not opened yet</span>
      </>
    )
  if (!canInvite) return null
  return <small className="people__state">Not invited yet</small>
}

/** "Invite" opens the link right there; an invited name can get it again or cancel it. */
function InviteActions({
  traveller,
  invite,
  open,
  onOpen,
  onInvitesChanged,
}: {
  traveller: Traveller
  invite?: Invitation
  open: boolean
  onOpen: (open: boolean) => void
  onInvitesChanged: () => void
}) {
  const [link, setLink] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()

  async function getLink() {
    setBusy(true)
    setError(undefined)
    try {
      const { token } = await inviteTraveller(traveller.id)
      setLink(joinLink(token))
      onOpen(true)
      onInvitesChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    setError(undefined)
    try {
      await cancelInvitation(traveller.id)
      setLink(undefined)
      onOpen(false)
      onInvitesChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!link) return
    const text = `Join our trip on Voyage Fare: you’re ${traveller.name} on it.`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Voyage Fare', text, url: link })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await copy()
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Couldn’t copy it: select the link and copy it by hand.')
    }
  }

  return (
    <div className="invite">
      {!open && (
        <div className="invite__buttons">
          {invite ? (
            <>
              <button type="button" className="button button--small" onClick={getLink} disabled={busy}>
                Send the link again
              </button>
              <button type="button" className="button button--small" onClick={cancel} disabled={busy}>
                Cancel the invite
              </button>
            </>
          ) : (
            <button type="button" className="button button--small invite__open" onClick={getLink} disabled={busy}>
              {busy ? 'Making the link…' : 'Invite'}
            </button>
          )}
        </div>
      )}
      {open && link && (
        <div className="invite__box">
          <p>
            Send {traveller.name} this link. When they open it and sign in, they join the trip{' '}
            <b>as {traveller.name}</b>, and see their own share.
          </p>
          <input
            className="invite__link"
            readOnly
            value={link}
            aria-label={`Link for ${traveller.name}`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="invite__row">
            <button type="button" className="button button--primary" onClick={share}>
              Share…
            </button>
            <button type="button" className="button button--quiet" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <span className="invite__arrow">↑ WhatsApp, Messages, mail…</span>
          <p className="people__hand">works once · for 14 days · you can cancel it</p>
          <div className="invite__buttons">
            <button type="button" className="link-button" onClick={() => onOpen(false)}>
              Done
            </button>
            <span aria-hidden="true"> · </span>
            <button type="button" className="link-button" onClick={cancel} disabled={busy}>
              Cancel the invite
            </button>
          </div>
        </div>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  )
}
