import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/authContext'
import { CONTACT, DEMO_LINK, STORY_LINK } from '../lib/site'
import { SketchBox } from './Sketch'

/*
 * The public pages' bar, menu and footer (mockup menus-v5, 15 Nov): the welcome page and Privacy.
 * Phone: compass + name, "Try the demo", ☰. Computer: the links sit in the bar.
 */

const LINKS = [
  { to: '/#how', label: 'How it works' },
  { to: DEMO_LINK, label: 'See a real trip', note: 'the demo, no sign-up' },
] as const

function Story({ onClick }: { onClick?: () => void }) {
  return STORY_LINK ? (
    <a href={STORY_LINK} onClick={onClick}>
      The story behind it
    </a>
  ) : (
    <span className="site-link--soon">
      The story behind it <span className="hand">soon</span>
    </span>
  )
}

export function SiteBar() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    sheet.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <header className="site-bar">
        <Link to="/" className="site-bar__brand" onClick={() => window.scrollTo({ top: 0 })}>
          <img src="/illustrations/compass.svg" width={26} height={26} alt="" />
          <span>Voyage Fare</span>
        </Link>
        <nav className="site-bar__links" aria-label="Voyage Fare">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
          {STORY_LINK && <a href={STORY_LINK}>The story</a>}
        </nav>
        <span className="site-bar__acts">
          {session ? (
            <Link to="/trips" className="pill pill--dark">
              Your trips ›
            </Link>
          ) : (
            <>
              <Link to={DEMO_LINK} className="pill site-bar__demo">
                Try the demo
              </Link>
              <Link to="/sign-in" className="site-bar__signin">
                Sign in
              </Link>
              <Link to="/sign-up" className="pill pill--dark site-bar__join">
                Create my notebook
              </Link>
            </>
          )}
          <button
            type="button"
            className="site-bar__burger"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close the menu' : 'Menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '✕' : '☰'}
          </button>
        </span>
      </header>
      {open && (
        <>
          <div className="site-menu__scrim" onClick={close} aria-hidden="true" />
          <div id="site-menu" className="site-menu" ref={sheet}>
            <SketchBox tape="mustard" className="site-menu__sheet" seed={31}>
              <ul>
                {LINKS.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} onClick={close}>
                      {l.label}
                      <small>{'note' in l ? l.note : '›'}</small>
                    </Link>
                  </li>
                ))}
                <li>
                  <Story onClick={close} />
                </li>
                <li>
                  <a href={`mailto:${CONTACT}`} onClick={close}>
                    Contact <small>{CONTACT}</small>
                  </a>
                </li>
              </ul>
              <div className="site-menu__acts">
                {session ? (
                  <Link to="/trips" className="button button--primary button--wide" onClick={close}>
                    Your trips ›
                  </Link>
                ) : (
                  <>
                    <Link to="/sign-up" className="button button--primary button--wide" onClick={close}>
                      Create my notebook
                    </Link>
                    <Link to="/sign-in" className="button button--quiet button--wide" onClick={close}>
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </SketchBox>
          </div>
        </>
      )}
    </>
  )
}

export function SiteFooter() {
  const { session } = useAuth()
  return (
    <footer className="site-foot">
      <Link to="/" className="site-foot__brand">
        <img src="/illustrations/compass.svg" width={24} height={24} alt="" />
        Voyage Fare
      </Link>
      <div className="site-foot__cols">
        <nav aria-label="The app">
          <p>The app</p>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
          {session ? (
            <Link to="/trips">Your trips</Link>
          ) : (
            <>
              <Link to="/sign-up">Create my notebook</Link>
              <Link to="/sign-in">Sign in</Link>
            </>
          )}
        </nav>
        <nav aria-label="About">
          <p>About</p>
          <Story />
          <a href={`mailto:${CONTACT}`}>Contact</a>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </div>
      <p className="site-foot__made">Made by Djamina, for trips with her sisters.</p>
      <p className="site-foot__small">© 2026 Voyage Fare · Made in Saint-Martin</p>
    </footer>
  )
}
