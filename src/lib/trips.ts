import type { Json, Tables } from './database.types'
import { supabase } from './supabase'

export type Trip = Tables<'trips'>
export type Traveller = Tables<'travellers'>
export type Place = Tables<'places'>

export type TripSummary = Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date' | 'created_at'> & {
  travellers: number
  places: number
  nights: number
}

export type NewTrip = {
  name: string
  me: string
  travellers: string[]
  startDate: string | null
  endDate: string | null
  homeCity: string | null
  homeLatitude: number | null
  homeLongitude: number | null
  currency: string
  targetAmount: number | null
  targetScope: 'per_person' | 'total'
}

/** All in one step in the database: the trip, you, and the other travellers. */
export async function createTrip(trip: NewTrip): Promise<string> {
  const { data, error } = await supabase.rpc('create_trip', {
    p_name: trip.name,
    p_me: trip.me,
    p_travellers: trip.travellers,
    p_start_date: trip.startDate ?? undefined,
    p_end_date: trip.endDate ?? undefined,
    p_home_city: trip.homeCity ?? undefined,
    p_home_latitude: trip.homeLatitude ?? undefined,
    p_home_longitude: trip.homeLongitude ?? undefined,
    p_currency: trip.currency,
    p_target_amount: trip.targetAmount ?? undefined,
    p_target_scope: trip.targetScope,
  })
  if (error) throw error
  return data
}

export async function listTrips(): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, name, start_date, end_date, created_at, travellers!travellers_trip_id_fkey(id), places!places_trip_id_fkey(nights)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    end_date: t.end_date,
    created_at: t.created_at,
    travellers: t.travellers.length,
    places: t.places.length,
    nights: t.places.reduce((sum, p) => sum + p.nights, 0),
  }))
}

export type Item = Tables<'items'>
export type TripOption = Tables<'options'>
export type Room = Tables<'rooms'>
export type RoomOccupant = Tables<'room_occupants'>
export type Leg = Tables<'item_legs'>
export type ItemAmount = Tables<'v_item_amounts'>
export type DailyEstimate = Tables<'daily_estimates'>
export type EstimatePeople = Tables<'v_daily_estimate_people'>
export type EstimateCheck = Tables<'v_daily_estimate_checks'>
export type ItemShare = Tables<'v_item_shares'>
export type TripBudget = Tables<'v_trip_budget'>
export type TravellerShare = Tables<'v_traveller_shares'>
export type PlaceTotal = Tables<'v_budget_by_place'>
export type TravellerPlaceTotal = Tables<'v_traveller_by_place'>

export type TripDetail = {
  trip: Trip
  travellers: Traveller[]
  places: Place[]
  items: Item[]
  options: TripOption[]
  legs: Leg[]
  amounts: ItemAmount[]
  shares: ItemShare[]
  budget: TripBudget | null
  travellerShares: TravellerShare[]
  placeTotals: PlaceTotal[]
  travellerPlaceTotals: TravellerPlaceTotal[]
  /** A stay's option by room (SR-4): each room, and who sleeps in it. */
  rooms: Room[]
  roomOccupants: RoomOccupant[]
  /** Daily estimates (build 6), who they're for, and whether their days still fit. */
  dailyEstimates: DailyEstimate[]
  estimatePeople: EstimatePeople[]
  estimateChecks: EstimateCheck[]
}

/** null when the trip doesn't exist or isn't shared with this person (privacy hides both the same way). */
export async function getTrip(id: string): Promise<TripDetail | null> {
  const [trip, travellers, places, items, options, legs, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals, rooms, roomOccupants, dailyEstimates, estimatePeople, estimateChecks] =
    await Promise.all([
      supabase.from('trips').select('*').eq('id', id).maybeSingle(),
      supabase.from('travellers').select('*').eq('trip_id', id).order('position'),
      supabase.from('places').select('*').eq('trip_id', id).order('position'),
      supabase.from('items').select('*').eq('trip_id', id).order('position'),
      supabase.from('options').select('*').eq('trip_id', id).order('position'),
      supabase.from('item_legs').select('*').eq('trip_id', id).order('position'),
      supabase.from('v_item_amounts').select('*').eq('trip_id', id),
      supabase.from('v_item_shares').select('*').eq('trip_id', id),
      supabase.from('v_trip_budget').select('*').eq('trip_id', id).maybeSingle(),
      supabase.from('v_traveller_shares').select('*').eq('trip_id', id),
      supabase.from('v_budget_by_place').select('*').eq('trip_id', id),
      supabase.from('v_traveller_by_place').select('*').eq('trip_id', id),
      supabase.from('rooms').select('*').eq('trip_id', id).order('position'),
      supabase.from('room_occupants').select('*').eq('trip_id', id),
      supabase.from('daily_estimates').select('*').eq('trip_id', id).order('label'),
      supabase.from('v_daily_estimate_people').select('*').eq('trip_id', id),
      supabase.from('v_daily_estimate_checks').select('*').eq('trip_id', id),
    ])
  for (const r of [trip, travellers, places, items, options, legs, amounts, shares, budget, travellerShares, placeTotals, travellerPlaceTotals, rooms, roomOccupants, dailyEstimates, estimatePeople, estimateChecks]) {
    if (r.error) throw r.error
  }
  if (!trip.data) return null
  return {
    trip: trip.data,
    travellers: travellers.data ?? [],
    places: places.data ?? [],
    items: items.data ?? [],
    options: options.data ?? [],
    legs: legs.data ?? [],
    amounts: amounts.data ?? [],
    shares: shares.data ?? [],
    budget: budget.data,
    travellerShares: travellerShares.data ?? [],
    placeTotals: placeTotals.data ?? [],
    travellerPlaceTotals: travellerPlaceTotals.data ?? [],
    rooms: rooms.data ?? [],
    roomOccupants: roomOccupants.data ?? [],
    dailyEstimates: dailyEstimates.data ?? [],
    estimatePeople: estimatePeople.data ?? [],
    estimateChecks: estimateChecks.data ?? [],
  }
}

export type CategoryTotal = Tables<'v_budget_by_category'>
export type TravellerCategoryTotal = Tables<'v_traveller_by_category'>
export type Balance = Tables<'v_traveller_balances'>
export type Repayment = Tables<'repayments'>
export type Settlement = { from_traveller: string; to_traveller: string; amount: number }

/** The money side of a trip (build 4): Budget's categories, Who paid's balances and payments. */
export type TripMoney = {
  categories: CategoryTotal[]
  travellerCategories: TravellerCategoryTotal[]
  balances: Balance[]
  settlement: Settlement[]
  repayments: Repayment[]
}

export async function getMoney(tripId: string): Promise<TripMoney> {
  const [categories, travellerCategories, balances, settlement, repayments] = await Promise.all([
    supabase.from('v_budget_by_category').select('*').eq('trip_id', tripId),
    supabase.from('v_traveller_by_category').select('*').eq('trip_id', tripId),
    supabase.from('v_traveller_balances').select('*').eq('trip_id', tripId),
    supabase.rpc('trip_settlement', { p_trip_id: tripId }),
    supabase.from('repayments').select('*').eq('trip_id', tripId).order('paid_on'),
  ])
  for (const r of [categories, travellerCategories, balances, settlement, repayments]) {
    if (r.error) throw r.error
  }
  return {
    categories: categories.data ?? [],
    travellerCategories: travellerCategories.data ?? [],
    balances: balances.data ?? [],
    settlement: (settlement.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })),
    repayments: repayments.data ?? [],
  }
}

/** One traveller paid another back (SR-8: in the trip's main currency). */
export async function addRepayment(r: { tripId: string; from: string; to: string; amount: number; paidOn: string; note?: string | null }): Promise<void> {
  const { error } = await supabase.from('repayments').insert({
    trip_id: r.tripId,
    from_traveller: r.from,
    to_traveller: r.to,
    amount: r.amount,
    paid_on: r.paidOn,
    note: r.note ?? null,
  })
  if (error) throw error
}

export async function deleteRepayment(id: string): Promise<void> {
  const { error } = await supabase.from('repayments').delete().eq('id', id)
  if (error) throw error
}

export type ItemKind = 'transport' | 'housing' | 'activity' | 'restaurant' | 'car_rental' | 'insurance' | 'other'

/** One step in the database: the item, and with a price its single chosen option. */
export async function addItem(item: {
  tripId: string
  placeId: string | null
  kind: ItemKind
  name: string
  dayNumber: number | null
  endDayNumber: number | null
  amount: number | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_item', {
    p_trip_id: item.tripId,
    p_kind: item.kind,
    p_name: item.name,
    p_place_id: item.placeId ?? undefined,
    p_day_number: item.dayNumber ?? undefined,
    p_end_day_number: item.endDayNumber ?? undefined,
    p_amount: item.amount ?? undefined,
  })
  if (error) throw error
  return data
}

export type TicketMode = 'plane' | 'train' | 'bus' | 'car' | 'boat' | 'other'

/** One step in the database: one transport item, one price, 1 or 2 legs placed in the route. */
export async function addTicket(ticket: {
  tripId: string
  from: string
  to: string
  mode: TicketMode
  name: string | null
  via: string | null
  afterPlaceId: string | null
  roundTrip: boolean
  returnAfterPlaceId: string | null
  amount: number | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_ticket', {
    p_trip_id: ticket.tripId,
    p_from: ticket.from,
    p_to: ticket.to,
    p_mode: ticket.mode,
    p_name: ticket.name ?? undefined,
    p_via: ticket.via ?? undefined,
    p_after_place_id: ticket.afterPlaceId ?? undefined,
    p_round_trip: ticket.roundTrip,
    p_return_after_place_id: ticket.returnAfterPlaceId ?? undefined,
    p_amount: ticket.amount ?? undefined,
  })
  if (error) throw error
  return data
}

export async function addPlace(place: {
  tripId: string
  name: string
  country: string | null
  latitude: number | null
  longitude: number | null
  nights: number
  position: number
}): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .insert({
      trip_id: place.tripId,
      name: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      nights: place.nights,
      position: place.position,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Changing and removing (each one step in the database) ─────────────────────

export async function updateItem(item: {
  id: string
  kind: ItemKind
  name: string
  dayNumber: number | null
  endDayNumber: number | null
  amount: number | null
  /** With several options the price is the chosen option's: leave it alone. */
  keepPrice?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('update_item', {
    p_item_id: item.id,
    p_kind: item.kind,
    p_name: item.name,
    p_day_number: item.dayNumber ?? undefined,
    p_end_day_number: item.endDayNumber ?? undefined,
    p_amount: item.amount ?? undefined,
    p_keep_price: item.keepPrice ?? false,
  })
  if (error) throw error
}

/** Until the first payment (decision 12 Nov). rate: what 1 unit of the current currency is worth in the new one. */
export async function changeTripCurrency(tripId: string, currency: string, rate: number): Promise<void> {
  const { error } = await supabase.rpc('change_trip_currency', { p_trip_id: tripId, p_currency: currency, p_rate: rate })
  if (error) throw error
}

/** Dropped: kept for the record, out of the budget and the dots. Choosing an option brings it back. */
export async function setItemDropped(id: string, dropped: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_item_dropped', { p_item_id: id, p_dropped: dropped })
  if (error) throw error
}

/** Who shares a line (SR-3): some travellers, or everyone (all of them, or an empty list). */
export async function setItemSplit(id: string, travellers: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_item_split', { p_item_id: id, p_travellers: travellers })
  if (error) throw error
}

export type ItemStatus = 'chosen' | 'booked' | 'paid'

/** Booked or paid, with what was really paid; paid also says who paid (BR-2, BR-3). */
export async function setItemStatus(change: {
  id: string
  status: ItemStatus
  actualAmount: number | null
  paidBy: string | null
  paidOn?: string | null
  /** Another currency than the trip's, with the rate saved now (trip currency per 1 unit). */
  actualCurrency?: string
  actualRate?: number
  /** Everyone on the line paid their own share (build 4): counts as paid, no debts. */
  paidEach?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('set_item_status', {
    p_paid_each: change.paidEach ?? false,
    p_actual_currency: change.actualCurrency,
    p_actual_rate: change.actualRate,
    p_item_id: change.id,
    p_status: change.status,
    p_actual_amount: change.actualAmount ?? undefined,
    p_paid_by: change.paidBy ?? undefined,
    p_paid_on: change.paidOn ?? undefined,
  })
  if (error) throw error
}

export type TicketChange = {
  from: string
  to: string
  mode: TicketMode
  via: string | null
  afterPlaceId: string | null
  roundTrip: boolean
  returnAfterPlaceId: string | null
  amount: number | null
}

/** keepPrice: the price lives in Compare (several options, or one in another currency). */
export async function updateTicket(itemId: string, ticket: TicketChange, keepPrice = false): Promise<void> {
  const { error } = await supabase.rpc('update_ticket', {
    p_item_id: itemId,
    p_from: ticket.from,
    p_to: ticket.to,
    p_mode: ticket.mode,
    p_via: ticket.via ?? undefined,
    p_after_place_id: ticket.afterPlaceId ?? undefined,
    p_round_trip: ticket.roundTrip,
    p_return_after_place_id: ticket.returnAfterPlaceId ?? undefined,
    p_amount: ticket.amount ?? undefined,
    p_keep_price: keepPrice,
  })
  if (error) throw error
}

/** An item (or a ticket, with its legs) and its price go together. */
export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

export async function updatePlace(id: string, change: { name: string; nights: number }): Promise<void> {
  const { error } = await supabase.from('places').update(change).eq('id', id)
  if (error) throw error
}

/** The place and its items; tickets after it move up in the route. */
export async function deletePlace(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_place', { p_place_id: id })
  if (error) throw error
}

// ── Trip settings (mockup 8) ───────────────────────────────────────────────────

export type TripChange = {
  name: string
  startDate: string | null
  endDate: string | null
  homeCity: string | null
  homeLatitude: number | null
  homeLongitude: number | null
  targetAmount: number | null
  targetScope: 'per_person' | 'total'
}

export async function updateTrip(id: string, change: TripChange): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({
      name: change.name,
      start_date: change.startDate,
      end_date: change.endDate,
      home_city: change.homeCity,
      home_latitude: change.homeLatitude,
      home_longitude: change.homeLongitude,
      target_amount: change.targetAmount,
      target_scope: change.targetScope,
    })
    .eq('id', id)
  if (error) throw error
}

/** Only the person who created a trip can delete it (13 Nov decision). */
export async function isTripOwner(tripId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role === 'owner'
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}

export async function addTraveller(tripId: string, name: string, position: number): Promise<void> {
  const { error } = await supabase.from('travellers').insert({ trip_id: tripId, name, position })
  if (error) throw error
}

export async function renameTraveller(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('travellers').update({ name }).eq('id', id)
  if (error) throw error
}

/** Refused with a reason when they paid or owe, are you, are the last one, or are alone on an item. */
export async function removeTraveller(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_traveller', { p_traveller_id: id })
  if (error) throw error
}

// ── Options: compare, choose, coup de cœur (build 3) ───────────────────────────

export type RoomInput = { name: string; amount: number; occupants: string[] }

export type OptionInput = {
  name: string
  amount: number | null
  /** A stay by room (SR-4): its rooms, or null for one price. Left out: the rooms aren't touched. */
  rooms?: RoomInput[] | null
  /** The price's own currency and the rate saved when it was typed (BR-10). Default: the trip's, 1. */
  currency?: string
  rate?: number
  details: Json
  link: string | null
  note: string | null
}

/**
 * Add a candidate to an item. The first option of an item is chosen right away (like adding an
 * item with a price); the next ones wait until you choose. Priced in the trip currency until
 * currencies arrive (rate 1).
 */
export async function addOption(detail: TripDetail, itemId: string, input: OptionInput): Promise<string> {
  const siblings = detail.options.filter((o) => o.item_id === itemId)
  const { data, error } = await supabase
    .from('options')
    .insert({
      trip_id: detail.trip.id,
      item_id: itemId,
      name: input.name,
      amount: input.amount,
      currency: input.currency ?? detail.trip.currency,
      rate: input.rate ?? 1,
      details: input.details,
      link: input.link,
      note: input.note,
      is_chosen: siblings.length === 0,
      position: Math.max(0, ...siblings.map((o) => o.position)) + 1,
    })
    .select('id')
    .single()
  if (error) throw error
  if (input.rooms !== undefined) await setOptionRooms(data.id, input.rooms)
  return data.id
}

/** A stay's rooms (SR-4), saved in one step; null or none = one price, split equally. */
export async function setOptionRooms(optionId: string, rooms: RoomInput[] | null): Promise<void> {
  const { error } = await supabase.rpc('set_option_rooms', { p_option_id: optionId, p_rooms: (rooms ?? []) as unknown as Json })
  if (error) throw error
}

/** A page of Compare with nothing yet (no stay in Medellín): the item and its first option together. */
export async function addItemWithOption(
  detail: TripDetail,
  item: { placeId: string | null; kind: ItemKind; name: string },
  input: OptionInput,
): Promise<void> {
  const itemId = await addItem({ tripId: detail.trip.id, ...item, dayNumber: null, endDayNumber: null, amount: null })
  await addOption({ ...detail, options: [] }, itemId, input)
}

export async function updateOption(id: string, input: OptionInput): Promise<void> {
  const { error } = await supabase
    .from('options')
    .update({
      name: input.name,
      amount: input.amount,
      details: input.details,
      link: input.link,
      note: input.note,
      ...(input.currency ? { currency: input.currency, rate: input.rate ?? 1 } : {}),
    })
    .eq('id', id)
  if (error) throw error
  if (input.rooms !== undefined) await setOptionRooms(id, input.rooms)
}

/** Choosing one un-chooses the others; the item becomes "chosen" (the database keeps that rule). */
export async function chooseOption(id: string): Promise<void> {
  const { error } = await supabase.from('options').update({ is_chosen: true }).eq('id', id)
  if (error) throw error
}

export async function setFavourite(id: string, favourite: boolean): Promise<void> {
  const { error } = await supabase.from('options').update({ is_favourite: favourite }).eq('id', id)
  if (error) throw error
}

/** Deleting the chosen one leaves nothing chosen: the item is an idea again until you choose. */
export async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase.from('options').delete().eq('id', id)
  if (error) throw error
}

// ── Invitations (build 6) ───────────────────────────────────────────────────────

export type Invitation = Tables<'invitations'>
export type InvitationPreview = {
  trip_id: string
  trip_name: string
  start_date: string | null
  end_date: string | null
  places: string[]
  traveller_name: string
  invited_by_name: string | null
  /** open · expired · cancelled · used · joined (you're already that traveller) */
  state: 'open' | 'expired' | 'cancelled' | 'used' | 'joined'
}

/** The open invitations of a trip (one per traveller at most). */
export async function listOpenInvitations(tripId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('trip_id', tripId)
    .is('accepted_at', null)
    .is('cancelled_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** The link for a traveller: the open one, or a new one (works once, for 14 days). */
export async function inviteTraveller(travellerId: string): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await supabase.rpc('invite_traveller', { p_traveller_id: travellerId })
  if (error) throw error
  const row = data[0]
  return { token: row.token, expiresAt: row.expires_at }
}

export async function cancelInvitation(travellerId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_invitation', { p_traveller_id: travellerId })
  if (error) throw error
}

/** What the link shows before signing in; null when the link doesn't exist. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('invitation_preview', { p_token: token })
  if (error) throw error
  return (data[0] as InvitationPreview | undefined) ?? null
}

/** Join the trip as the invited traveller; returns the trip. */
export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
  if (error) throw error
  return data
}

/** Your accepted invitation on a trip, for the welcome note: who invited you. */
export async function getMyWelcome(tripId: string, userId: string): Promise<{ invitedBy: string | null } | null> {
  const { data, error } = await supabase
    .from('invitations')
    .select('invited_by')
    .eq('trip_id', tripId)
    .eq('accepted_by', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? { invitedBy: data.invited_by } : null
}

export async function leaveTrip(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_trip', { p_trip_id: tripId })
  if (error) throw error
}

/** The address someone opens to join: the app's own address + the secret. */
export const joinLink = (token: string) => `${window.location.origin}/join/${token}`

// ── Daily estimates (build 6) ───────────────────────────────────────────────────

export type EstimateInput = {
  id?: string | null
  tripId: string
  placeId: string | null
  category: string
  label: string
  /** A day, each, in `currency`. */
  amount: number
  currency: string
  /** Trip currency per 1 unit of `currency`; 1 for the trip's own currency. */
  rate: number
  days: number
  /** Who it's for; empty = everyone. */
  travellers: string[]
}

export async function saveDailyEstimate(e: EstimateInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_daily_estimate', {
    p_id: e.id ?? null,
    p_trip_id: e.tripId,
    p_place_id: e.placeId,
    p_category: e.category,
    p_label: e.label,
    p_amount: e.amount,
    p_currency: e.currency,
    p_rate: e.rate,
    p_days: e.days,
    p_travellers: e.travellers,
  })
  if (error) throw error
  return data
}

export async function deleteDailyEstimate(id: string): Promise<void> {
  const { error } = await supabase.from('daily_estimates').delete().eq('id', id)
  if (error) throw error
}

/** "Make it 3 days": only the days change. */
export async function setEstimateDays(id: string, days: number): Promise<void> {
  const { error } = await supabase.from('daily_estimates').update({ days }).eq('id', id)
  if (error) throw error
}
