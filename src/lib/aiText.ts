// "Copy the trip for my AI" (build 8 step 1, mockup copy-for-ai-v5, 15 Nov): the whole trip as plain
// text with simple headings, to paste into Claude, ChatGPT or any AI. Nothing is sent from the app.
import type { TripMoney } from './data/money'
import { formatMoney } from './money'
import { leftToPayLines } from './moneyPages'
import { isToTry, sourceOf } from './toTry'
import type { Item, TicketMode, TripDetail, TripOption } from './trips'
import { formatDates, plural } from './tripText'
import { daysText, itemTitle, kindLabel, MODES } from './tripView'

export type AiQuestion = { key: string; label: string; text: string }

/** One tap adds a question at the end, so the AI knows what to do (mockup: all four). */
export const AI_QUESTIONS: AiQuestion[] = [
  { key: 'left', label: 'What’s left to book?', text: 'What’s left to book, and what should I book first?' },
  {
    key: 'cheaper',
    label: 'Cheaper ideas',
    text: 'Where could we spend less without losing what matters to us? Suggest cheaper options for the biggest lines.',
  },
  {
    key: 'free',
    label: 'Plan a free day',
    text: 'Which days have nothing planned yet? Suggest what to do on them, close to where we stay.',
  },
  {
    key: 'budget',
    label: 'Check the budget',
    text: 'Check the budget: is anything missing, too low, or counted twice?',
  },
]

export type AiTextOptions = {
  /** Payments, and who owes whom (on by default). */
  whoPaid: boolean
  /** Off: Traveller A, B, C… instead of the names. */
  realNames: boolean
  /** The traveller who is "me", if any. */
  viewer: string | null
  /** For "who owes whom" (Who paid's settlement). */
  money?: TripMoney | null
  question?: string | null
  /** "15 Nov 2026" in the last line; today when left out. */
  today?: string
}

const STATUS: Record<string, string> = { idea: 'idea', chosen: 'chosen', booked: 'booked', paid: 'paid' }

/** The whole trip as text. Pure: the same trip and options always give the same text. */
export function tripForAi(detail: TripDetail, o: AiTextOptions): string {
  const { trip } = detail
  const cur = trip.currency
  const money = (amount: number | null | undefined) =>
    formatMoney(amount === null ? amount : Math.round(amount ?? 0), cur)
  const letters = new Map(detail.travellers.map((t, i) => [t.id, `Traveller ${String.fromCharCode(65 + i)}`]))
  const who = (id: string | null) => {
    const t = detail.travellers.find((x) => x.id === id)
    if (!t) return 'someone'
    return o.realNames ? t.name : (letters.get(t.id) as string)
  }
  const out: string[] = []
  const add = (...lines: string[]) => out.push(...lines)

  // The trip
  add(`# ${trip.name}`)
  const nights = detail.places.reduce((s, p) => s + p.nights, 0)
  add(
    [
      formatDates(trip.start_date, trip.end_date) ?? 'No dates yet',
      nights ? plural(nights, 'night') : null,
      trip.home_city ? `from ${trip.home_city}, back to ${trip.home_city}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  )
  add(`Travellers: ${detail.travellers.map((t) => `${who(t.id)}${t.id === o.viewer ? ' (me)' : ''}`).join(', ')}`)
  add(`Main currency: ${cur}. A price in another currency shows its ${cur} value next to it.`)
  const packages = detail.items.filter((i) => i.kind === 'package' && i.status !== 'dropped')
  add(
    'Statuses: idea → chosen → booked → paid.' +
      (packages.length
        ? ` “In the package” = covered by ${packages.map((p) => itemTitle(detail, p).title).join(', ')}.`
        : ''),
  )

  // The budget
  add('')
  const b = detail.budget
  const mine = detail.travellerShares.find((s) => s.traveller_id === o.viewer)
  if (mine && detail.travellers.length > 1) {
    add(
      `Budget, my share: ${money(Number(mine.share_current))} · ${money(Number(mine.share_confirmed))} confirmed · ${money(Number(mine.share_estimated))} still estimated`,
    )
  }
  if (b) {
    const missing = Number(b.missing_amount_count ?? 0)
    add(
      [
        b.current_total === null ? 'Whole trip: nothing priced yet' : `Whole trip: ${money(Number(b.current_total))}`,
        b.target_total !== null ? `target ${money(Number(b.target_total))}` : null,
        missing ? `${plural(missing, 'line')} with no price yet` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    )
  }

  // One line of the trip
  const line = (item: Item, when: string | null): string[] => {
    const options = detail.options.filter((x) => x.item_id === item.id).sort((a, c) => a.position - c.position)
    const chosen = options.find((x) => x.is_chosen) ?? null
    const { title, decision } = itemTitle(detail, item)
    const legs = detail.legs.filter((l) => l.item_id === item.id).sort((a, c) => a.leg_number - c.leg_number)
    const name = legs.length
      ? `${legs.map((l) => `${l.from_name} → ${l.to_name}`).join(', then ')} · ${MODES[l0(legs)]?.label.toLowerCase() ?? 'ticket'}${chosen ? ` · ${chosen.name}` : ''}`
      : decision
        ? `${decision}: ${title}`
        : title
    const parts = [`${when ? `${when} · ` : ''}${name}`]
    if (!legs.length && !when && item.place_id === null)
      parts[0] = `${kindLabel(item.kind as never, false).label}: ${parts[0]}`
    const priced = chosen ? price(chosen, item) : options.length > 1 ? null : 'no price yet'
    if (priced) parts.push(priced)
    const paidWords =
      item.status === 'paid' && o.whoPaid
        ? item.paid_each
          ? 'paid, each their own'
          : item.paid_by
            ? `paid by ${who(item.paid_by)}`
            : 'paid'
        : null
    if (options.length > 1 && !chosen) parts.push(`still deciding between ${options.length} options`)
    else parts.push(paidWords ?? STATUS[item.status] ?? item.status)
    const order = (id: string) => detail.travellers.findIndex((t) => t.id === id)
    const sharedWith = detail.shares
      .filter((s) => s.item_id === item.id)
      .map((s) => s.traveller_id as string)
      .sort((a, c) => order(a) - order(c))
    if (sharedWith.length && sharedWith.length < detail.travellers.length)
      parts.push(`for ${sharedWith.map((id) => who(id)).join(', ')}`)
    const lines = [`- ${parts.join(' · ')}${item.note ? ` — “${item.note}”` : ''}`]
    const others = options.filter((x) => x !== chosen)
    if (others.length && (chosen || options.length > 1))
      lines.push(
        `    ${chosen ? 'other options' : 'options'}: ${others.map((x) => `${x.name} · ${price(x, item)}${x.is_favourite ? ' ♥' : ''}`).join(' — ')}`,
      )
    return lines
  }
  const l0 = (legs: { mode: string }[]) => legs[0].mode as TicketMode
  const price = (opt: TripOption, item: Item) => {
    if (opt.amount === null) return 'no price yet'
    const amount = Number(opt.amount)
    if (amount === 0) return item.package_id ? 'in the package' : 'free'
    const own = formatMoney(amount, opt.currency)
    return opt.currency === cur ? own : `${own} (≈ ${money(amount * Number(opt.rate))})`
  }
  const live = (i: Item) => i.status !== 'dropped'

  // Getting there and around: the trip's own lines (tickets in route order, then the rest)
  const tripLines = detail.items
    .filter((i) => i.place_id === null && live(i))
    .sort((a, c) => legOrder(a) - legOrder(c) || a.position - c.position)
  function legOrder(i: Item) {
    const leg = detail.legs.find((l) => l.item_id === i.id && l.leg_number === 1)
    if (!leg) return 10_000
    const after = detail.places.find((p) => p.id === leg.after_place_id)?.position ?? 0
    return after * 100 + leg.position
  }
  if (tripLines.length) {
    add('', '## Getting there and around')
    for (const i of tripLines) add(...line(i, null))
  }

  // Each place, in order
  const places = [...detail.places].sort((a, c) => a.position - c.position)
  let before = 0
  const toTry: string[] = []
  for (const p of places) {
    const first = before + 1
    const last = before + Math.max(p.nights, 1)
    before += p.nights
    const dates =
      trip.start_date && p.nights
        ? ` (${daysText({ day_number: first, end_day_number: last + 1 }, trip.start_date)})`
        : p.nights
          ? ` (days ${first}–${last + 1})`
          : ''
    add('', `## ${p.position}. ${p.name} — ${p.nights ? plural(p.nights, 'night') : 'passing through'}${dates}`)
    const items = detail.items.filter((i) => i.place_id === p.id && live(i))
    const stays = items.filter((i) => i.kind === 'housing')
    const days = items
      .filter((i) => i.kind !== 'housing' && i.day_number)
      .sort((a, c) => (a.day_number ?? 0) - (c.day_number ?? 0) || a.position - c.position)
    const ideas = items.filter((i) => i.kind !== 'housing' && !i.day_number && !isToTry(i, detail.options))
    for (const i of stays) add(...line(i, 'Stay'))
    for (const i of days) add(...line(i, `Day ${i.day_number}${i.meal ? ` · ${i.meal}` : ''}`))
    for (const i of ideas) add(...line(i, 'Idea, no day yet'))
    if (!items.length) add('- Nothing planned yet')
    for (const i of items.filter((x) => isToTry(x, detail.options))) {
      const src = sourceOf(i.link)
      const opt = detail.options.find((x) => x.item_id === i.id)
      const each =
        opt?.amount !== null && opt?.amount !== undefined
          ? `≈ ${money((Number(opt.amount) * Number(opt.rate)) / Math.max(detail.travellers.length, 1))} each`
          : null
      toTry.push(
        `- ${p.name}: ${[
          i.name,
          src ? `${src.label}${src.handle ? `, ${src.handle}` : ''}` : null,
          i.note ? `“${i.note}”` : null,
          each,
        ]
          .filter(Boolean)
          .join(' · ')}`,
      )
    }
  }

  if (toTry.length) add('', '## To try (restaurants and activities kept for later, not counted yet)', ...toTry)

  // What's left
  const undecided = detail.items.filter(
    (i) =>
      live(i) &&
      !isToTry(i, detail.options) &&
      detail.options.filter((x) => x.item_id === i.id).length > 1 &&
      !detail.options.some((x) => x.item_id === i.id && x.is_chosen),
  )
  const left = leftToPayLines(detail, o.viewer, 'total')
  add('', '## Still to decide or pay')
  add(
    undecided.length
      ? `- ${plural(undecided.length, 'decision')} left: ${undecided.map((i) => `${i.name} (${detail.options.filter((x) => x.item_id === i.id).length} options)`).join(', ')}`
      : '- Nothing left to decide',
  )
  add(
    left.lines.length
      ? `- Left to pay: ${money(left.total)} — ${left.lines.map((l) => `${l.name} ${money(l.amount)}${l.due ? ` by ${l.due}` : ''}`).join(', ')}`
      : '- Left to pay: nothing',
  )

  // Who owes whom
  if (o.whoPaid && o.money && detail.travellers.length > 1) {
    add('', '## Who owes whom')
    add(
      ...(o.money.settlement.length
        ? o.money.settlement.map((s) => `- ${who(s.from_traveller)} pays ${who(s.to_traveller)} ${money(s.amount)}`)
        : ['- Everyone is square']),
    )
  }

  const today =
    o.today ?? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())
  add('', '---', `Copied from Voyage Fare (voyagefare.app) on ${today}.`)
  if (o.question) add('', `Question: ${o.question}`)
  return out.join('\n')
}

/** "≈ 2 pages · 39 lines": how long the copied text is. */
export function aiTextSize(text: string): string {
  const lines = text.split('\n').length
  const pages = Math.max(1, Math.round(lines / 45))
  return `≈ ${plural(pages, 'page')} · ${lines} lines`
}
