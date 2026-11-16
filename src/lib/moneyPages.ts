// Budget and Who paid (build 4, mockups budget-v4 / who-paid-v4): what each card says, worked out
// from the trip and its money. The database does the sums (BR-13); this file only picks and words.
import { formatMoney, num } from './money'
import { shortDay } from './tripText'
import type { Item, TripDetail, TripMoney } from './trips'
import { itemLine, itemTitle, leftLine, type Mode } from './tripView'

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

export type MoneyLine = {
  key: string
  name: string
  meta: string
  amount: number | null
  confirmed: number
  estimated: number
  word?: string
}

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
    const names =
      items.length <= 2 && key !== 'package' ? items.map((i) => itemTitle(detail, i).title).join(', ') : null
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
export function placeLines(
  detail: TripDetail,
  viewer: string | null,
  mode: Mode,
): { lines: MoneyLine[]; untied: number; packages: number } {
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
        meta: [nights, split(confirmed, estimated, currency) || null, inPackageWords(covered)]
          .filter(Boolean)
          .join(' · '),
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
  return {
    lines,
    untied: Math.max(0, Math.round((untied - packages) * 100) / 100),
    packages: Math.round(packages * 100) / 100,
  }
}

/** Each traveller's share, with what's only theirs or not theirs (a gift, "just yours: the jet-ski"). */
export function everyoneLines(detail: TripDetail, viewer: string | null) {
  const n = detail.travellers.length
  return detail.travellers.map((t) => {
    const splitItems = detail.items.filter((i) => counted(i) && detail.shares.some((s) => s.item_id === i.id))
    const on = (i: Item) => detail.shares.some((s) => s.item_id === i.id && s.traveller_id === t.id)
    const sharedBy = (i: Item) => detail.shares.filter((s) => s.item_id === i.id).length
    // Not in: what several others share without them (a gift). A line for one person is "just theirs", not news for everyone else.
    const notIn = splitItems
      .filter((i) => !on(i) && sharedBy(i) > 1 && sharedBy(i) < n)
      .map((i) => itemTitle(detail, i).title)
    const only = splitItems.filter((i) => on(i) && sharedBy(i) === 1 && n > 1).map((i) => itemTitle(detail, i).title)
    const you = t.id === viewer
    const meta = [
      you ? 'you' : null,
      only.length ? `just ${you ? 'yours' : 'theirs'}: ${only.slice(0, 2).join(', ')}` : null,
      notIn.length ? `not in: ${notIn.slice(0, 2).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    return {
      id: t.id,
      name: t.name,
      meta,
      amount: num(detail.travellerShares.find((s) => s.traveller_id === t.id)?.share_current),
    }
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

// Who pays together (build 10): a group settles up as one. A "party" is a group, or someone on their own.

export type Party = { key: string; groupId: string | null; members: string[]; name: string }

/** "Djamina & Danielle", "Ana, Bea & Cleo". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/** The groups and the people on their own, in trip order. */
export function parties(detail: TripDetail): Party[] {
  const seen = new Set<string>()
  const list: Party[] = []
  for (const t of detail.travellers) {
    const g = t.pay_group_id ?? null
    if (g) {
      if (seen.has(g)) continue
      seen.add(g)
      const members = detail.travellers.filter((x) => x.pay_group_id === g)
      list.push({ key: g, groupId: g, members: members.map((m) => m.id), name: joinNames(members.map((m) => m.name)) })
    } else list.push({ key: t.id, groupId: null, members: [t.id], name: t.name })
  }
  return list
}

export const hasGroups = (detail: TripDetail) => detail.travellers.some((t) => t.pay_group_id)

function partyOf(detail: TripDetail, travellerId: string | null): Party | undefined {
  return parties(detail).find((p) => travellerId !== null && p.members.includes(travellerId))
}

/** How a party is called to the viewer: "you", "you two", "your group", or its name. */
function partyWords(party: Party | undefined, viewer: string | null): string {
  if (!party) return 'Someone'
  if (viewer && party.members.includes(viewer)) {
    return party.members.length === 1 ? 'you' : party.members.length === 2 ? 'you two' : 'your group'
  }
  return party.name
}

const capital = (w: string) => w.slice(0, 1).toUpperCase() + w.slice(1)

/** The one thing to know first: owed, owe, or square. With a group, it speaks for the group. */
export function headline(detail: TripDetail, money: TripMoney, viewer: string | null) {
  const mine = partyOf(detail, viewer)
  const grouped = Boolean(mine?.groupId)
  const row = grouped ? money.parties?.find((p) => p.group_id === mine?.groupId) : undefined
  const b = money.balances.find((x) => x.traveller_id === viewer)
  const balance = num(grouped ? row?.balance : b?.balance) ?? 0
  const paid = num(grouped ? row?.paid : b?.paid) ?? 0
  const share = num(grouped ? row?.share_of_paid : b?.share_of_paid) ?? 0
  const currency = detail.trip.currency
  const who = grouped ? (mine!.members.length === 2 ? 'You two' : 'Your group') : 'You'
  const words =
    Math.abs(balance) < 0.5
      ? `${who === 'You' ? 'You’re' : `${who} are`} all square`
      : balance > 0
        ? `${who} are owed`
        : `${who} owe`
  return {
    words,
    amount: Math.abs(balance) < 0.5 ? null : Math.abs(balance),
    owed: balance > 0,
    sub: `${who.toLowerCase()} paid ${formatMoney(Math.round(paid), currency)} · your share of it is ${formatMoney(Math.round(share), currency)}`,
  }
}

/** "Danielle pays you", "You pay Bea", "Peggy & Gabriel pay you two". */
export function settleWords(
  detail: TripDetail,
  from: string,
  to: string,
  viewer: string | null,
  groups?: { from?: string | null; to?: string | null },
): string {
  const fromParty = groups?.from ? parties(detail).find((p) => p.groupId === groups.from) : partyOf(detail, from)
  const toParty = groups?.to ? parties(detail).find((p) => p.groupId === groups.to) : partyOf(detail, to)
  const f = partyWords(fromParty, viewer)
  const t = partyWords(toParty, viewer)
  const plural = f.startsWith('you') || (fromParty?.members.length ?? 1) > 1
  return `${capital(f)} ${plural ? 'pay' : 'pays'} ${t}`
}

export function balanceLines(detail: TripDetail, money: TripMoney) {
  const currency = detail.trip.currency
  const words = (paid: number, share: number, repaid = 0, received = 0) =>
    [
      `paid ${formatMoney(Math.round(paid), currency)}`,
      `share ${formatMoney(Math.round(share), currency)}`,
      repaid ? `paid back ${formatMoney(Math.round(repaid), currency)}` : null,
      received ? `got back ${formatMoney(Math.round(received), currency)}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  const tagOf = (balance: number) => (Math.abs(balance) < 0.5 ? 'settled' : balance > 0 ? 'is owed' : 'owes')
  // Groups settle as one: one row per group (build 10).
  if (hasGroups(detail) && money.parties) {
    return parties(detail).map((p) => {
      const row = p.groupId
        ? money.parties!.find((x) => x.group_id === p.groupId)
        : money.parties!.find((x) => x.traveller_id === p.members[0])
      const balance = num(row?.balance) ?? 0
      const tag = tagOf(balance)
      return {
        id: p.key,
        name: p.name,
        members: p.members,
        meta: words(num(row?.paid) ?? 0, num(row?.share_of_paid) ?? 0),
        balance,
        tag: p.members.length > 1 && tag !== 'settled' ? (tag === 'is owed' ? 'are owed' : 'owe') : tag,
      }
    })
  }
  return detail.travellers.map((t) => {
    const b = money.balances.find((x) => x.traveller_id === t.id)
    const balance = num(b?.balance) ?? 0
    return {
      id: t.id,
      name: t.name,
      members: [t.id],
      meta: words(num(b?.paid) ?? 0, num(b?.share_of_paid) ?? 0, num(b?.repaid) ?? 0, num(b?.received) ?? 0),
      balance,
      tag: tagOf(balance),
    }
  })
}

export type BetweenLine = { from: string; to: string; amount: number; words: string; why: string }

/**
 * "Between you two" (option B): inside the viewer's group, who owes whom, netted per pair, with
 * the line(s) it comes from. Only the group's members see it; nothing when it's all square.
 */
export function betweenLines(detail: TripDetail, money: TripMoney, viewer: string | null): BetweenLine[] {
  const mine = partyOf(detail, viewer)
  if (!mine?.groupId) return []
  const rows = (money.between ?? []).filter((r) => r.group_id === mine.groupId)
  const net = new Map<string, number>()
  const why = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.owed_by || !r.owed_to) continue
    const [a, b] = [r.owed_by, r.owed_to].sort()
    const key = `${a}|${b}`
    const signed = (r.owed_by === a ? 1 : -1) * Number(r.amount ?? 0)
    net.set(key, (net.get(key) ?? 0) + signed)
    if (r.item_id) {
      const item = detail.items.find((i) => i.id === r.item_id)
      if (item) why.set(key, [...(why.get(key) ?? []), item.name])
    }
  }
  const name = (id: string) => detail.travellers.find((t) => t.id === id)?.name ?? 'Someone'
  return [...net.entries()].flatMap(([key, value]) => {
    if (Math.abs(value) < 0.5) return []
    const [a, b] = key.split('|')
    const [from, to] = value > 0 ? [a, b] : [b, a]
    const words =
      from === viewer
        ? `You owe ${name(to)}`
        : to === viewer
          ? `${name(from)} owes you`
          : `${name(from)} owes ${name(to)}`
    const items = why.get(key) ?? []
    const paidBy = to === viewer ? 'you' : name(to)
    return [
      {
        from,
        to,
        amount: Math.round(Math.abs(value) * 100) / 100,
        words,
        why: items.length ? `${paidBy} paid ${items.slice(0, 2).join(', ')}${items.length > 2 ? '…' : ''}` : '',
      },
    ]
  })
}

/** What's paid, and how: "paid by you on 1 Sept · split between 3 · 230 $". */
export function paidLines(detail: TripDetail, viewer: string | null) {
  const n = detail.travellers.length
  return detail.items
    .filter((i) => i.status === 'paid')
    .map((i) => {
      const amount = num(detail.amounts.find((a) => a.item_id === i.id)?.actual)
      const sharedBy = detail.shares.filter((s) => s.item_id === i.id).length
      const who = i.paid_each
        ? 'each paid their own share'
        : i.paid_by === viewer
          ? 'paid by you'
          : `paid by ${nameOf(detail, i.paid_by)}`
      const when = i.paid_on && !i.paid_each ? ` on ${shortDay(i.paid_on)}` : ''
      const own =
        i.actual_currency && i.actual_currency !== detail.trip.currency
          ? formatMoney(num(i.actual_amount), i.actual_currency)
          : null
      const meta = [
        `${i.is_cash ? 'cash, ' : ''}${who}${when}`,
        sharedBy && sharedBy < n ? `split between ${sharedBy}` : null,
        own,
      ]
        .filter(Boolean)
        .join(' · ')
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
      amount:
        num((detail.itemLeft ?? []).find((l) => l.item_id === i.id)?.left_to_pay) ??
        num(detail.amounts.find((a) => a.item_id === i.id)?.current),
    }))
    .filter((l) => (l.amount ?? 0) > 0)
}

export type LeftToPay = { id: string; name: string; amount: number; due: string | null; dueIn: number | null }

/** Budget's "What's left to pay": booked lines with something left, soonest first (no date last). */
export function leftToPayLines(
  detail: TripDetail,
  viewer: string | null,
  mode: Mode,
): { lines: LeftToPay[]; total: number; late: number } {
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
  return money.repayments.map((r) => ({
    id: r.id,
    words:
      r.to_traveller === viewer
        ? `${nameOf(detail, r.from_traveller)} paid you back`
        : r.from_traveller === viewer
          ? `You paid ${nameOf(detail, r.to_traveller)} back`
          : `${nameOf(detail, r.from_traveller)} paid ${nameOf(detail, r.to_traveller)} back`,
    meta: [shortDay(r.paid_on), r.note].filter(Boolean).join(' · '),
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
    const what =
      covered[0].kind === 'housing'
        ? 'the stay'
        : covered[0].kind === 'activity'
          ? 'the activity'
          : covered[0].kind === 'restaurant'
            ? 'the meal'
            : 'the transfer'
    return `+ ${what}, in the package`
  }
  return `+ ${covered.length} lines in the package`
}
