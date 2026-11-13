import { useEffect, useId, useRef, useState } from 'react'
import { searchPlaces, type CityValue, type PlaceSuggestion } from '../lib/places'

/**
 * Type a city, pick it from the suggestions: that gives its coordinates for the map.
 * A city that isn't in the list can still be typed and kept; it just won't be on the map.
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
}: {
  id: string
  label: string
  value: CityValue
  onChange: (value: CityValue) => void
  placeholder?: string
  hint?: string
  error?: string
  autoFocus?: boolean
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = useRef(false)
  const listId = useId()

  useEffect(() => {
    if (!typed.current) return
    const query = value.name
    if (query.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((found) => {
          setSuggestions(found)
          setActive(-1)
          setOpen(found.length > 0)
        })
        .catch(() => setSuggestions([])) // no suggestions: the typed name still works
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value.name])

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
            }
            // Typing again forgets the picked place's position.
            onChange({ name: e.target.value, country: null, latitude: null, longitude: null })
          }}
          // A tap on a phone blurs the field before the click lands: give it time.
          onBlur={() => setTimeout(() => setOpen(false), 300)}
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
      {open && (
        <ul id={listId} role="listbox" className="suggest">
          {suggestions.map((s, i) => (
            <li
              key={`${s.name}-${s.detail}`}
              id={`${listId}-${i}`}
              role="option"
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
