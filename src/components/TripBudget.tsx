import { useEffect, useState } from 'react'
import { formatWhole as formatMoney } from '../lib/money'
import type { BudgetView, Mode } from '../lib/tripView'

/**
 * The budget bar, always visible at the top of a trip (spec §6.1, BR-5, BR-12).
 * Green = confirmed, mustard = still estimated, red only when over the target.
 */
export function TripBudget({
  view,
  currency,
  mode,
  onMode,
  viewerName,
  solo,
}: {
  view: BudgetView
  currency: string
  mode: Mode
  onMode: (mode: Mode) => void
  viewerName: string | null
  solo: boolean
}) {
  const scale = Math.max(view.figure ?? 0, view.target ?? 0)
  const pct = (v: number | null) => (scale > 0 && v ? `${(v / scale) * 100}%` : '0%')
  const over = view.difference !== null && view.difference > 0
  const label = solo ? 'the trip' : mode === 'mine' ? 'your share' : 'whole trip'
  const figure = formatMoney(view.figure, currency)

  // Full at the top; once you scroll into the trip, one line: figure, track, target (review 13 Nov, #9).
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    // Two thresholds: shrinking moves the page up a little, so one threshold would make it flicker.
    const onScroll = () => setCompact((was) => (was ? window.scrollY > 40 : window.scrollY > 160))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className={`trip-budget${compact ? ' trip-budget--compact' : ''}`} aria-label="Budget">
      <div className="trip-budget__row">
        {/* Pesos and other big currencies make long figures: keep them on one line. */}
        <p className={`trip-budget__figure num${figure.length > 9 ? ' trip-budget__figure--long' : ''}`}>
          {figure} <small>{label}</small>
        </p>
        {/* Solo: your share is the total, so there's nothing to switch (13 Nov rule). */}
        {!solo && viewerName && (
          <div className="switch" role="radiogroup" aria-label="Amounts shown">
            <button type="button" role="radio" aria-checked={mode === 'mine'} onClick={() => onMode('mine')}>
              {viewerName}
            </button>
            <button type="button" role="radio" aria-checked={mode === 'total'} onClick={() => onMode('total')}>
              Total
            </button>
          </div>
        )}
      </div>
      <div className="trip-budget__track" aria-hidden="true">
        <div className="trip-budget__confirmed" style={{ width: pct(view.confirmed) }} />
        <div className="trip-budget__estimated" style={{ width: pct(view.estimated) }} />
        {view.target !== null && scale > 0 && (
          <div className="trip-budget__target" style={{ left: `calc(${pct(view.target)} - 1px)` }} />
        )}
      </div>
      <div className="trip-budget__legend num">
        <span>
          <i className="dot dot--confirmed" /> Confirmed {formatMoney(view.confirmed, currency)}
        </span>
        <span>
          <i className="dot dot--estimated" /> Still estimated {formatMoney(view.estimated, currency)}
        </span>
      </div>
      <p className={`trip-budget__target-text num${over ? ' trip-budget__target-text--over' : ''}`}>
        {targetText(view, currency)}
      </p>
      {view.missing > 0 && (
        <p className="trip-budget__missing">
          {view.missing === 1 ? '1 chosen item has no price yet: not counted.' : `${view.missing} chosen items have no price yet: not counted.`}
        </p>
      )}
    </section>
  )
}

function targetText(view: BudgetView, currency: string): string {
  if (view.target === null) return 'No target set.'
  if (view.difference === null) return `Target ${formatMoney(view.target, currency)}. Nothing priced yet.`
  if (view.difference > 0) return `${formatMoney(view.difference, currency)} over your ${formatMoney(view.target, currency)} target`
  if (view.difference < 0) return `${formatMoney(-view.difference, currency)} under your ${formatMoney(view.target, currency)} target`
  return `Right on your ${formatMoney(view.target, currency)} target`
}
