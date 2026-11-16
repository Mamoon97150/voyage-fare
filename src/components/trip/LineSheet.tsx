import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { compareLink, optionCount } from '../../lib/options'
import { deleteItem, type Item, type TripDetail } from '../../lib/trips'
import { leftLine } from '../../lib/tripView'
import { useSaving } from '../../lib/useSaving'
import { FormMessage } from '../AuthForm'
import { BookingPart } from './Booking'
import { DropControl } from './DropControl'
import { PartOfPackage } from './Packages'
import { PaymentsPanel } from './Payments'
import { StatusForm } from './StatusForm'
import { BackToTry } from './ToTry'
import { WhoFor } from './WhoFor'

/*
 * A line, opened (look pass, mockup line-sheet-v6, 16 Nov: "the form is too long"). Not a form any
 * more: a summary with where it stands and ONE main button — the next step — then a few rows that
 * each open a short sheet, and the rare things folded in "More". Each sheet has one Save.
 */

export type Pane = 'summary' | 'edit' | 'who' | 'status' | 'book' | 'pay' | 'parts' | 'booking'

const STEPS = [
  ['chosen', 'Chosen'],
  ['booked', 'Booked'],
  ['paid', 'Paid'],
] as const

export function LineSheet({
  detail,
  item,
  viewer,
  title,
  amount,
  meta,
  catKey,
  edit,
  onChanged,
  onClose,
}: {
  detail: TripDetail
  item: Item
  viewer: string | null
  title: string
  amount: string
  meta: string
  /** The category's pencil (cat-dot--…). */
  catKey: string
  /** The basics form (name, day, price), given its own Cancel/Save. */
  edit: (done: () => void) => ReactNode
  onChanged: () => void
  onClose: () => void
}) {
  const [pane, setPane] = useState<Pane>('summary')
  const [more, setMore] = useState(false)
  const back = () => setPane('summary')
  const saved = () => {
    setPane('summary')
    onChanged()
  }

  const chosen = detail.options.find((o) => o.item_id === item.id && o.is_chosen)
  const options = optionCount(detail, item)
  const compare = compareLink(detail, item)
  const hasPayments = (detail.payments ?? []).some((p) => p.item_id === item.id)
  const dropped = item.status === 'dropped'
  const booked = item.status === 'booked' || item.status === 'paid'
  const step = dropped ? -1 : !chosen ? -1 : STEPS.findIndex(([k]) => k === item.status)
  const who = whoText(detail, item)

  if (pane === 'edit') return <div className="line-sheet line-sheet--pane">{edit(saved)}</div>
  if (pane === 'who')
    return (
      <Pane title="Who it’s for" onDone={back}>
        <WhoFor detail={detail} item={item} onChanged={onChanged} />
      </Pane>
    )
  if (pane === 'booking')
    return (
      <Pane title="Booking" onDone={back}>
        <BookingPart detail={detail} item={item} onChanged={onChanged} />
      </Pane>
    )
  if (pane === 'parts')
    return (
      <Pane title="Pay in parts" onDone={back}>
        <PaymentsPanel detail={detail} item={item} viewer={viewer} onChanged={onChanged} />
      </Pane>
    )
  if (pane === 'status' || pane === 'book' || pane === 'pay')
    return (
      <div className="line-sheet line-sheet--pane">
        <StatusForm
          detail={detail}
          item={item}
          viewer={viewer}
          target={pane === 'book' ? 'booked' : pane === 'pay' ? 'paid' : undefined}
          onCancel={back}
          onSaved={saved}
        />
      </div>
    )

  // The next step: one main button.
  let next: ReactNode = null
  if (dropped) next = null
  else if (!chosen && options >= 2 && compare)
    next = (
      <Link to={compare} className="button button--primary button--wide">
        Choose in Compare
      </Link>
    )
  else if (!chosen)
    next = (
      <button type="button" className="button button--primary button--wide" onClick={() => setPane('edit')}>
        Add a price
      </button>
    )
  else if (item.status === 'chosen' && !item.package_id)
    next = (
      <button type="button" className="button button--primary button--wide" onClick={() => setPane('book')}>
        Mark it booked
      </button>
    )
  else if (item.status === 'booked' && hasPayments)
    next = (
      <button type="button" className="button button--primary button--wide" onClick={() => setPane('parts')}>
        Payments
      </button>
    )
  else if (item.status === 'booked')
    next = (
      <>
        <button type="button" className="button button--primary button--wide" onClick={() => setPane('pay')}>
          Mark it paid
        </button>
        {leftLine(detail, item, viewer, 'total') && (
          <p className="line-sheet__or hand">
            or{' '}
            <button type="button" className="link-button" onClick={() => setPane('parts')}>
              pay in parts
            </button>{' '}
            (deposit, balance…)
          </p>
        )}
      </>
    )

  return (
    <div className="line-sheet" role="group" aria-label={title}>
      <div className="line-sheet__head">
        <h3 className="line-sheet__title">{title}</h3>
        <b className="line-sheet__amount num">{amount}</b>
        <button type="button" className="round-button line-sheet__close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <p className="line-sheet__meta">
          <i className={`cat-dot cat-dot--${catKey}`} aria-hidden="true" />
          {[meta, who].filter(Boolean).join(' · ')}
        </p>
      </div>

      {dropped ? (
        <p className="field__hint line-sheet__dropped">Dropped: kept for the record, not counted.</p>
      ) : (
        <button
          type="button"
          className="line-track"
          aria-label={`Where it stands: ${step >= 0 ? STEPS[step][1] : 'not chosen yet'}. Change it`}
          disabled={!chosen}
          onClick={() => setPane('status')}
        >
          {STEPS.map(([k, label], i) => (
            <span
              key={k}
              className={`line-track__step${i <= step ? (i === 0 && step === 0 ? ' line-track__step--est' : ' line-track__step--ok') : ''}`}
            >
              <i aria-hidden="true" />
              {label}
            </span>
          ))}
        </button>
      )}

      {dropped ? (
        <DropControl item={item} onChanged={onChanged} />
      ) : (
        next && <div className="line-sheet__next">{next}</div>
      )}

      <ul className="line-rows">
        {booked && (
          <Row
            icon="🎫"
            label="Booking"
            sub={
              [
                item.booking_ref ? `#${item.booking_ref}` : null,
                item.booking_link ? 'link' : null,
                filesText(detail, item),
              ]
                .filter(Boolean)
                .join(' · ') || 'number, link, tickets'
            }
            onClick={() => setPane('booking')}
          />
        )}
        <Row
          icon="✎"
          label="Name, day, price"
          sub={[title, meta].filter(Boolean).join(' · ')}
          onClick={() => setPane('edit')}
        />
        {detail.travellers.length > 1 && (
          <Row icon="👥" label="Who it’s for" sub={who ?? 'everyone'} onClick={() => setPane('who')} />
        )}
        {options >= 2 && compare && (
          <li>
            <Link to={compare} className="line-row">
              <span className="line-row__icon" aria-hidden="true">
                ⇄
              </span>
              <span>
                Compare the options
                <small>{options} options</small>
              </span>
              <span className="line-row__go" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        )}
      </ul>

      <div className="line-sheet__more">
        <button type="button" className="button button--small" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Less ▴' : 'More ▾'}
        </button>
      </div>
      {more && (
        <div className="line-sheet__fold">
          <PartOfPackage detail={detail} item={item} onChanged={onChanged} />
          <BackToTry item={item} onChanged={onChanged} />
          {!dropped && <DropControl item={item} onChanged={onChanged} />}
          <DeleteLine item={item} onDeleted={onChanged} />
        </div>
      )}
    </div>
  )
}

function Row({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="line-row" onClick={onClick}>
        <span className="line-row__icon" aria-hidden="true">
          {icon}
        </span>
        <span>
          {label}
          <small>{sub}</small>
        </span>
        <span className="line-row__go" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}

/** A sub-sheet: its title, the part, and Done to go back to the summary. */
function Pane({ title, onDone, children }: { title: string; onDone: () => void; children: ReactNode }) {
  return (
    <div className="line-sheet line-sheet--pane" role="group" aria-label={title}>
      {children}
      <div className="add-item__actions">
        <button type="button" className="button button--quiet" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}

/** Delete, from More: it asks once, and says it can't be undone. */
function DeleteLine({ item, onDeleted }: { item: Item; onDeleted: () => void }) {
  const [asking, setAsking] = useState(false)
  const { busy, run } = useSaving()
  const [error, setError] = useState<string>()
  if (!asking)
    return (
      <button type="button" className="link-button add-item__delete" onClick={() => setAsking(true)}>
        Delete this line
      </button>
    )
  return (
    <div className="confirm-delete" role="group" aria-label="Delete">
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <p className="field__hint">{item.name} goes, with its options and payments. This can’t be undone.</p>
      <div className="add-item__actions">
        <button type="button" className="button button--quiet" disabled={busy} onClick={() => setAsking(false)}>
          Keep it
        </button>
        <button
          type="button"
          className="button button--danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await deleteItem(item.id)
              onDeleted()
            }, setError)
          }
        >
          {busy ? 'Deleting…' : `Yes, delete ${item.name}`}
        </button>
      </div>
    </div>
  )
}

/** "Everyone", or who shares it: "Ana & Bea". */
function whoText(detail: TripDetail, item: Item): string | null {
  if (detail.travellers.length < 2) return null
  const ids = detail.shares.filter((s) => s.item_id === item.id && Number(s.fraction) > 0).map((s) => s.traveller_id)
  if (!ids.length || ids.length === detail.travellers.length) return 'everyone'
  const names = detail.travellers.filter((t) => ids.includes(t.id)).map((t) => t.name)
  return names.length <= 2 ? names.join(' & ') : `${names.length} people`
}

function filesText(detail: TripDetail, item: Item): string | null {
  const n = (detail.files ?? []).filter((f) => f.item_id === item.id).length
  return n ? `${n} ${n === 1 ? 'file' : 'files'}` : null
}
