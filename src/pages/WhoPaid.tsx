import { useState, type FormEvent } from 'react'
import { FormMessage } from '../components/AuthForm'
import { Card, MoneyScreen, type MoneyPage } from '../components/MoneyScreen'
import { Sketch, SketchBox } from '../components/Sketch'
import { explainAuthError } from '../lib/authForm'
import { formatMoney, formatWhole, parseAmount } from '../lib/money'
import { balanceLines, bookedLines, headline, paidLines, repaymentLines, settleWords } from '../lib/moneyPages'
import { addRepayment, deleteRepayment } from '../lib/trips'
import { localToday } from '../lib/tripText'

/**
 * Who paid what (build 4, mockup who-paid-v4): the answer first (owed, owe, square), the few
 * payments that settle everything, everyone's balance, what's paid, what's been paid back, and
 * what's booked but not paid yet (not in the balances until someone pays).
 */
export function WhoPaid() {
  return <MoneyScreen>{(page) => (page.solo ? <Solo /> : <Pages {...page} />)}</MoneyScreen>
}

function Solo() {
  return (
    <SketchBox tape="mustard" className="empty" seed={61}>
      <Sketch name="settled" width={220} />
      <h2 className="empty__title">Nothing to settle</h2>
      <p className="hand empty__note">it’s just you on this trip</p>
    </SketchBox>
  )
}

function Pages({ detail, money, viewer, reload }: MoneyPage) {
  const currency = detail.trip.currency
  const top = headline(detail, money, viewer)
  const paid = paidLines(detail, viewer)
  const booked = bookedLines(detail)
  const repaid = repaymentLines(detail, money, viewer)
  const paidTotal = paid.reduce((s, l) => s + (l.amount ?? 0), 0)

  return (
    <>
      <SketchBox weight="strong" className="card card--hero" seed={80}>
        <p>{top.words}</p>
        {top.amount !== null && <b className={`num${top.owed ? '' : ' card--hero__owe'}`}>{formatWhole(top.amount, currency)}</b>}
        <span>{top.sub}</span>
      </SketchBox>

      <Card title="To settle up" small={money.settlement.length ? `${money.settlement.length} ${money.settlement.length === 1 ? 'payment' : 'payments'}` : undefined} seed={81}>
        {money.settlement.length === 0 ? (
          <p className="card__note">nothing to settle: everyone is square</p>
        ) : (
          <ul className="lines">
            {money.settlement.map((s) => (
              <SettleRow key={`${s.from_traveller}-${s.to_traveller}`} page={{ detail, money, viewer, reload }} from={s.from_traveller} to={s.to_traveller} amount={s.amount} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Balances" seed={82}>
        <ul className="lines">
          {balanceLines(detail, money).map((b) => (
            <li key={b.id} className="line line--who">
              <span className={`avatar${b.id === viewer ? ' avatar--me' : ''}`} aria-hidden="true">
                {b.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <span className="line__name">{b.name}</span>
                <span className="line__meta num">{b.meta}</span>
              </span>
              <span className="line__amount num">
                <b className={b.tag === 'is owed' ? 'plus' : b.tag === 'owes' ? 'minus' : undefined}>
                  {b.tag === 'settled' ? formatWhole(0, currency) : `${b.balance > 0 ? '+' : '−'}${formatWhole(Math.abs(b.balance), currency)}`}
                </b>
                <span className={`line__tag${b.tag === 'owes' ? ' line__tag--owe' : ' line__tag--ok'}`}>{b.tag}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Paid so far" total={paid.length ? formatWhole(paidTotal, currency) : undefined} seed={83}>
        {paid.length === 0 ? (
          <p className="card__note">nothing paid yet: mark a line paid where it stands</p>
        ) : (
          <ul className="lines">
            {paid.map((l) => (
              <li key={l.id} className="line">
                <span>
                  <span className="line__name">{l.name}</span>
                  <span className="line__meta num">{l.meta}</span>
                </span>
                <b className="line__amount num">{formatWhole(l.amount, currency)}</b>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Paid back" seed={84}>
        {repaid.length === 0 ? (
          <p className="card__note">nothing yet</p>
        ) : (
          <ul className="lines">
            {repaid.map((r) => (
              <li key={r.id} className="line">
                <span>
                  <span className="line__name">{r.words}</span>
                  <span className="line__meta">{r.meta}</span>
                </span>
                <span className="line__amount num">
                  <b>{formatMoney(r.amount, currency)}</b>
                  <button
                    type="button"
                    className="link-button line__undo"
                    onClick={() => void deleteRepayment(r.id).then(reload)}
                    aria-label={`Remove: ${r.words}, ${formatMoney(r.amount, currency)}`}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <RepaymentForm page={{ detail, money, viewer, reload }} />
      </Card>

      <Card title="Booked, not paid yet" small="not in the balances" dashed seed={85}>
        {booked.length === 0 ? (
          <p className="card__note">nothing: everything booked is paid</p>
        ) : (
          <ul className="lines">
            {booked.map((l) => (
              <li key={l.id} className="line">
                <span className="line__name">{l.name}</span>
                <b className="line__amount num">{formatWhole(l.amount, currency)}</b>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

type Ctx = Pick<MoneyPage, 'detail' | 'money' | 'viewer' | 'reload'>

/** One of the payments that settle everything; "Paid back" records it, after one check. */
function SettleRow({ page, from, to, amount }: { page: Ctx; from: string; to: string; amount: number }) {
  const { detail, viewer, reload } = page
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string>()
  const words = settleWords(detail, from, to, viewer)
  const fromName = detail.travellers.find((t) => t.id === from)?.name ?? ''
  const currency = detail.trip.currency

  async function record() {
    setError(undefined)
    try {
      await addRepayment({ tripId: detail.trip.id, from, to, amount, paidOn: localToday() })
      reload()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    }
  }

  return (
    <li className="line line--who">
      <span className="avatar" aria-hidden="true">
        {fromName.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <span className="line__name">{words}</span>
        {asking ? (
          <span className="line__ask">
            <span className="line__meta">Record {formatMoney(amount, currency)} paid back today?</span>
            <button type="button" className="small-button small-button--yes" onClick={() => void record()}>
              Yes, record it
            </button>
            <button type="button" className="small-button" onClick={() => setAsking(false)}>
              Not yet
            </button>
          </span>
        ) : (
          <button type="button" className="small-button" onClick={() => setAsking(true)} aria-label={`Paid back: ${words}`}>
            Paid back
          </button>
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </span>
      <b className="line__amount num">{formatMoney(amount, currency)}</b>
    </li>
  )
}

/** Any repayment, not only the suggested ones: who, to whom, how much, when (SR-8: main currency). */
function RepaymentForm({ page }: { page: Ctx }) {
  const { detail, viewer, reload } = page
  const [open, setOpen] = useState(false)
  const others = detail.travellers.filter((t) => t.id !== viewer)
  const [from, setFrom] = useState(others[0]?.id ?? '')
  const [to, setTo] = useState(viewer ?? detail.travellers[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(localToday)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const currency = detail.trip.currency

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (from === to) return setError('Someone pays someone else back.')
    if (value === null || value <= 0) return setError('How much? Like 67 or 1 060,50.')
    setBusy(true)
    setError(undefined)
    try {
      await addRepayment({ tripId: detail.trip.id, from, to, amount: value, paidOn, note: note.trim() || null })
      setOpen(false)
      setAmount('')
      setNote('')
      reload()
    } catch (err) {
      setError(explainAuthError(err as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="add-row" onClick={() => setOpen(true)}>
        <span className="add-row__plus" aria-hidden="true">
          +
        </span>
        Record a repayment
      </button>
    )
  }
  const pick = (id: string, value: string, set: (v: string) => void, label: string) => (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <select id={id} className="field__input" value={value} onChange={(e) => set(e.target.value)}>
        {detail.travellers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id === viewer ? `${t.name} (you)` : t.name}
          </option>
        ))}
      </select>
    </div>
  )
  return (
    <form className="repay-form" onSubmit={submit} aria-label="Record a repayment">
      <div className="row2">
        {pick('repay-from', from, setFrom, 'Who paid back')}
        {pick('repay-to', to, setTo, 'To whom')}
      </div>
      <div className="row2">
        <div className="field">
          <label htmlFor="repay-amount" className="field__label">
            How much
          </label>
          <div className="field__box">
            <input id="repay-amount" className="field__input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="field__unit">{currency}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="repay-on" className="field__label">
            On
          </label>
          <input id="repay-on" type="date" className="field__input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="repay-note" className="field__label">
          Note
        </label>
        <input id="repay-note" className="field__input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank transfer, cash…" />
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="add-item__actions">
        <button type="button" className="button button--quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Record it'}
        </button>
      </div>
    </form>
  )
}

