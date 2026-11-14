import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { FolderTabs } from '../components/compare/FolderTabs'
import { OptionCard } from '../components/compare/OptionCard'
import { OptionForm } from '../components/compare/OptionForm'
import { Sketch, SketchBox } from '../components/Sketch'
import { TripTopBar } from '../components/trip/TripTopBar'
import { TripBudget } from '../components/TripBudget'
import { TripNav } from '../components/TripNav'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { optionLines, subjectsFor, TABS, tabToDecide, type Sort, type Subject, type Tab } from '../lib/options'
import { tripSubtitle } from '../lib/tripText'
import {
  addItemWithOption,
  addOption,
  chooseOption,
  deleteOption,
  getTrip,
  setFavourite,
  updateOption,
  type Item,
  type ItemKind,
  type TicketMode,
  type TripDetail,
} from '../lib/trips'
import { budgetView, daysText, isSolo, viewerOf, type Mode } from '../lib/tripView'

const EMPTY: Record<Tab, { kind: ItemKind; add: string; none: (where: string) => string }> = {
  travel: { kind: 'transport', add: '', none: () => '' },
  stay: { kind: 'housing', add: 'Add a place to stay', none: (w) => `No place to stay yet in ${w}` },
  around: { kind: 'car_rental', add: 'Add a way to get around', none: (w) => `Nothing to get around ${w} yet` },
  activities: { kind: 'activity', add: 'Add an activity', none: (w) => `No activities yet in ${w}` },
  food: { kind: 'restaurant', add: 'Add a place to eat', none: (w) => `No places to eat yet in ${w}` },
}

/**
 * Compare (mockups 2 and 10): the notebook's pages, one per category. Folder tabs for the
 * categories, "turn the page" between journeys or places, the options side by side.
 */
export function Compare() {
  const { tripId = '' } = useParams()
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [detail, setDetail] = useState<TripDetail | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string>()
  const [mode, setMode] = useState<Mode>('mine')

  const load = useCallback(
    () =>
      getTrip(tripId)
        .then(setDetail)
        .catch((e) => setLoadError(explainAuthError(e).message)),
    [tripId],
  )

  useEffect(() => {
    let active = true
    getTrip(tripId)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setLoadError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [tripId])

  if (loadError) {
    return (
      <div className="screen">
        <TripTopBar title="Compare" />
        <div className="screen__body">
          <FormMessage tone="error">{loadError}</FormMessage>
        </div>
      </div>
    )
  }
  if (detail === undefined) return <Loading />
  if (detail === null) {
    return (
      <div className="screen">
        <TripTopBar title="Compare" />
        <div className="screen__body">
          <p className="screen__intro">
            This trip isn’t here. <Link to="/trips">Back to your trips</Link>
          </p>
        </div>
      </div>
    )
  }

  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'travel') as Tab
  const subjects = subjectsFor(detail, tab)
  const index = Math.max(0, subjects.findIndex((s) => s.key === params.get('page')))
  const subject = subjects[index]
  const viewer = viewerOf(detail, session?.user.id)
  const solo = isSolo(detail)
  const shownMode: Mode = solo ? 'total' : mode
  const go = (next: { tab?: Tab; page?: string }) => {
    const p = new URLSearchParams()
    p.set('tab', next.tab ?? tab)
    if (next.page) p.set('page', next.page)
    setParams(p, { replace: true })
  }

  return (
    <div className="screen screen--trip">
      <TripTopBar
        title={detail.trip.name}
        subtitle={tripSubtitle(detail.trip, detail.travellers.length)}
        tripId={detail.trip.id}
        travellers={detail.travellers}
        userId={session?.user.id}
      />
      <TripBudget
        view={budgetView(detail, viewer, shownMode)}
        currency={detail.trip.currency}
        mode={shownMode}
        onMode={setMode}
        solo={solo}
      />

      <FolderTabs tab={tab} todo={(t) => tabToDecide(detail, t)} onTab={(t) => go({ tab: t })} />

      {subject ? (
        <div className="compare-page">
          <SketchBox weight="light" className="compare-sheet" seed={41 + index}>
            {/* The page head (Compare v4): the place and its dates by hand; the neighbours turn the page. */}
            <header className="page-head">
              {index > 0 ? (
                <button type="button" className="page-head__turn" onClick={() => go({ page: subjects[index - 1].key })} aria-label="Previous page">
                  ‹ {subjects[index - 1].title}
                </button>
              ) : (
                <span />
              )}
              <div className="page-head__mid">
                <h2>{subject.title}</h2>
                <p>{subject.note}</p>
              </div>
              {index < subjects.length - 1 ? (
                <button
                  type="button"
                  className="page-head__turn page-head__turn--next"
                  onClick={() => go({ page: subjects[index + 1].key })}
                  aria-label="Next page"
                >
                  {subjects[index + 1].title} ›
                </button>
              ) : (
                <span />
              )}
            </header>
            {subject.items.length === 0 ? (
              <EmptyPage detail={detail} tab={tab} subject={subject} onChanged={() => void load()} />
            ) : (
              subject.items.map((item) => (
                <ItemOptions
                  key={item.id}
                  detail={detail}
                  item={item}
                  subject={subject}
                  showName={tab !== 'travel'}
                  viewer={viewer}
                  mode={shownMode}
                  onChanged={() => void load()}
                />
              ))
            )}
          </SketchBox>
        </div>
      ) : (
        <div className="screen__body">
          <SketchBox tape="mustard" className="empty" seed={81}>
            <Sketch name="compare-empty" width={230} />
            <h2 className="empty__title">{tab === 'travel' ? 'No journeys yet' : 'Add a place first'}</h2>
            <p className="hand empty__note">{tab === 'travel' ? 'where are you flying?' : 'then compare what’s there'}</p>
            <p className="field__hint">
              {tab === 'travel'
                ? 'Add a ticket from the trip page (Whole trip → Transport): it becomes a journey here, with its options.'
                : 'Places are added on the trip page.'}
            </p>
            <Link to={`/trips/${detail.trip.id}`} className="button button--quiet">
              Go to the trip
            </Link>
          </SketchBox>
        </div>
      )}

      <TripNav tripId={detail.trip.id} solo={solo} />
    </div>
  )
}


/** One item's options, side by side, with Choose, ♥ and "+ Add an option". */
function ItemOptions({
  detail,
  item,
  subject,
  showName,
  viewer,
  mode,
  onChanged,
}: {
  detail: TripDetail
  item: Item
  subject: Subject
  showName: boolean
  viewer: string | null
  mode: Mode
  onChanged: () => void
}) {
  const [sort, setSort] = useState<Sort>('cheapest')
  const [editing, setEditing] = useState<string | null>(null) // an option id, 'new', or nothing
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const roundTrip = detail.legs.some((l) => l.item_id === item.id && l.leg_number === 2)
  const lines = optionLines(detail, item, viewer, mode, sort)
  const defaultMode = (detail.legs.find((l) => l.item_id === item.id)?.mode ?? 'plane') as TicketMode
  const timed = lines.filter((l) => l.minutes !== null).length > 1
  // The group's label, like the trip page's "DAY 1": its day, the decision, who it's for, what's left.
  const sharedBy = detail.shares.filter((x) => x.item_id === item.id).length
  const label: { text: string; tone?: 'what' | 'todo' | 'dropped' }[] = [
    daysText(item) ? { text: daysText(item) as string } : null,
    showName ? { text: item.name, tone: 'what' as const } : null,
    sharedBy > 0 && sharedBy < detail.travellers.length ? { text: `for ${sharedBy}` } : null,
    item.status === 'dropped'
      ? { text: 'dropped', tone: 'dropped' as const }
      : !detail.options.some((o) => o.item_id === item.id && o.is_chosen)
        ? { text: 'to decide', tone: 'todo' as const }
        : null,
  ].filter((p): p is { text: string; tone?: 'what' | 'todo' | 'dropped' } => p !== null)

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      onChanged()
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  const form = (option?: (typeof lines)[number]['option']) => (
    <SketchBox weight="light" className="form__sheet" seed={91}>
      <h3 className="sheet-title">{option ? `Change ${option.name}` : 'Add an option'}</h3>
      <OptionForm
        kind={item.kind as ItemKind}
        roundTrip={roundTrip}
        defaultMode={defaultMode}
        currency={detail.trip.currency}
        initial={option}
        submitLabel={option ? 'Save' : 'Add the option'}
        onSubmit={async (input) => {
          if (option) await updateOption(option.id, input)
          else await addOption(detail, item.id, input)
          setEditing(null)
          onChanged()
        }}
        onDelete={
          option
            ? async () => {
                await deleteOption(option.id)
                setEditing(null)
                onChanged()
              }
            : undefined
        }
        onCancel={() => setEditing(null)}
      />
    </SketchBox>
  )

  return (
    <section className="compare-item" aria-label={item.name}>
      {(label.length > 0 || timed) && (
        <div className="compare-item__head">
          <p className="item-group__label">
            {label.map((part, i) => (
              <span key={part.text} className={part.tone ? `compare-item__${part.tone}` : undefined}>
                {i > 0 && ' · '}
                {part.text}
              </span>
            ))}
          </p>
          {timed && (
            <div className="switch" role="radiogroup" aria-label="Sort">
              <button type="button" role="radio" aria-checked={sort === 'cheapest'} onClick={() => setSort('cheapest')}>
                Cheapest
              </button>
              <button type="button" role="radio" aria-checked={sort === 'fastest'} onClick={() => setSort('fastest')}>
                Fastest
              </button>
            </div>
          )}
        </div>
      )}
      {item.status === 'dropped' && <p className="field__hint compare-item__note">Kept for the record. Choose one to bring it back.</p>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <ul className="opts">
        {lines.map((line) =>
          editing === line.option.id ? (
            <li key={line.option.id}>{form(line.option)}</li>
          ) : (
            <OptionCard
              key={line.option.id}
              line={line}
              item={item}
              place={subject.place}
              currency={detail.trip.currency}
              travellers={detail.shares.filter((s) => s.item_id === item.id).length || detail.travellers.length}
              roundTrip={roundTrip}
              busy={busy}
              onEdit={() => setEditing(line.option.id)}
              onChoose={() => void act(() => chooseOption(line.option.id))}
              onFavourite={() => void act(() => setFavourite(line.option.id, !line.option.is_favourite))}
            />
          ),
        )}
      </ul>
      {editing === 'new' ? (
        form()
      ) : (
        <button type="button" className="add-row" onClick={() => setEditing('new')}>
          <span className="add-row__plus" aria-hidden="true">
            +
          </span>
          {item.kind === 'transport' ? 'Add a travel option' : 'Add an option'}
        </button>
      )}
    </section>
  )
}

/** A place with nothing yet in this category: the first option creates the item too. */
function EmptyPage({ detail, tab, subject, onChanged }: { detail: TripDetail; tab: Tab; subject: Subject; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const empty = EMPTY[tab]
  const where = subject.place?.name ?? 'the trip'
  return (
    <div className="empty compare-empty">
      {!adding && <Sketch name="compare-empty" width={200} />}
      <h2 className="empty__title">{empty.none(where)}</h2>
      {adding ? (
        <OptionForm
          kind={empty.kind}
          roundTrip={false}
          defaultMode="plane"
          currency={detail.trip.currency}
          submitLabel="Add the option"
          onSubmit={async (input) => {
            await addItemWithOption(detail, { placeId: subject.place?.id ?? null, kind: empty.kind, name: input.name }, input)
            setAdding(false)
            onChanged()
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <>
          <p className="hand empty__note">add a few, keep your coup de cœur</p>
          <button type="button" className="button button--primary button--wide" onClick={() => setAdding(true)}>
            + {empty.add}
          </button>
        </>
      )}
    </div>
  )
}
