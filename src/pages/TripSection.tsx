import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { Sketch, SketchBox, type Drawing } from '../components/Sketch'
import { TripNav } from '../components/TripNav'
import { Loading } from '../lib/auth'
import { explainAuthError } from '../lib/authForm'
import { getTripHeader } from '../lib/trips'

export type Section = 'budget' | 'who-paid'

const SECTIONS: Record<Section, { title: string; drawing: Drawing; note: string; soon: string }> = {
  budget: {
    title: 'Budget',
    drawing: 'no-trips',
    note: 'where the money goes',
    soon: 'Coming soon: the trip by category and by place, and everyone’s share. Until then, the bar at the top of the trip has the totals.',
  },
  'who-paid': {
    title: 'Who paid what',
    drawing: 'settled',
    note: 'squared up, without the notebook',
    soon: 'Coming soon: mark what’s paid and by whom, see who owes whom, and settle up in as few payments as possible.',
  },
}

/** A trip's other pages, reached from the bottom bar. They're built in builds 3 and 4: until then, a page that says so. */
export function TripSection({ section }: { section: Section }) {
  const { tripId = '' } = useParams()
  const [header, setHeader] = useState<{ name: string; travellers: number } | null | undefined>(undefined)
  const [error, setError] = useState<string>()
  const page = SECTIONS[section]

  useEffect(() => {
    let active = true
    getTripHeader(tripId)
      .then((h) => active && setHeader(h))
      .catch((e) => active && setError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [tripId])

  if (header === undefined && !error) return <Loading />
  const solo = (header?.travellers ?? 0) <= 1

  return (
    <div className="screen screen--trip">
      <header className="screen__top">
        <Link to={`/trips/${tripId}`} className="round-button" aria-label="Back to the trip">
          ‹
        </Link>
        <h1 className="screen__title screen__title--trip">{page.title}</h1>
      </header>
      {header && <p className="screen__meta">{header.name}</p>}
      <div className="screen__body">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {header === null && (
          <p className="screen__intro">
            This trip isn’t here. <Link to="/trips">Back to your trips</Link>
          </p>
        )}
        {header && (
          <SketchBox tape="mustard" className="empty" seed={61}>
            <Sketch name={page.drawing} width={230} />
            <h2 className="empty__title">{section === 'who-paid' && solo ? 'Nothing to settle' : page.title}</h2>
            <p className="hand empty__note">{section === 'who-paid' && solo ? 'it’s just you on this trip' : page.note}</p>
            <p className="field__hint">{page.soon}</p>
          </SketchBox>
        )}
      </div>
      {header && <TripNav tripId={tripId} solo={solo} />}
    </div>
  )
}
