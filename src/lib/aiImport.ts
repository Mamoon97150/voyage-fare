// "Import from my AI" (build 8 step 2, mockup import-ai-v5, 15 Nov): the request to give an AI, reading
// its answer (JSON in our format, wherever it sits in the text), and what the preview shows.
// Nothing here talks to the database: the page saves the payload with import_lines.
import type { Json } from './database.types'
import { formatMoney } from './money'
import type { ItemKind, TicketMode, TripDetail } from './trips'

// ── The request ──────────────────────────────────────────────────────────────

export const AI_REQUEST = `I keep my trips in Voyage Fare (an app for the budget of a trip). Write the trip we just planned in the format below, so I can paste it into the app. Answer with the JSON only, nothing before or after it.

{
  "voyage_fare": 1,
  "trip": {
    "name": "Japan in spring",
    "start": "2027-04-02",
    "end": "2027-04-12",
    "from": "Paris",
    "currency": "EUR",
    "travellers": ["Ana", "Bea"]
  },
  "tickets": [
    { "from": "Paris", "to": "Tokyo", "mode": "plane", "day": 1,
      "options": [ { "name": "Air France", "price": 890, "currency": "EUR", "per": "total" } ] }
  ],
  "places": [
    { "name": "Tokyo", "nights": 4,
      "lines": [
        { "type": "stay", "name": "Where we sleep",
          "options": [ { "name": "Hotel Gracery Shinjuku", "price": 160, "currency": "EUR", "per": "night", "link": "https://…", "note": "next to the station" } ] },
        { "type": "activity", "name": "teamLab Planets", "day": 2,
          "options": [ { "name": "teamLab Planets", "price": 32, "currency": "EUR", "per": "person" } ] },
        { "type": "food", "name": "Kikunoi", "day": null, "note": "kaiseki, book ahead" }
      ] }
  ]
}

Rules:
- "start" and "end" are dates (YYYY-MM-DD), or null if we have no dates yet. "from" is where the trip starts and ends.
- type is one of: stay, activity, food, transport, other. mode is one of: plane, train, bus, car, boat.
- price is a number (no symbol); per is "total", "night" or "person". Leave price out if you don't know it: never guess.
- When we hesitated between several, put them all in options. Don't choose for me.
- day is the day of the trip (1 = the first day), or null if it's just an idea for that place.
- A restaurant with no day is kept in "To try".`

// ── Reading the answer ───────────────────────────────────────────────────────

export type Per = 'total' | 'night' | 'person'
export type ImportOption = {
  name: string | null
  price: number | null
  currency: string | null
  per: Per
  link: string | null
  note: string | null
}
export type ImportLine = {
  kind: ItemKind
  name: string
  day: number | null
  note: string | null
  link: string | null
  options: ImportOption[]
}
export type ImportPlace = { name: string; nights: number; lines: ImportLine[] }
export type ImportTicket = {
  from: string
  to: string
  mode: TicketMode
  day: number | null
  note: string | null
  options: ImportOption[]
}
export type ImportTrip = {
  name: string | null
  start: string | null
  end: string | null
  from: string | null
  currency: string | null
  travellers: string[]
}
export type Skipped = { what: string; why: string }
export type ParsedAnswer = {
  trip: ImportTrip
  places: ImportPlace[]
  tickets: ImportTicket[]
  skipped: Skipped[]
}

/** The JSON inside an answer: code fences, text around it, // comments and trailing commas are fine. */
export function findJson(text: string): unknown | null {
  const unfenced = text.replace(/```(?:json)?/gi, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const body = withoutComments(unfenced.slice(start, end + 1)).replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(body.replace(/[“”]/g, '"'))
  } catch {
    return null
  }
}

/** Remove // and /* *\/ comments outside strings (a link's "https://" stays). */
function withoutComments(json: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < json.length; i++) {
    const c = json[i]
    if (inString) {
      out += c
      if (c === '\\') out += json[++i] ?? ''
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
    } else if (c === '/' && json[i + 1] === '/') {
      while (i < json.length && json[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && json[i + 1] === '*') {
      i = json.indexOf('*/', i + 2)
      if (i < 0) break
      i++
    } else out += c
  }
  return out
}

const KIND: Record<string, ItemKind> = {
  stay: 'housing',
  hotel: 'housing',
  housing: 'housing',
  activity: 'activity',
  food: 'restaurant',
  restaurant: 'restaurant',
  transport: 'transport',
  other: 'other',
}
const MODES: TicketMode[] = ['plane', 'train', 'bus', 'car', 'boat']

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const isoDate = (v: unknown): string | null => {
  const s = text(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : null
}
const dayOf = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 400 ? n : null
}
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** A price as a number: 120, "120", "1 200", "120.50"; "120 €" or "about 100" isn't one. */
function priceOf(v: unknown): number | null | 'bad' {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : 'bad'
  if (typeof v === 'string' && /^\d[\d\s]*([.,]\d{1,2})?$/.test(v.trim()))
    return Number(v.trim().replace(/\s/g, '').replace(',', '.'))
  return 'bad'
}

function readOptions(raw: unknown, where: string, skipped: Skipped[]): ImportOption[] | null {
  const options: ImportOption[] = []
  for (const o of list(raw)) {
    const r = obj(o)
    const price = priceOf(r.price ?? r.amount)
    if (price === 'bad') {
      skipped.push({ what: where, why: 'its price isn’t a number' })
      return null
    }
    const per = r.per === 'night' || r.per === 'person' ? r.per : 'total'
    const currency = text(r.currency)?.toUpperCase() ?? null
    options.push({
      name: text(r.name),
      price,
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
      per,
      link: text(r.link)?.startsWith('http') ? text(r.link) : null,
      note: text(r.note),
    })
  }
  return options
}

/** The trip in an AI's answer, or null when there's none we can read. */
export function parseAiAnswer(answer: string): ParsedAnswer | null {
  const root = obj(findJson(answer))
  if (!('places' in root) && !('trip' in root) && !('tickets' in root)) return null
  const skipped: Skipped[] = []
  const t = obj(root.trip)
  const trip: ImportTrip = {
    name: text(t.name),
    start: isoDate(t.start),
    end: isoDate(t.end),
    from: text(t.from),
    currency: text(t.currency)?.toUpperCase() ?? null,
    travellers: list(t.travellers)
      .map(text)
      .filter((n): n is string => Boolean(n)),
  }

  const places: ImportPlace[] = []
  for (const p of list(root.places)) {
    const r = obj(p)
    const name = text(r.name)
    if (!name) {
      skipped.push({ what: 'A place', why: 'it has no name' })
      continue
    }
    const nights = Number.isInteger(Number(r.nights)) && Number(r.nights) >= 0 ? Number(r.nights) : 0
    const lines: ImportLine[] = []
    for (const l of list(r.lines)) {
      const lr = obj(l)
      const lineName = text(lr.name)
      if (!lineName) {
        skipped.push({ what: `${name}: a line`, why: 'it has no name' })
        continue
      }
      const options = readOptions(lr.options, `${name}: ${lineName}`, skipped)
      if (!options) continue
      lines.push({
        kind: KIND[String(lr.type ?? lr.kind ?? '').toLowerCase()] ?? 'other',
        name: lineName,
        day: dayOf(lr.day),
        note: text(lr.note),
        link: text(lr.link)?.startsWith('http') ? text(lr.link) : null,
        options,
      })
    }
    places.push({ name, nights, lines })
  }

  const tickets: ImportTicket[] = []
  for (const k of list(root.tickets)) {
    const r = obj(k)
    const from = text(r.from)
    const to = text(r.to)
    if (!from || !to) {
      skipped.push({ what: 'A ticket', why: 'it doesn’t say from where to where' })
      continue
    }
    const options = readOptions(r.options, `${from} → ${to}`, skipped)
    if (!options) continue
    const mode = String(r.mode ?? '').toLowerCase()
    tickets.push({
      from,
      to,
      mode: (MODES as string[]).includes(mode) ? (mode as TicketMode) : 'other',
      day: dayOf(r.day),
      note: text(r.note),
      options,
    })
  }

  if (!places.length && !tickets.length && !trip.name) return null
  return { trip, places, tickets, skipped }
}

// ── The preview ──────────────────────────────────────────────────────────────

/** "Évora" = "evora": names compared without case or accents. */
export const sameName = (a: string, b: string) => norm(a) === norm(b)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export type PreviewLine = {
  when: string
  name: string
  price: string
  sub: string | null
  there: boolean
}
export type PreviewPlace = { name: string; nights: number; isNew: boolean; lines: PreviewLine[] }
export type ImportPayload = {
  places: { id: string | null; name: string; nights: number; lines: PayloadLine[] }[]
  tickets: {
    from: string
    to: string
    mode: TicketMode
    day: number | null
    note: string | null
    after_place: string | null
    after_new: number | null
    options: PayloadOption[]
  }[]
}
type PayloadOption = {
  name: string | null
  amount: number | null
  currency: string
  rate: number
  link: string | null
  note: string | null
}
type PayloadLine = {
  kind: ItemKind
  name: string
  day: number | null
  note: string | null
  link: string | null
  options: PayloadOption[]
}

export type Preview = {
  places: PreviewPlace[]
  tickets: PreviewLine[]
  newPlaces: number
  newLines: number
  /** What it comes to for each traveller (single-option lines, To try left out). */
  each: number | null
  /** Other currencies and their rate today. */
  rates: { currency: string; rate: number }[]
  missingRates: string[]
  notes: string[]
  payload: ImportPayload
}

/**
 * What will happen. `target` is the trip lines are added to (null: a new trip, in `currency` for
 * `people` travellers). `rates`: 1 unit of each other currency, in the trip's currency, today.
 */
export function planImport(
  parsed: ParsedAnswer,
  target: Pick<TripDetail, 'places' | 'items' | 'legs' | 'travellers'> | null,
  currency: string,
  people: number,
  rates: Record<string, number | null>,
): Preview {
  const money = (n: number) => formatMoney(Math.round(n), currency)
  const notes: string[] = []
  const missingRates = new Set<string>()
  const usedRates = new Map<string, number>()
  let total = 0

  const option = (o: ImportOption, nights: number): PayloadOption => {
    const cur = o.currency ?? currency
    let amount = o.price
    if (amount !== null && o.per === 'night') amount = amount * Math.max(nights, 1)
    if (amount !== null && o.per === 'person') amount = amount * Math.max(people, 1)
    let rate = 1
    if (cur !== currency) {
      const r = rates[cur]
      if (r) {
        rate = r
        usedRates.set(cur, r)
      } else missingRates.add(cur)
    }
    return {
      name: o.name,
      amount: amount === null ? null : Math.round(amount * 100) / 100,
      currency: cur,
      rate,
      link: o.link,
      note: o.note,
    }
  }

  const priceText = (opts: PayloadOption[], toTry: boolean) => {
    if (!opts.length || opts.every((o) => o.amount === null)) return '—'
    const values = opts.filter((o) => o.amount !== null).map((o) => (o.amount as number) * o.rate)
    if (opts.length > 1) return `from ${money(Math.min(...values))}`
    const each = values[0] / Math.max(people, 1)
    return toTry ? `≈ ${money(each)} each` : money(values[0])
  }

  const describe = (opts: PayloadOption[], raw: ImportOption[], nights: number): string | null => {
    if (opts.length > 1)
      return `${opts.length} options to compare: ${opts
        .map((o) => `${o.name ?? '?'} ${o.amount === null ? '—' : formatMoney(Math.round(o.amount), o.currency)}`)
        .join(' · ')}`
    const r = raw[0]
    if (!r || r.price === null) return 'no price: shows a dash until you add one'
    if (r.per === 'night' && nights > 0) return `${nights} nights × ${formatMoney(r.price, r.currency ?? currency)}`
    if (r.per === 'person' && people > 1) return `${people} people × ${formatMoney(r.price, r.currency ?? currency)}`
    return null
  }

  // Places: matched by name when adding to a trip; new ones go at the end of the route.
  const payloadPlaces: ImportPayload['places'] = []
  const previewPlaces: PreviewPlace[] = []
  let newPlaces = 0
  let newLines = 0
  for (const p of parsed.places) {
    const existing = target?.places.find((x) => sameName(x.name, p.name)) ?? null
    const nights = existing?.nights ?? p.nights
    const lines: PayloadLine[] = []
    const shown: PreviewLine[] = []
    const ordered = [...p.lines].sort((a, b) => order(a) - order(b))
    for (const l of ordered) {
      const there = Boolean(
        existing && target?.items.some((i) => i.place_id === existing.id && sameName(i.name, l.name)),
      )
      const opts = l.options.map((o) => option(o, nights))
      const toTry = l.kind === 'restaurant' && l.day === null
      shown.push({
        when: l.kind === 'housing' ? 'Stay' : toTry ? 'To try' : l.day ? `Day ${l.day}` : 'Idea, no day yet',
        name:
          opts.length === 1 && opts[0].name && !sameName(opts[0].name, l.name) ? `${l.name}: ${opts[0].name}` : l.name,
        price: priceText(opts, toTry),
        sub: describe(opts, l.options, nights),
        there,
      })
      if (there) continue
      lines.push({ kind: l.kind, name: l.name, day: l.day, note: l.note, link: l.link, options: opts })
      newLines++
      if (!toTry && opts.length === 1 && opts[0].amount !== null) total += opts[0].amount * opts[0].rate
    }
    if (!existing) newPlaces++
    previewPlaces.push({ name: existing?.name ?? p.name, nights, isNew: !existing, lines: shown })
    if (!existing || lines.length) payloadPlaces.push({ id: existing?.id ?? null, name: p.name, nights, lines })
  }

  // Tickets: placed after the place they leave from (before the first place when they leave home).
  const payloadTickets: ImportPayload['tickets'] = []
  const previewTickets: PreviewLine[] = []
  for (const k of parsed.tickets) {
    const there = Boolean(target?.legs.some((l) => sameName(l.from_name, k.from) && sameName(l.to_name, k.to)))
    const opts = k.options.map((o) => option(o, 0))
    previewTickets.push({
      when: k.day ? `Day ${k.day}` : 'Ticket',
      name: `${k.from} → ${k.to}${opts.length === 1 && opts[0].name ? `: ${opts[0].name}` : ''}`,
      price: priceText(opts, false),
      sub: opts.length > 1 ? describe(opts, k.options, 0) : null,
      there,
    })
    if (there) continue
    const fromIndex = payloadPlaces.findIndex((p) => sameName(p.name, k.from))
    const fromExisting = target?.places.find((p) => sameName(p.name, k.from)) ?? null
    payloadTickets.push({
      from: k.from,
      to: k.to,
      mode: k.mode,
      day: k.day,
      note: k.note,
      after_place: fromExisting?.id ?? null,
      after_new: fromExisting ? null : fromIndex >= 0 ? fromIndex : null,
      options: opts,
    })
    newLines++
    if (opts.length === 1 && opts[0].amount !== null) total += opts[0].amount * opts[0].rate
  }

  const rateList = [...usedRates].map(([c, rate]) => ({ currency: c, rate }))
  for (const { currency: c, rate } of rateList)
    notes.push(
      `Prices in ${c} are saved with today’s rate (1 ${c} = ${formatRate(rate)} ${currency}). You can change it on the line.`,
    )
  if (target && previewPlaces.some((p) => p.isNew))
    notes.push(
      `${previewPlaces
        .filter((p) => p.isNew)
        .map((p) => p.name)
        .join(
          ', ',
        )} ${previewPlaces.filter((p) => p.isNew).length > 1 ? 'go' : 'goes'} at the end of the route: move ${previewPlaces.filter((p) => p.isNew).length > 1 ? 'them' : 'it'} if it’s not the right order.`,
    )
  const kept = [...previewPlaces.flatMap((p) => p.lines), ...previewTickets].filter((l) => l.there)
  if (kept.length)
    notes.push(
      `${kept.length === 1 ? '1 line already there is' : `${kept.length} lines already there are`} left as ${kept.length === 1 ? 'it is' : 'they are'} (yours wins): ${kept.map((l) => l.name).join(', ')}.`,
    )

  return {
    places: previewPlaces,
    tickets: previewTickets,
    newPlaces: target ? newPlaces : parsed.places.length,
    newLines,
    each: total > 0 ? Math.round(total / Math.max(people, 1)) : null,
    rates: rateList,
    missingRates: [...missingRates],
    notes,
    payload: { places: payloadPlaces, tickets: payloadTickets },
  }
}

/** Stay first, then day by day, then ideas, To try last. */
const order = (l: ImportLine) =>
  l.kind === 'housing' ? 0 : l.day !== null ? l.day : l.kind === 'restaurant' ? 2000 : 1000

const formatRate = (r: number) => (r >= 1 ? r.toFixed(2) : r.toPrecision(3)).replace(/\.?0+$/, '')

/** The payload as the database function takes it. */
export const asJson = (p: ImportPayload) => p as unknown as Json
