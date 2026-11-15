import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/authContext'
import { useInstallCard } from '../lib/pwa'
import { SketchBox } from './Sketch'
import { DEMO_LINK, feedbackLink } from '../lib/site'
import { supabase } from '../lib/supabase'

/**
 * Your initial at the top right of "Your trips" (mockup menus-v5, 15 Nov): your trips, the demo,
 * feedback, the app on your phone, your account, privacy, sign out.
 */
export function AccountMenu() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { canInstall, install, card, showAgain } = useInstallCard()
  const firstName = (session?.user.user_metadata?.first_name as string | undefined) ?? session?.user.email ?? ''
  const email = session?.user.email ?? ''

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    // The session listener sends the person back to sign in.
  }

  function putOnPhone() {
    setOpen(false)
    // Android offers its own button; on an iPhone, the card on Your trips shows the two steps.
    if (card === 'button') void install()
    else {
      showAgain()
      navigate('/trips')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const close = () => setOpen(false)
  return (
    <div className="account-menu" ref={box}>
      <button
        type="button"
        className="avatar avatar--me account-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Your account (${firstName})`}
        onClick={() => setOpen((o) => !o)}
      >
        {firstName.slice(0, 1).toUpperCase()}
      </button>
      {open && <div className="account-menu__scrim" aria-hidden="true" onClick={close} />}
      {open && (
        <div className="account-menu__list" role="menu">
          <SketchBox className="account-menu__sheet" seed={33}>
            <p className="account-menu__who">
              <b>{firstName}</b>
              {email && email !== firstName && <span>{email}</span>}
            </p>
            <Link to="/trips" role="menuitem" className="account-menu__item" onClick={close}>
              <Icon>▤</Icon>Your trips
            </Link>
            <Link to={DEMO_LINK} role="menuitem" className="account-menu__item" onClick={close}>
              <Icon>◎</Icon>See the demo
            </Link>
            <a
              href={feedbackLink(window.location.origin + location.pathname)}
              role="menuitem"
              className="account-menu__item"
              onClick={close}
            >
              <Icon>✎</Icon>Send feedback
            </a>
            {canInstall && (
              <button type="button" role="menuitem" className="account-menu__item" onClick={putOnPhone}>
                <Icon>⬇</Icon>Put it on my phone
              </button>
            )}
            <hr className="account-menu__rule" />
            <Link to="/account" role="menuitem" className="account-menu__item" onClick={close}>
              <Icon>⚙</Icon>Your account
            </Link>
            <Link to="/privacy" role="menuitem" className="account-menu__item" onClick={close}>
              <Icon>§</Icon>Privacy
            </Link>
            <button
              type="button"
              role="menuitem"
              className="account-menu__item account-menu__item--quiet"
              onClick={signOut}
              disabled={busy}
            >
              <Icon>↩</Icon>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </SketchBox>
        </div>
      )}
    </div>
  )
}

/** A small mark before each line (placeholders until the drawn icons, build 8). */
function Icon({ children }: { children: string }) {
  return (
    <i className="account-menu__icon" aria-hidden="true">
      {children}
    </i>
  )
}
