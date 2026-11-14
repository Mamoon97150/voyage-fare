import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { Loading } from '../lib/auth'
import { getMoney, getTrip, type TripDetail, type TripMoney } from '../lib/trips'
import { tripSubtitle } from '../lib/tripText'
import { budgetView, isSolo, viewerOf, type Mode } from '../lib/tripView'
import { FormMessage } from './AuthForm'
import { SketchBox } from './Sketch'
import { TripTopBar } from './trip/TripTopBar'
import { TripBudget } from './TripBudget'
import { TripNav } from './TripNav'

export type MoneyPage = { detail: TripDetail; money: TripMoney; viewer: string | null; mode: Mode; solo: boolean; reload: () => void }

/**
 * Budget and Who paid (build 4): the trip's cover on top, the bottom bar, and in between the
 * page's cards. Loads the trip and its money side together.
 */
export function MoneyScreen({ children }: { children: (page: MoneyPage) => ReactNode }) {
  const { tripId = '' } = useParams()
  const { session } = useAuth()
  const [data, setData] = useState<{ detail: TripDetail | null; money: TripMoney | null } | undefined>(undefined)
  const [error, setError] = useState<string>()
  const [mode, setMode] = useState<Mode>('mine')

  const fetchAll = useCallback(async () => {
    const detail = await getTrip(tripId)
    return { detail, money: detail ? await getMoney(tripId) : null }
  }, [tripId])

  useEffect(() => {
    let active = true
    fetchAll()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [fetchAll])

  const reload = () =>
    void fetchAll()
      .then(setData)
      .catch((e) => setError(explainAuthError(e).message))

  if (error) {
    return (
      <div className="screen">
        <TripTopBar title="Voyage Fare" />
        <div className="screen__body">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      </div>
    )
  }
  if (data === undefined) return <Loading />
  const { detail, money } = data
  if (!detail || !money) {
    return (
      <div className="screen">
        <TripTopBar title="Voyage Fare" />
        <div className="screen__body">
          <p className="screen__intro">
            This trip isn’t here. <Link to="/trips">Back to your trips</Link>
          </p>
        </div>
      </div>
    )
  }

  const viewer = viewerOf(detail, session?.user.id)
  const solo = isSolo(detail)
  const shownMode: Mode = solo ? 'total' : mode
  return (
    <div className="screen screen--trip">
      <TripTopBar
        title={detail.trip.name}
        subtitle={tripSubtitle(detail.trip, detail.travellers.length)}
        tripId={detail.trip.id}
        travellers={detail.travellers}
        userId={session?.user.id}
      />
      <TripBudget view={budgetView(detail, viewer, shownMode)} currency={detail.trip.currency} mode={shownMode} onMode={setMode} solo={solo} />
      <div className="cards">{children({ detail, money, viewer, mode: shownMode, solo, reload })}</div>
      <TripNav tripId={detail.trip.id} solo={solo} />
    </div>
  )
}

/** One section of Budget or Who paid: a sheet like a place, its title and total in the head (13 Nov). */
export function Card({
  title,
  small,
  total,
  dashed = false,
  seed,
  children,
}: {
  title: string
  small?: string
  total?: string
  dashed?: boolean
  seed: number
  children: ReactNode
}) {
  return (
    <SketchBox weight="light" dashed={dashed} className={`card${dashed ? ' card--plain' : ''}`} seed={seed}>
      <section aria-label={title}>
        <header className="card__head">
          <h2>
            {title}
            {small && <small>{small}</small>}
          </h2>
          {total && <b className="num">{total}</b>}
        </header>
        {children}
      </section>
    </SketchBox>
  )
}
