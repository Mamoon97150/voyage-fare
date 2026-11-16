import { useEffect, useId, useRef, useState } from 'react'
import { rememberedPlaces, searchPlaces, spotFromLink, type CityValue, type PlaceSuggestion } from '../lib/places'

/**
 * Type a city, pick it from the suggestions: that gives its coordinates for the map.
 * A city that isn't in the list can still be typed and kept; it just won't be on the map.
 * suggestNow: show suggestions for the name already there (a place that isn't on the map yet).
 * While it looks, it says so; a search done before is instant (16 Nov: "the picker took long").
 */
export function CityField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  autoFocus,
  suggestNow = false,
  search = searchPlaces,
  known: knownFor = rememberedPlaces,
  readLinks = false,
  looking: lookingWord = 'looking for it on the map…',
}: {
  id: string
  label: string
  value: CityValue
  onChange: (value: CityValue) => void
  placeholder?: string
  hint?: string
  error?: string
  autoFocus?: boolean
  suggestNow?: boolean
  /** Spots instead of cities (a line's "Where", maps-v6). */
  search?: (query: string, signal?: AbortSignal) => Promise<PlaceSuggestion[]>
  known?: (query: string) => PlaceSuggestion[] | undefined
  /** A pasted Google Maps link gives the spot straight away. */
  readLinks?: boolean
  looking?: string
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [looking, setLooking] = useState(false)
  const typed = useRef(suggestNow)
  // The search can change with each render (a closure): the latest one is used, without searching again.
  const searchRef = useRef({ search, knownFor })
  useEffect(() => {
    searchRef.current = { search, knownFor }
  })
  const listId = useId()

  useEffect(() => {
    if (!typed.current) return
    const query = value.name
    if (query.trim().length < 2) return
    const show = (found: PlaceSuggestion[]) => {
      setSuggestions(found)
      setActive(-1)
      setOpen(found.length > 0)
      setLooking(false)
    }
    if (readLinks && /^https?:\/\//i.test(query.trim())) return
    const known = searchRef.current.knownFor(query)
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        if (known) return show(known)
        setLooking(true)
        searchRef.current
          .search(query, controller.signal)
          .then(show)
          .catch((e: Error) => {
            if (e.name === 'AbortError') return
            setSuggestions([]) // no suggestions: the typed name still works
            setLooking(false)
          })
      },
      known ? 0 : 150,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value.name, readLinks])

  function pick(s: PlaceSuggestion) {
    typed.current = false
    onChange({ name: s.name, country: s.country, latitude: s.latitude, longitude: s.longitude })
    setOpen(false)
  }

  const describedBy = [error ? `${id}-error` : hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
  const pinned = value.latitude !== null && value.name

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="field__box">
        <input
          id={id}
          className="field__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value.name}
          onChange={(e) => {
            typed.current = true
            if (e.target.value.trim().length < 2) {
              setSuggestions([])
              setOpen(false)
              setLooking(false)
            }
            // A Google Maps link carries its spot: taken as it is, nothing searched.
            const fromLink = readLinks ? spotFromLink(e.target.value) : null
            if (fromLink) {
              typed.current = false
              setOpen(false)
              return onChange(fromLink)
            }
            // Typing again forgets the picked place's position.
            onChange({ name: e.target.value, country: null, latitude: null, longitude: null })
          }}
          // A tap on a phone blurs the field before the click lands: give it time.
          onBlur={() =>
            setTimeout(() => {
              setOpen(false)
              setLooking(false)
            }, 300)
          }
          onFocus={() => suggestions.length && typed.current && setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, suggestions.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && active >= 0) {
              e.preventDefault()
              pick(suggestions[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {pinned && (
          <span className="field__pin" title="On the map">
            ◉
          </span>
        )}
      </div>
      {looking && !open && (
        <p className="suggest suggest__looking" role="status">
          {lookingWord}
        </p>
      )}
      {open && (
        <ul id={listId} role="listbox" className="suggest">
          {suggestions.map((s, i) => (
            <li
              key={`${s.name}-${s.detail}`}
              id={`${listId}-${i}`}
              role="option"
              aria-label={s.detail ? `${s.name}, ${s.detail}` : s.name}
              aria-selected={i === active}
              className={i === active ? 'suggest__item suggest__item--on' : 'suggest__item'}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              {s.name}
              {s.detail && <small> · {s.detail}</small>}
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
