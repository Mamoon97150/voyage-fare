// Paid in parts: what's left to pay (build 6).
import { supabase } from '../supabase'
import { sqlNull } from './sql'

export type PaymentKind = 'deposit' | 'balance' | 'instalment' | 'payment'

export async function addPayment(p: {
  itemId: string
  kind: PaymentKind
  amount: number
  /** Another currency than the trip's, with the rate saved now (trip currency per 1 unit). */
  currency?: string
  rate?: number
  /** A traveller, or null with each = true: everyone on the line paid their own share. */
  paidBy: string | null
  each: boolean
  paidOn: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_payment', {
    p_item_id: p.itemId,
    p_kind: p.kind,
    p_amount: p.amount,
    p_currency: p.currency,
    p_rate: p.rate,
    p_paid_by: p.paidBy ?? undefined,
    p_paid_each: p.each,
    p_paid_on: p.paidOn,
  })
  if (error) throw error
  return data
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_payment', { p_payment_id: id })
  if (error) throw error
}

/** When the balance is due; null = no date. */
export async function setItemDue(itemId: string, dueOn: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_item_due', { p_item_id: itemId, p_due_on: sqlNull(dueOn) })
  if (error) throw error
}
