// Daily estimates (build 6).
import { supabase } from '../supabase'
import { sqlNull } from './sql'

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
    p_id: sqlNull(e.id ?? null),
    p_trip_id: e.tripId,
    p_place_id: sqlNull(e.placeId),
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
