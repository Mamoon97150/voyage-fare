import { useRef, useState } from 'react'
import { copyText } from '../../lib/clipboard'
import { useAuth } from '../../lib/authContext'
import {
  addFile,
  fileProblem,
  fileUrl,
  removeFile,
  saveBooking,
  type Item,
  type ItemFile,
  type TripDetail,
} from '../../lib/trips'
import { useSaving } from '../../lib/useSaving'
import { FormMessage } from '../AuthForm'

/*
 * Booking details on a line (build 8 step 4, mockup booking-details-v5, 15 Nov): the confirmation
 * number (Copy), the booking link (Open ↗), tickets and vouchers (private to the trip's members).
 */

const filesOf = (detail: Pick<TripDetail, 'files'>, item: Pick<Item, 'id'>) =>
  (detail.files ?? []).filter((f) => f.item_id === item.id)

/** Under a booked line on the trip page: 🎫 the number, 📎 files, ↗ the link; nothing when empty. */
export function BookingMarks({ detail, item }: { detail: TripDetail; item: Item }) {
  if (item.status !== 'booked' && item.status !== 'paid') return null
  const files = filesOf(detail, item).length
  if (!item.booking_ref && !files && !item.booking_link) return null
  return (
    <span className="booking-marks">
      {item.booking_ref && <span className="booking-mark">🎫 #{item.booking_ref}</span>}
      {files > 0 && <span className="booking-mark">📎 {files === 1 ? '1 file' : `${files} files`}</span>}
      {item.booking_link && !files && <span className="booking-mark">↗ booking</span>}
    </span>
  )
}

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const kindOf = (mime: string) => (mime === 'application/pdf' ? 'PDF' : 'IMG')

/** On the line, once it's booked or paid. */
export function BookingPart({ detail, item, onChanged }: { detail: TripDetail; item: Item; onChanged: () => void }) {
  const { session } = useAuth()
  const [ref, setRef] = useState(item.booking_ref ?? '')
  const [link, setLink] = useState(item.booking_link ?? '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const [sure, setSure] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const { busy, run } = useSaving()
  if (item.status !== 'booked' && item.status !== 'paid') return null
  const files = filesOf(detail, item)
  const changed = ref.trim() !== (item.booking_ref ?? '') || link.trim() !== (item.booking_link ?? '')
  const id = `booking-${item.id}`

  const who = (f: ItemFile) => {
    if (f.added_by && f.added_by === session?.user.id) return 'added by you'
    const t = detail.travellers.find((x) => x.user_id && x.user_id === f.added_by)
    return t ? `added by ${t.name}` : null
  }

  async function save() {
    if (link.trim() && !/^https?:\/\//i.test(link.trim())) {
      setError('Paste the whole booking link, starting with https://')
      return
    }
    setError(undefined)
    await run(async () => {
      await saveBooking(item.id, ref, link)
      onChanged()
    }, setError)
  }

  async function pick(list: FileList | null) {
    const file = list?.[0]
    if (picker.current) picker.current.value = ''
    if (!file) return
    const problem = fileProblem(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(undefined)
    await run(async () => {
      await addFile(detail.trip.id, item.id, file)
      onChanged()
    }, setError)
  }

  async function open(f: ItemFile) {
    // A tab opened right away keeps the phone from blocking it; the address follows.
    const tab = window.open('', '_blank')
    try {
      const url = await fileUrl(f)
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch {
      tab?.close()
      setError('This file couldn’t be opened. Check your connection and try again.')
    }
  }

  return (
    <section className="booking" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="sheet-title">
        Booking
      </h3>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-ref`}>
          Confirmation number
        </label>
        <div className="booking__with">
          <input id={`${id}-ref`} className="field__input" value={ref} onChange={(e) => setRef(e.target.value)} />
          {item.booking_ref && (
            <button
              type="button"
              className="paste-button"
              onClick={() =>
                void copyText(item.booking_ref ?? '').then((ok) => {
                  setCopied(ok)
                  setTimeout(() => setCopied(false), 2500)
                })
              }
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-link`}>
          Booking link
        </label>
        <div className="booking__with">
          <input
            id={`${id}-link`}
            className="field__input"
            inputMode="url"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          {item.booking_link && (
            <a className="paste-button" href={item.booking_link} target="_blank" rel="noopener noreferrer">
              Open ↗
            </a>
          )}
        </div>
      </div>
      {changed && (
        <button type="button" className="button button--quiet" disabled={busy} onClick={() => void save()}>
          Save the booking details
        </button>
      )}

      <p className="field__label booking__files-title">Tickets &amp; vouchers</p>
      {files.length > 0 && (
        <ul className="booking__files">
          {files.map((f) => (
            <li key={f.id}>
              <span className="booking__thumb" aria-hidden="true">
                {kindOf(f.mime)}
              </span>
              <button type="button" className="booking__file" onClick={() => void open(f)}>
                <b>{f.name}</b>
                <small>{[size(f.size), who(f)].filter(Boolean).join(' · ')}</small>
              </button>
              {sure === f.id ? (
                <span className="booking__sure">
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await removeFile(f)
                        setSure(null)
                        onChanged()
                      }, setError)
                    }
                  >
                    Remove
                  </button>
                  <button type="button" className="link-button" onClick={() => setSure(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="booking__remove"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setSure(f.id)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className={`booking__add${busy ? ' booking__add--busy' : ''}`}>
        <input
          ref={picker}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => void pick(e.target.files)}
          disabled={busy}
        />
        {busy ? 'Sending…' : '＋ Add a ticket or voucher'}
      </label>
      <p className="booking__private">PDF or photo, up to 10 MB. Only the travellers on this trip can open them.</p>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </section>
  )
}
