// Who pays together (build 10, mockup money-v6): groups of travellers who settle up as one.
import type { Tables } from '../database.types'
import { supabase } from '../supabase'

export type PartyBalance = Tables<'v_party_balances'>
export type GroupBetween = Tables<'v_group_between'>
export type ItemBill = Tables<'v_item_bills'>

/** Put these travellers together (2 or more); with a group id, replace its members. null = no group left. */
export async function setPayGroup(
  tripId: string,
  travellerIds: string[],
  groupId?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('set_pay_group', {
    p_trip_id: tripId,
    p_traveller_ids: travellerIds,
    p_group_id: groupId ?? undefined,
  })
  if (error) throw error
  return data ?? null
}

export async function removePayGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_pay_group', { p_group_id: groupId })
  if (error) throw error
}

/** "I paid cash ≈ 40 €": a line paid on the spot (for = who it's for; empty = everyone). */
export async function addCash(c: {
  tripId: string
  amount: number
  name: string
  category: 'local_transport' | 'activities' | 'food' | 'buffer'
  paidBy: string
  for: string[]
  placeId?: string | null
  day?: number | null
  currency?: string
  rate?: number
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_cash', {
    p_trip_id: c.tripId,
    p_amount: c.amount,
    p_name: c.name,
    p_category: c.category,
    p_paid_by: c.paidBy,
    p_for: c.for,
    p_place_id: c.placeId ?? undefined,
    p_day_number: c.day ?? undefined,
    p_currency: c.currency,
    p_rate: c.rate,
  })
  if (error) throw error
  return data
}

/** Right after creating a trip: groups given by position (0 = you, then the names in order). */
export async function groupByPosition(tripId: string, groups: number[][]): Promise<void> {
  if (groups.length === 0) return
  const { data, error } = await supabase
    .from('travellers')
    .select('id, position')
    .eq('trip_id', tripId)
    .order('position')
  if (error) throw error
  for (const g of groups) {
    const ids = g.map((pos) => data?.[pos]?.id).filter((x): x is string => Boolean(x))
    if (ids.length >= 2) await setPayGroup(tripId, ids)
  }
}
