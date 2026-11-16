// AI reading (build 8 step 5a, mockup ai-reading-v5): through the ai-read server function, which
// holds the key and the caps. Mark booked from an email in one step (apply_booking). Admin's meter.
import { AiError } from '../aiError'
import { supabase } from '../supabase'

export { AiError }

export type AiKind = 'trip' | 'booking'

/** What the email says was booked (the server's answer, as is). */
export type FoundBooking = {
  is_booking: boolean
  kind: 'stay' | 'activity' | 'food' | 'transport' | 'other'
  name: string | null
  provider: string | null
  city: string | null
  from: string | null
  to: string | null
  start_date: string | null
  end_date: string | null
  price: number | null
  currency: string | null
  confirmation: string | null
  link: string | null
}

async function read<T>(kind: AiKind, text: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-read', { body: { kind, text } })
  if (error) {
    const context = (error as { context?: Response }).context
    const said = context ? await context.json().catch(() => null) : null
    if (said?.code) throw new AiError(said.code, said.error ?? 'Something went wrong.', said.resumes ?? null)
    throw new AiError('down', 'AI reading isn’t answering right now: check your connection and try again.')
  }
  return (data as { result: T }).result
}

/** The trip in the AI's own words, as the JSON of "Import from my AI" (text for parseAiAnswer). */
export const readTrip = (text: string) => read<Record<string, unknown>>('trip', text).then((r) => JSON.stringify(r))
export const readBooking = (text: string) => read<FoundBooking>('booking', text)

export async function applyBooking(b: {
  tripId: string
  itemId: string | null
  kind: string
  name: string
  placeId: string | null
  dayNumber: number | null
  optionName: string | null
  amount: number | null
  currency: string | null
  rate: number | null
  ref: string | null
  link: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('apply_booking', {
    p_trip_id: b.tripId,
    p_item_id: b.itemId ?? undefined,
    p_kind: b.kind,
    p_name: b.name,
    p_place_id: b.placeId ?? undefined,
    p_day_number: b.dayNumber ?? undefined,
    p_option_name: b.optionName ?? undefined,
    p_amount: b.amount ?? undefined,
    p_currency: b.currency ?? undefined,
    p_rate: b.rate ?? undefined,
    p_ref: b.ref ?? undefined,
    p_link: b.link ?? undefined,
  })
  if (error) throw error
  return data
}

export type AiUsage = {
  enabled: boolean
  cap_usd: number
  used_usd: number
  readings: number
  bookings: number
  people: number
}

export async function adminAi(): Promise<AiUsage> {
  const { data, error } = await supabase.rpc('admin_ai')
  if (error) throw error
  const d = data as unknown as AiUsage
  return { ...d, cap_usd: Number(d.cap_usd), used_usd: Number(d.used_usd) }
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_ai', { p_enabled: enabled })
  if (error) throw error
}
