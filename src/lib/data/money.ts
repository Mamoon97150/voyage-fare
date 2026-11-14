// Budget and Who paid: totals by category, balances, repayments.
import type { Tables } from '../database.types'
import { supabase } from '../supabase'

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
