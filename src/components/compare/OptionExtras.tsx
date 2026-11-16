import { useState } from 'react'
import { previewLink, type LinkPreview } from '../../lib/trips'
import { canPaste } from '../../lib/pwa'
import { FormMessage } from '../AuthForm'
import { GluedPhoto } from '../GluedPhoto'

/*
 * Paste a link → option (build 9, mockup maps-v6): the app reads what the page publishes for
 * previews and says what it found (✓) and what it didn't (?), so nothing is made up.
 */
export function LinkReader({
  id,
  link,
  onLink,
  onFound,
}: {
  id: string
  link: string
  onLink: (v: string) => void
  onFound: (found: LinkPreview) => void
}) {
  const [reading, setReading] = useState(false)
  const [found, setFound] = useState<LinkPreview | null>(null)
  const [error, setError] = useState<string>()

  async function read(url: string) {
    if (!/^https?:\/\//i.test(url.trim())) return
    setError(undefined)
    setReading(true)
    try {
      const f = await previewLink(url.trim())
      setFound(f)
      onLink(f.url)
      onFound(f)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReading(false)
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      const url = text.match(/https?:\/\/[^\s<>"]+/)?.[0]
      if (!url) return setError('No link copied yet.')
      onLink(url)
      void read(url)
    } catch {
      setError('The phone didn’t allow pasting: press and hold in the box, then Paste.')
    }
  }

  return (
    <div className="field link-reader">
      <label htmlFor={`${id}-link`} className="field__label">
        Paste a link <span className="field__optional">(optional)</span>
      </label>
      <div className="link-row">
        <input
          id={`${id}-link`}
          className="field__input"
          inputMode="url"
          placeholder="Booking, Airbnb, the hotel’s site…"
          value={link}
          onChange={(e) => {
            onLink(e.target.value)
            // Pasted whole: read it straight away.
            if (/^https?:\/\/\S+$/.test(e.target.value.trim()) && e.target.value.length - link.length > 8)
              void read(e.target.value)
          }}
        />
        {link.trim() ? (
          <button type="button" className="paste-button" onClick={() => void read(link)} disabled={reading}>
            Read it
          </button>
        ) : (
          canPaste() && (
            <button type="button" className="paste-button" onClick={() => void paste()}>
              <span aria-hidden="true">📋</span> Paste
            </button>
          )
        )}
      </div>
      {reading && (
        <p className="hand link-reader__reading" role="status">
          reading the page…
        </p>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {found && !reading && <FoundList found={found} />}
    </div>
  )
}

function FoundList({ found }: { found: LinkPreview }) {
  const rows: [boolean, string][] = [
    [Boolean(found.name), found.name ? 'the name' : 'the name: type it'],
    [Boolean(found.image), found.image ? 'a picture' : 'no picture on the page'],
    [
      found.latitude !== null,
      found.latitude !== null
        ? `where it is${found.place ? `: ${found.place}` : ''}, pinned`
        : 'where it is: search it below',
    ],
    [
      found.price !== null,
      found.price !== null
        ? `the price: ${found.price} ${found.currency}`
        : `the price: ${found.site ?? 'the site'} doesn’t show it to us, type it`,
    ],
  ]
  return (
    <div className="link-found" role="status">
      {found.image && <GluedPhoto src={found.image} label="from the link" className="link-found__photo" />}
      {found.refused && <p className="field__hint">The site didn’t let the app read it: type the details.</p>}
      <ul className="link-found__list">
        {rows.map(([ok, text]) => (
          <li key={text}>
            <span className={ok ? 'link-found__ok' : 'link-found__no'} aria-hidden="true">
              {ok ? '✓' : '?'}
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The option's photo: the link's picture or your own, to change or take away. */
export function PhotoPicker({
  id,
  shown,
  onFile,
  onRemove,
}: {
  id: string
  /** What shows now: your photo's address, or the link's picture. */
  shown: string | null
  onFile: (file: File) => void
  onRemove: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const src = preview ?? shown
  return (
    <div className="field photo-picker">
      <span className="field__label">
        Photo <span className="field__optional">(optional)</span>
      </span>
      {src && <GluedPhoto src={src} className="photo-picker__photo" />}
      <div className="photo-picker__actions">
        <label htmlFor={`${id}-photo`} className="link-button">
          {src ? 'Change the photo' : '+ Add a photo'}
        </label>
        <input
          id={`${id}-photo`}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setPreview(URL.createObjectURL(file))
            onFile(file)
          }}
        />
        {src && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setPreview(null)
              onRemove()
            }}
          >
            Take it away
          </button>
        )}
      </div>
    </div>
  )
}
