import { useInstallCard, useOnline } from '../lib/pwa'
import { Sketch, SketchBox } from './Sketch'

/*
 * The app on the phone (build 7 step 5, mockup pwa-v5, 15 Nov): "Keep it on your phone",
 * the "Offline" note, and the page shown when there's no connection at all.
 */

/**
 * At the top of Your trips, once there's a trip, in the browser only. Android: one button.
 * iPhone: the two steps in Safari (Apple allows no button). "Not now" hides it for a month.
 */
export function InstallCard() {
  const { card, notNow, install } = useInstallCard()
  if (!card) return null
  return (
    <SketchBox tape="mustard" className="install-card" seed={21}>
      <span className="app-icon" aria-hidden="true">
        <img src="/illustrations/compass.svg" alt="" />
      </span>
      <span>
        <h2 className="install-card__title">Keep it on your phone</h2>
        <p className="install-card__lead">
          One tap from your home screen, full screen, like an app. Free, nothing to download from a store.
        </p>
      </span>
      {card === 'ios' && (
        <div className="install-card__ios">
          <b>On iPhone:</b>
          <ol>
            <li>
              tap{' '}
              <span className="install-card__sym" aria-label="the Share button">
                ⬆
              </span>{' '}
              Share at the bottom of Safari,
            </li>
            <li>
              then <b>Add to Home Screen</b>.
            </li>
          </ol>
        </div>
      )}
      <div className="install-card__actions">
        <button type="button" className="button button--quiet" onClick={notNow}>
          Not now
        </button>
        {card === 'button' && (
          <button type="button" className="button button--primary" onClick={() => void install()}>
            Add to home screen
          </button>
        )}
      </div>
    </SketchBox>
  )
}

/** Lost the connection: what's on screen stays, a note says changes have to wait. */
export function OfflineStrip() {
  const online = useOnline()
  if (online) return null
  return (
    <p className="offline-strip" role="status">
      <b>● Offline.</b> You’re seeing what was loaded last. Changes need a connection.
    </p>
  )
}

/** Opened with no connection at all: say so, and try again, instead of an empty page. */
export function NoConnection({ onRetry }: { onRetry: () => void }) {
  return (
    <SketchBox weight="light" className="empty no-connection">
      <Sketch name="no-trips" width={200} />
      <h2 className="empty__title">No connection</h2>
      <p className="empty__lead">
        Your trips need the internet to open. They’ll be here as soon as you’re back online.
      </p>
      <button type="button" className="button button--primary" onClick={onRetry}>
        Try again
      </button>
    </SketchBox>
  )
}
