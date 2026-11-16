// The trip's email address and "To review" (build 8 step 5b, mockup ai-reading-v5 screens 7–8).
// Forwarded emails are read on the server (trip-mail → ai-read); here, the address and marking them.
import { supabase } from '../supabase'
import type { FoundBooking } from './ai'
import type { TripMail } from './tripDetail'

/** The trip's address (made the first time); renew: a new one, the old one stops working. */
export async function tripMailAddress(tripId: string, renew = false): Promise<string> {
  const { data, error } = await supabase.rpc('trip_mail_address', { p_trip_id: tripId, p_new: renew })
  if (error) throw error
  return data
}

/** Done (it went into the trip) or dropped (not for this trip). */
export async function markTripMail(id: string, status: 'done' | 'dropped'): Promise<void> {
  const { error } = await supabase.from('trip_mails').update({ status }).eq('id', id)
  if (error) throw error
}

/** What the AI found in a forwarded email, as the booking screen reads it. */
export const foundIn = (mail: Pick<TripMail, 'found'>) => (mail.found as unknown as FoundBooking | null) ?? null
