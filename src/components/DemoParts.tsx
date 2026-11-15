import { Link } from 'react-router'
import { demoDefault, useDemo } from '../lib/demo'
import type { TripDetail } from '../lib/trips'
import { SketchBox } from './Sketch'

// Pieces of the demo trip's pages (build 7, step 3, mockup demo-v5).

/** The note clipped at the top of every demo page, with "See it as …". */
export function DemoStrip({ detail }: { detail: TripDetail }) {
  const demo = useDemo()
  if (!demo || !detail.trip.is_demo) return null
  const current = demo.seeAs ?? demoDefault(detail)
  const travellers = [...detail.travellers].sort((a, b) => a.position - b.position)
  return (
    <aside className="demo-strip" aria-label="Demo">
      <p>
        <b className="demo-strip__kicker">Demo</b>A real trip, the names changed. Look around: nothing you do here is
        saved.
      </p>
      <Link to="/sign-up" className="demo-strip__make">
        Make my own ›
      </Link>
      {travellers.length > 1 && (
        <div className="demo-strip__who" role="radiogroup" aria-label="See it as">
          <span>See it as</span>
          {travellers.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              className="chip"
              aria-checked={current === t.id}
              onClick={() => demo.setSeeAs(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

/** At the bottom of every demo page: "Your turn?" → create a notebook. */
export function YourTurn({ detail }: { detail: TripDetail }) {
  if (!detail.trip.is_demo) return null
  return (
    <SketchBox tape="mustard" className="your-turn" seed={42}>
      <h2>Your turn?</h2>
      <p>Start your own notebook: your trip, your people, each with their share. It’s free.</p>
      <Link to="/sign-up" className="button button--primary">
        Create my notebook
      </Link>
      <Link to="/" className="your-turn__back">
        Back to the welcome page
      </Link>
    </SketchBox>
  )
}

/** In the demo, a name instead of "you": "Ana’s share". */
export function demoShare(detail: TripDetail, viewer: string | null): string | undefined {
  const name = detail.travellers.find((t) => t.id === viewer)?.name
  return name ? `${name}’s share` : undefined
}
