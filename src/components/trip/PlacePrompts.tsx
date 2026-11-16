import { mealsLeft } from '../../lib/itemDetails'
import type { Item } from '../../lib/trips'

/*
 * The place card's gentle nudges (mockup kinds-v6, 16 Nov): a dashed "Where we sleep" for a place
 * with nights and nowhere to stay yet (not a line: nothing counts until one is added), and on each
 * day a faint "+ What we do · + Where we eat". "Where we eat" goes once breakfast, lunch and dinner
 * are all set that day (decided 16 Nov: 3 meals a day).
 */

export function WhereWeSleep({ onAdd }: { onAdd: () => void }) {
  return (
    <button type="button" className="ghost-line" onClick={onAdd}>
      <span className="dot dot--none" aria-hidden="true" />
      <span>
        <b>Where we sleep</b>
        <small>add a place to stay, or compare a few</small>
      </span>
      <span className="ghost-line__go" aria-hidden="true">
        ›
      </span>
    </button>
  )
}

export function DayPrompts({
  items,
  placeId,
  day,
  onAdd,
}: {
  items: Item[]
  placeId: string
  day: number
  onAdd: (kind: 'activity' | 'restaurant' | 'cash') => void
}) {
  const eat = mealsLeft(items, placeId, day).length > 0
  return (
    <div className="day-prompts">
      <button
        type="button"
        className="day-prompt"
        onClick={() => onAdd('activity')}
        aria-label={`What we do on day ${day}`}
      >
        <i aria-hidden="true">+</i>What we do
      </button>
      {eat && (
        <button
          type="button"
          className="day-prompt"
          onClick={() => onAdd('restaurant')}
          aria-label={`Where we eat on day ${day}`}
        >
          <i aria-hidden="true">+</i>Where we eat
        </button>
      )}
      <button type="button" className="day-prompt" onClick={() => onAdd('cash')} aria-label={`Cash paid on day ${day}`}>
        <i aria-hidden="true">+</i>Cash
      </button>
    </div>
  )
}
