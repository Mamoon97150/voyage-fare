import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { FormMessage } from '../components/AuthForm'
import { CityField } from '../components/CityField'
import { FormActions } from '../components/FormActions'
import { HomeNav } from '../components/HomeNav'
import { Sketch, SketchBox } from '../components/Sketch'
import { SourceBadge } from '../components/trip/ToTry'
import { Loading } from '../lib/auth'
import { useAuth } from '../lib/authContext'
import { explainAuthError } from '../lib/authForm'
import { emptyCity, type CityValue } from '../lib/places'
import { canPaste } from '../lib/pwa'
import { sourceOf } from '../lib/toTry'
import { deleteSomeday, listSomeday, saveSomeday, startTripFromSomeday, type SomedayIdea } from '../lib/trips'
import { plural } from '../lib/tripText'
import { groupSomeday } from '../lib/someday'
import { useSaving } from '../lib/useSaving'

/**
 * Someday (build 8½, mockup menus-home-v6): restaurants and activities found before there's a
 * trip (Instagram, TikTok, a friend's tip), by place. "Start a trip from these" makes the trip and
 * puts them in its To try. Only yours.
 */
export function Someday() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState<SomedayIdea[] | undefined>()
  const [error, setError] = useState<string>()
  const [editing, setEditing] = useState<SomedayIdea | 'new' | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const firstName = (session?.user.user_metadata?.first_name as string | undefined) ?? null

  const load = () =>
    listSomeday()
      .then(setIdeas)
      .catch((e) => setError(explainAuthError(e).message))

  useEffect(() => {
    let active = true
    listSomeday()
      .then((list) => active && setIdeas(list))
      .catch((e) => active && setError(explainAuthError(e).message))
    return () => {
      active = false
    }
  }, [])

  async function start(place: string, count: number) {
    setError(undefined)
    setStarting(place)
    try {
      const id = await startTripFromSomeday(place, firstName)
      navigate(`/trips/${id}`, {
        state: {
          note: `A new trip to ${place}: ${plural(count, 'idea')} waiting in To try. Add the nights when you know them.`,
        },
      })
    } catch (e) {
      setError(explainAuthError(e as { message?: string }).message)
      setStarting(null)
    }
  }

  const groups = ideas ? groupSomeday(ideas) : []

  return (
    <div className="page page--nav">
      <header className="app-header">
        <img src="/illustrations/compass.svg" width={28} height={28} alt="" />
        <span className="app-header__name">Voyage Fare</span>
      </header>
      <main className="someday">
        <div className="trips__head someday__head">
          <h1 className="trips__title">Someday</h1>
          <p className="hand trips__hello">ideas waiting for their trip</p>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {ideas === undefined && !error && <Loading />}

        {editing === 'new' ? (
          <IdeaForm
            onDone={() => {
              setEditing(null)
              void load()
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          ideas && (
            <button type="button" className="button button--primary button--wide" onClick={() => setEditing('new')}>
              + Save an idea
            </button>
          )
        )}

        {ideas?.length === 0 && editing !== 'new' && (
          <SketchBox weight="light" className="empty someday__empty" seed={64}>
            <Sketch name="no-trips" width={180} />
            <p className="empty__lead">
              The restaurant you saw on Instagram, the hike a friend told you about: keep them here, by place, until
              there’s a trip.
            </p>
          </SketchBox>
        )}

        {groups.map((g) => (
          <SketchBox key={g.place ?? '—'} weight="light" className="someday__group" seed={70 + (g.place?.length ?? 0)}>
            <h2 className="someday__place">
              {g.place ?? 'Anywhere'} <small>{plural(g.ideas.length, 'idea')}</small>
            </h2>
            <ul className="someday__ideas">
              {g.ideas.map((i) =>
                editing !== 'new' && editing?.id === i.id ? (
                  <li key={i.id}>
                    <IdeaForm
                      idea={i}
                      onDone={() => {
                        setEditing(null)
                        void load()
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <li key={i.id}>
                    <button type="button" className="someday__idea" onClick={() => setEditing(i)}>
                      <i className={`cat-dot cat-dot--${i.kind}`} aria-hidden="true" />
                      <span>
                        {i.name}
                        <small>
                          {i.note}
                          {i.link && <SourceBadge link={i.link} asLink={false} />}
                        </small>
                      </span>
                      <span className="someday__go" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
            {g.place && (
              <p className="someday__start">
                <button
                  type="button"
                  className="link-button"
                  disabled={starting !== null}
                  onClick={() => void start(g.place as string, g.ideas.length)}
                >
                  {starting === g.place ? 'Starting the trip…' : 'Start a trip from these ›'}
                </button>
              </p>
            )}
          </SketchBox>
        ))}
      </main>
      <HomeNav />
    </div>
  )
}

/** Save or change an idea: a link (where it was found), its name, to eat or to do, where, a note. */
function IdeaForm({ idea, onDone, onCancel }: { idea?: SomedayIdea; onDone: () => void; onCancel: () => void }) {
  const id = `someday-${idea?.id ?? 'new'}`
  const [link, setLink] = useState(idea?.link ?? '')
  const [name, setName] = useState(idea?.name ?? '')
  const [kind, setKind] = useState<'restaurant' | 'activity'>(idea?.kind ?? 'restaurant')
  const [place, setPlace] = useState<CityValue>(
    idea?.place_name
      ? {
          name: idea.place_name,
          country: idea.place_country,
          latitude: idea.place_latitude,
          longitude: idea.place_longitude,
        }
      : emptyCity,
  )
  const [note, setNote] = useState(idea?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const { busy, run } = useSaving()
  const source = sourceOf(link.trim())

  function pasted(value: string) {
    setLink(value)
    const found = sourceOf(value.trim())
    if (found?.name && !name.trim()) setName(found.name)
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      const found = text.match(/https?:\/\/[^\s<>"]+/)?.[0]
      if (found) pasted(found)
      else setErrors((e) => ({ ...e, link: 'No link copied yet: in the post, tap ⋯ then Copy link.' }))
    } catch {
      setErrors((e) => ({ ...e, link: 'The phone didn’t allow pasting: press and hold in the box, then Paste.' }))
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Give it a name, like “Pujol”.'
    if (link.trim() && !source) found.link = 'Paste the whole address, starting with https://'
    setErrors(found)
    if (Object.keys(found).length) return
    await run(async () => {
      await saveSomeday({
        id: idea?.id,
        place: place.name.trim() ? place : null,
        kind,
        name,
        link: link.trim() || null,
        note: note.trim() || null,
      })
      onDone()
    }, setFormError)
  }

  return (
    <SketchBox tape={idea ? undefined : 'mustard'} className="form__sheet someday__form" seed={66}>
      <form onSubmit={submit} noValidate className="add-item">
        <h2 className="sheet-title">{idea ? 'Change the idea' : 'Save an idea'}</h2>
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <div className={`field${errors.link ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-link`} className="field__label">
            Link <span className="field__optional">(optional)</span>
          </label>
          <div className="link-row">
            <input
              id={`${id}-link`}
              className="field__input"
              inputMode="url"
              placeholder="Instagram, TikTok, Google Maps…"
              value={link}
              onChange={(e) => pasted(e.target.value)}
            />
            {canPaste() && (
              <button type="button" className="paste-button" onClick={() => void paste()}>
                <span aria-hidden="true">📋</span> Paste
              </button>
            )}
          </div>
          {errors.link && <p className="field__error">{errors.link}</p>}
        </div>
        <div className="switch to-try-kind" role="radiogroup" aria-label="To eat or to do">
          <button type="button" role="radio" aria-checked={kind === 'restaurant'} onClick={() => setKind('restaurant')}>
            To eat
          </button>
          <button type="button" role="radio" aria-checked={kind === 'activity'} onClick={() => setKind('activity')}>
            To do
          </button>
        </div>
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor={`${id}-name`} className="field__label">
            Name
          </label>
          <input
            id={`${id}-name`}
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <p className="field__error">{errors.name}</p>}
        </div>
        <CityField
          id={`${id}-place`}
          label="Where (optional)"
          value={place}
          onChange={setPlace}
          placeholder="Mexico City"
          hint="the city or region: ideas are grouped by it"
        />
        <div className="field">
          <label htmlFor={`${id}-note`} className="field__label">
            A note <span className="field__optional">(optional)</span>
          </label>
          <input id={`${id}-note`} className="field__input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <FormActions
          busy={busy}
          submitLabel={idea ? 'Save' : 'Save the idea'}
          onCancel={onCancel}
          onDelete={
            idea
              ? async () => {
                  await deleteSomeday(idea.id)
                  onDone()
                }
              : undefined
          }
          deleteName={idea?.name}
        />
      </form>
    </SketchBox>
  )
}
