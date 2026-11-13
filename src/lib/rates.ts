// Exchange rates (build 3). A price in another currency keeps the rate of the day it was typed
// (BR-10): the rate is fetched once to fill the field, then saved with the price and editable.
// Source: open.er-api.com, free and keyless, updated daily; only the two currency codes are sent.
import { useState } from 'react'

const cache = new Map<string, Promise<Record<string, number> | null>>()

function ratesFrom(base: string): Promise<Record<string, number> | null> {
  let hit = cache.get(base)
  if (!hit) {
    hit = fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { result?: string; rates?: Record<string, number> } | null) => (d?.result === 'success' && d.rates ? d.rates : null))
      .catch(() => null)
    hit.then((r) => r === null && cache.delete(base))
    cache.set(base, hit)
  }
  return hit
}

/** What 1 `from` is worth in `to` today, or null when the service can't be reached. */
export async function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1
  const rates = await ratesFrom(from)
  const r = rates?.[to]
  return typeof r === 'number' && r > 0 ? r : null
}

/**
 * Read a rate as typed (review 13 Nov: "1.1531" was refused, money only has 2 decimals).
 * Any number of decimals. "1.153" could be 1,153 or 1 153: the one closer to the rate we
 * showed (today's or the saved one) wins; with nothing to compare, it's a decimal.
 */
export function parseRate(input: string, reference?: number | null): number | null {
  const text = input.trim().replace(/[\s\u00a0\u202f']/g, '')
  if (!/^\d[\d.,]*$/.test(text) || /[.,]$/.test(text)) return null
  const marks = text.match(/[.,]/g) ?? []
  let value: number
  if (marks.length === 0) value = Number(text)
  else if (new Set(marks).size === 2) {
    const at = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','))
    value = Number(`${text.slice(0, at).replace(/[.,]/g, '')}.${text.slice(at + 1)}`)
  } else {
    const parts = text.split(marks[0] ?? ".")
    if (parts.length > 2) {
      if (!parts.slice(1).every((p) => p.length === 3)) return null
      value = Number(parts.join(''))
    } else {
      const [a, b] = parts
      const decimal = Number(`${a}.${b}`)
      value = decimal
      if (b.length === 3 && reference && reference > 0) {
        const thousands = Number(a + b)
        if (Math.abs(Math.log(thousands / reference)) < Math.abs(Math.log(decimal / reference))) value = thousands
      }
    }
  }
  return Number.isFinite(value) && value > 0 ? value : null
}

/** For tests. */
export const clearRates = () => cache.clear()

/**
 * A rate as people read it: four decimals under 100 ("1,1068"), whole above ("3 645").
 * Always four decimals, never three, so "1,234" can't be read as a thousand.
 */
export function formatRate(n: number): string {
  if (n >= 100) return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return n.toFixed(4).replace('.', ',')
}

/**
 * The rate field's state. Saved rates are "trip currency per 1 unit" (0.00027 EUR per COP), but
 * shown the readable way round: "1 EUR = 3 645 COP" when the unit is small, "1 USD = 0,9035 EUR" else.
 */
export function useRate(tripCurrency: string, initialCurrency: string, initialRate: number) {
  const [currency, setCurrencyState] = useState(initialCurrency)
  const [inverted, setInverted] = useState(initialRate < 1)
  const [text, setText] = useState(initialCurrency === tripCurrency ? '' : formatRate(initialRate < 1 ? 1 / initialRate : initialRate))
  const [state, setState] = useState<'idle' | 'saved' | 'loading' | 'failed'>(initialCurrency === tripCurrency ? 'idle' : 'saved')
  // The rate exactly as saved or fetched; typing in the field replaces it.
  const [exact, setExact] = useState<number | null>(initialCurrency === tripCurrency ? 1 : initialRate)
  // The number we showed, to settle "1.153" (a decimal, or thousands?).
  const [shown, setShown] = useState<number | null>(initialCurrency === tripCurrency ? null : initialRate < 1 ? 1 / initialRate : initialRate)

  async function setCurrency(next: string) {
    setCurrencyState(next)
    setExact(null)
    if (next === tripCurrency) {
      setExact(1)
      setText('')
      setState('idle')
      return
    }
    setState('loading')
    const r = await fetchRate(next, tripCurrency)
    if (r === null) {
      setText('')
      setState('failed')
      return
    }
    setInverted(r < 1)
    setText(formatRate(r < 1 ? 1 / r : r))
    setShown(r < 1 ? 1 / r : r)
    setExact(r)
    setState('idle')
  }

  function setTyped(value: string) {
    setText(value)
    setExact(null)
  }

  const typed = text.trim() ? parseRate(text, shown) : null
  const rate =
    currency === tripCurrency
      ? 1
      : exact !== null
        ? exact
        : typed !== null
          ? Math.round((inverted ? 1 / typed : typed) * 1e8) / 1e8
          : null
  /** Something typed that isn't a rate (vs. nothing typed yet). */
  const unreadable = currency !== tripCurrency && exact === null && text.trim() !== '' && typed === null
  return { currency, setCurrency, text, setText: setTyped, inverted, rate, unreadable, state, tripCurrency }
}

export type RateState = ReturnType<typeof useRate>
