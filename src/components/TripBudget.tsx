import { useEffect, useState } from 'react'
import { formatWhole as formatMoney } from '../lib/money'
import type { BudgetView, Mode } from '../lib/tripView'
import { HandBar } from './HandBar'
import { Underlined } from './Sketch'

/**
 * The budget, always visible at the top of a trip (spec §6.1, BR-5, BR-12), as the notebook's
 * cover (Compare v4, 13 Nov): the figure in the title font, "your share · total" as words with the
 * active one underlined by hand, the bar coloured in with pencil. Green = confirmed, mustard =
 * still estimated, red only when over the target.
 */
export function TripBudget({
  view,
  currency,
  mode,
  onMode,
  solo,
}: {
  view: BudgetView
  currency: string
  mode: Mode
  onMode: (mode: Mode) => void
  viewerName?: string | null
  solo: boolean
}) {
  const scale = Math.max(view.figure ?? 0, view.target ?? 0)
  const part = (v: number | null) => (scale > 0 && v ? v / scale : 0)
  const over = view.difference !== null && view.difference > 0
  const figure = formatMoney(view.figure, currency)

  // Full at the top; once you scroll into the trip, one line: figure, words, bar (review 13 Nov, #9).
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    // Two thresholds: shrinking moves the page up a little, so one threshold would make it flicker.
    const onScroll = () => setCompact((was) => (was ? window.scrollY > 40 : window.scrollY > 160))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const word = (value: Mode, label: string) => (
    <button type="button" role="radio" aria-checked={mode === value} onClick={() => onMode(value)}>
      {mode === value ? <Underlined>{label}</Underlined> : label}
    </button>
  )

  return (
    <section className={`trip-budget${compact ? ' trip-budget--compact' : ''}`} aria-label="Budget">
      <div className="trip-budget__row">
        {/* Pesos and other big currencies make long figures: keep them on one line. */}
        <p className={`trip-budget__figure num${figure.length > 9 ? ' trip-budget__figure--long' : ''}`}>
          {figure}
          {solo && <small> the trip</small>}
        </p>
        {/* Solo: your share is the total, so there's nothing to switch (13 Nov rule). */}
        {!solo && (
          <div className="words-switch" role="radiogroup" aria-label="Amounts shown">
            {word('mine', 'your share')}
            <span aria-hidden="true"> · </span>
            {word('total', 'total')}
          </div>
        )}
      </div>
      <HandBar
        confirmed={part(view.confirmed)}
        estimated={part(view.estimated)}
        target={view.target !== null && scale > 0 ? part(view.target) : null}
        over={over}
      />
      <div className="trip-budget__legend num">
        <span>
          <b className="trip-budget__confirmed-figure">{formatMoney(view.confirmed, currency)}</b> confirmed
        </span>
        <span>
          <b className="trip-budget__estimated-figure">{formatMoney(view.estimated, currency)}</b> still estimated
        </span>
      </div>
      {view.target !== null && (
        <p className={`trip-budget__target-text num${over ? ' trip-budget__target-text--over' : ''}`}>{targetText(view, currency)}</p>
      )}
      {view.missing > 0 && (
        <p className="trip-budget__missing">
          {view.missing === 1 ? '1 chosen item has no price yet: not counted.' : `${view.missing} chosen items have no price yet: not counted.`}
        </p>
      )}
    </section>
  )
}

function targetText(view: BudgetView, currency: string): string {
  if (view.target === null) return ''
  if (view.difference === null) return `Target ${formatMoney(view.target, currency)}. Nothing priced yet.`
  if (view.difference > 0) return `${formatMoney(view.difference, currency)} over your ${formatMoney(view.target, currency)} target`
  if (view.difference < 0) return `${formatMoney(-view.difference, currency)} under your ${formatMoney(view.target, currency)} target`
  return `Right on your ${formatMoney(view.target, currency)} target`
}
