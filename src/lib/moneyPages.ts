// Budget and Who paid (build 4, mockups budget-v4 / who-paid-v4): what each card says, worked out
// from the trip and its money. The database does the sums (BR-13); this file only picks and words.
import { formatMoney } from './money'
import type { Item, TripDetail, TripMoney } from './trips'
import { itemLine, itemTitle, leftLine, type Mode } from './tripView'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'main_transport', label: 'Travel' },
  { key: 'accommodation', label: 'Stay' },
  { key: 'local_transport', label: 'Getting around' },
  { key: 'activities', label: 'Activities' },
  { key: 'food', label: 'Food' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'package', label: 'Package' },
  { key: 'buffer', label: 'Other' },
]

export type MoneyLine = { key: string; name: string; meta: string; amount: number | null; confirmed: number; estimated: number; word?: string }

/** "67 € confirmed · 255 € estimated", "18 € estimated", "" */
function split(confirmed: number, estimated: number, currency: string): string {
  return [
    confirmed > 0 ? `${formatMoney(Math.round(confirmed), currency)} confirmed` : null,
    estimated > 0 ? `${formatMoney(Math.round(estimated), currency)} estimated` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const priced = (detail: TripDetail, item: Item) =>
  detail.options.find((o) => o.item_id === item.id && o.is_chosen && o.amount !== null) !== undefined
const unpriced = (detail: TripDetail, item: Item) =>
  item.status !== 'dropped' && detail.options.some((o) => o.item_id === item.id && o.is_chosen) && !priced(detail, item)
const counted = (item: Item) => item.status !== 'dropped' && item.status !== 'idea'

/** Your share (or the whole trip) by category: biggest first; "Included" and "Free" at the end. */
export function categoryLines(detail: TripDetail, money: TripMoney, viewer: string | null, mode: Mode): MoneyLine[] {
  const rows =
    mode === 'mine' && viewer ? money.travellerCategories.filter((r) => r.traveller_id === viewer) : money.categories
  const currency = detail.trip.currency
  const lines = CATEGORIES.flatMap(({ key, label }) => {
    const row = rows.find((r) => r.category === key)
    const items = detail.items.filter((i) => i.category === key && counted(i))
    if (!row && items.length === 0) return []
    const confirmed = num(row?.confirmed) ?? 0
    const estimated = num(row?.estimated) ?? 0
    const amount = num(row?.current)
    const missing = items.filter((i) => unpriced(detail, i)).length
    const names = items.length <= 2 && key !== 'package' ? items.map((i) => itemTitle(detail, i).title).join(', ') : null
    const zero = amount === 0 || (amount === null && missing === 0)
    // Every line here is in a package (build 6): say so, not a misleading 0 €.
    const inPackage = items.length > 0 && items.every((i) => i.package_id)
    const word =
      zero && items.length > 0
        ? inPackage
          ? 'in the package'
          : items.every((i) => i.status === 'booked' || i.status === 'paid')
            ? 'Included'
            : 'Free'
        : undefined
    const meta = [
      key === 'package' ? packageCovers(detail) : names,
      split(confirmed, estimated, currency) || null,
      missing ? `${missing} without a price` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    return [{ key, name: label, meta, amount, confirmed, estimated, word }]
  })
  return lines.sort((a, b) => Number(Boolean(a.word)) - Number(Boolean(b.word)) || (b.amount ?? 0) - (a.amount ?? 0))
}

/** Your share (or the whole trip) by place, and what isn't tied to a place (BR-9: no total here). */
export function placeLines(detail: TripDetail, viewer: string | null, mode: Mode): { lines: MoneyLine[]; untied: number; packages: number } {
  const currency = detail.trip.currency
  const mine = mode === 'mine' && viewer
  const lines = [...detail.places]
    .sort((a, b) => a.position - b.position)
    .map((p) => {
      const row = mine
        ? detail.travellerPlaceTotals.find((r) => r.place_id === p.id && r.traveller_id === viewer)
        : detail.placeTotals.find((r) => r.place_id === p.id)
      const confirmed = num(row?.confirmed) ?? 0
      const estimated = num(row?.estimated) ?? 0
      const nights = p.nights ? `${p.nights} ${p.nights === 1 ? 'night' : 'nights'}` : null
      const covered = detail.items.filter((i) => i.place_id === p.id && i.package_id && i.status !== 'dropped')
      return {
        key: p.id,
        name: p.name,
        meta: [nights, split(confirmed, estimated, currency) || null, inPackageWords(covered)].filter(Boolean).join(' · '),
        amount: num(row?.current),
        confirmed,
        estimated,
      }
    })
  const total = mine
    ? num(detail.travellerShares.find((s) => s.traveller_id === viewer)?.share_current)
    : num(detail.budget?.current_total)
  const placed = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0)
  // The packages' part of what isn't tied to a place (build 6): said apart, once for the whole trip.
  const packages = detail.items
    .filter((i) => i.kind === 'package' && counted(i))
    .reduce((sum, i) => sum + (itemLine(detail, i, viewer, mode).amount ?? 0), 0)
  const untied = Math.max(0, Math.round(((total ?? 0) - placed) * 100) / 100)
  return { lines, untied: Math.max(0, Math.round((untied - packages) * 100) / 100), packages: Math.round(packages * 100) / 100 }
}

/** Each traveller's share, with what's only theirs or not theirs (a gift, "just yours: the jet-ski"). */
export function everyoneLines(detail: TripDetail, viewer: string | null) {
  const n = detail.travellers.length
  return detail.travellers.map((t) => {
    const splitItems = detail.items.filter((i) => counted(i) && detail.shares.some((s) => s.item_id === i.id))
    const on = (i: Item) => detail.shares.some((s) => s.item_id === i.id && s.traveller_id === t.id)
    const sharedBy = (i: Item) => detail.shares.filter((s) => s.item_id === i.id).length
    // Not in: what several others share without them (a gift). A line for one person is "just theirs", not news for everyone else.
    const notIn = splitItems.filter((i) => !on(i) && sharedBy(i) > 1 && sharedBy(i) < n).map((i) => itemTitle(detail, i).title)
    const only = splitItems.filter((i) => on(i) && sharedBy(i) === 1 && n > 1).map((i) => itemTitle(detail, i).title)
    const you = t.id === viewer
    const meta = [
      you ? 'you' : null,
      only.length ? `just ${you ? 'yours' : 'theirs'}: ${only.slice(0, 2).join(', ')}` : null,
      notIn.length ? `not in: ${notIn.slice(0, 2).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    return { id: t.id, name: t.name, meta, amount: num(detail.travellerShares.find((s) => s.traveller_id === t.id)?.share_current) }
  })
}

/** Chosen, but no price yet: not counted (BR-4). */
export function notCounted(detail: TripDetail): string[] {
  // In trip order: place by place, day by day.
  const where = (i: Item) => detail.places.find((p) => p.id === i.place_id)?.position ?? Number.MAX_SAFE_INTEGER
  return detail.items
    .filter((i) => unpriced(detail, i))
    .sort((a, b) => where(a) - where(b) || (a.day_number ?? 99) - (b.day_number ?? 99) || a.position - b.position)
    .map((i) => itemTitle(detail, i).title)
}

// ── Who paid ────────────────────────────────────────────────────────────────

const nameOf = (detail: TripDetail, id: string | null) => detail.travellers.find((t) => t.id === id)?.name ?? 'Someone'

/** The one thing to know first: owed, owe, or square. */
export function headline(detail: TripDetail, money: TripMoney, viewer: string | null) {
  const b = money.balances.find((x) => x.traveller_id === viewer)
  const balance = num(b?.balance) ?? 0
  const paid = num(b?.paid) ?? 0
  const share = num(b?.share_of_paid) ?? 0
  const currency = detail.trip.currency
  const words = Math.abs(balance) < 0.5 ? 'You’re all square' : balance > 0 ? 'You are owed' : 'You owe'
  return {
    words,
    amount: Math.abs(balance) < 0.5 ? null : Math.abs(balance),
    owed: balance > 0,
    sub: `you paid ${formatMoney(Math.round(paid), currency)} · your share of it is ${formatMoney(Math.round(share), currency)}`,
  }
}

/** "Danielle pays you", "You pay Bea", "Cleo pays Bea". */
export function settleWords(detail: TripDetail, from: string, to: string, viewer: string | null): string {
  if (from === viewer) return `You pay ${nameOf(detail, to)}`
  if (to === viewer) return `${nameOf(detail, from)} pays you`
  return `${nameOf(detail, from)} pays ${nameOf(detail, to)}`
}

export function balanceLines(detail: TripDetail, money: TripMoney) {
  return detail.travellers.map((t) => {
    const b = money.balances.find((x) => x.traveller_id === t.id)
    const balance = num(b?.balance) ?? 0
    const paid = num(b?.paid) ?? 0
    const share = num(b?.share_of_paid) ?? 0
    const repaid = num(b?.repaid) ?? 0
    const received = num(b?.received) ?? 0
    const currency = detail.trip.currency
    const meta = [
      `paid ${formatMoney(Math.round(paid), currency)}`,
      `share ${formatMoney(Math.round(share), currency)}`,
      repaid ? `paid back ${formatMoney(Math.round(repaid), currency)}` : null,
      received ? `got back ${formatMoney(Math.round(received), currency)}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    const tag = Math.abs(balance) < 0.5 ? 'settled' : balance > 0 ? 'is owed' : 'owes'
    return { id: t.id, name: t.name, meta, balance, tag }
  })
}

/** What's paid, and how: "paid by you on 1 Sept · split between 3 · 230 $". */
export function paidLines(detail: TripDetail, viewer: string | null) {
  const n = detail.travellers.length
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return detail.items
    .filter((i) => i.status === 'paid')
    .map((i) => {
      const amount = num(detail.amounts.find((a) => a.item_id === i.id)?.actual)
      const sharedBy = detail.shares.filter((s) => s.item_id === i.id).length
      const who = i.paid_each ? 'each paid their own share' : i.paid_by === viewer ? 'paid by you' : `paid by ${nameOf(detail, i.paid_by)}`
      const when = i.paid_on && !i.paid_each ? ` on ${day.format(new Date(`${i.paid_on}T00:00:00Z`))}` : ''
      const own = i.actual_currency && i.actual_currency !== detail.trip.currency ? formatMoney(num(i.actual_amount), i.actual_currency) : null
      const meta = [`${who}${when}`, sharedBy && sharedBy < n ? `split between ${sharedBy}` : null, own].filter(Boolean).join(' · ')
      return { id: i.id, name: itemTitle(detail, i).title, meta, amount }
    })
}

/** Booked, not paid (yet): what's left on each line. Lines inside a package (0) aren't money. */
export function bookedLines(detail: TripDetail) {
  return detail.items
    .filter((i) => i.status === 'booked')
    .map((i) => ({
      id: i.id,
      name: itemTitle(detail, i).title,
      amount: num((detail.itemLeft ?? []).find((l) => l.item_id === i.id)?.left_to_pay) ?? num(detail.amounts.find((a) => a.item_id === i.id)?.current),
    }))
    .filter((l) => (l.amount ?? 0) > 0)
}

export type LeftToPay = { id: string; name: string; amount: number; due: string | null; dueIn: number | null }

/** Budget's "What's left to pay": booked lines with something left, soonest first (no date last). */
export function leftToPayLines(detail: TripDetail, viewer: string | null, mode: Mode): { lines: LeftToPay[]; total: number; late: number } {
  const lines = detail.items
    .filter((i) => i.status === 'booked' || i.status === 'paid')
    .flatMap((i) => {
      const l = leftLine(detail, i, viewer, mode)
      if (!l || l.left <= 0 || l.leftShown <= 0) return []
      return [{ id: i.id, name: itemTitle(detail, i).title, amount: l.leftShown, due: l.due, dueIn: l.dueIn }]
    })
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  return {
    lines,
    total: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    late: lines.filter((l) => l.dueIn !== null && l.dueIn < 0).length,
  }
}

export function repaymentLines(detail: TripDetail, money: TripMoney, viewer: string | null) {
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return money.repayments.map((r) => ({
    id: r.id,
    words:
      r.to_traveller === viewer
        ? `${nameOf(detail, r.from_traveller)} paid you back`
        : r.from_traveller === viewer
          ? `You paid ${nameOf(detail, r.to_traveller)} back`
          : `${nameOf(detail, r.from_traveller)} paid ${nameOf(detail, r.to_traveller)} back`,
    meta: [day.format(new Date(`${r.paid_on}T00:00:00Z`)), r.note].filter(Boolean).join(' · '),
    amount: Number(r.amount),
  }))
}

const COVER_CATEGORY: Record<string, string> = {
  main_transport: 'Travel',
  accommodation: 'Stay',
  local_transport: 'Getting around',
  activities: 'Activities',
  food: 'Food',
  insurance: 'Insurance',
  buffer: 'Other',
}

/** The Package category's meta: "covers Travel · Stay · Getting around". */
function packageCovers(detail: TripDetail): string | null {
  const cats = new Set(detail.items.filter((i) => i.package_id && i.status !== 'dropped').map((i) => i.category))
  const words = CATEGORIES.filter((c) => cats.has(c.key)).map((c) => COVER_CATEGORY[c.key])
  return words.length ? `covers ${words.join(' · ')}` : null
}

/** "+ the stay, in the package", "+ 3 lines in the package" (by place). */
function inPackageWords(covered: Item[]): string | null {
  if (covered.length === 0) return null
  if (covered.length === 1) {
    const what = covered[0].kind === 'housing' ? 'the stay' : covered[0].kind === 'activity' ? 'the activity' : covered[0].kind === 'restaurant' ? 'the meal' : 'the transfer'
    return `+ ${what}, in the package`
  }
  return `+ ${covered.length} lines in the package`
}
