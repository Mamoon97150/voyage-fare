// Read-only share link (build 8 step 6, mockup share-link-v5): the link, what it shows, turning it
// off; and the trip as a visitor sees it (built on the server, without what stays private).
import { supabase } from '../supabase'
import type { TripMoney } from './money'
import type { TripDetail } from './tripDetail'

export type ShareLink = { token: string; show_prices: boolean; show_names: boolean }

/** The trip's link (made the first time). */
export async function shareLink(tripId: string): Promise<ShareLink> {
  const { data, error } = await supabase.rpc('share_link', { p_trip_id: tripId })
  if (error) throw error
  return data[0]
}

export async function setShare(tripId: string, showPrices: boolean, showNames: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_share', {
    p_trip_id: tripId,
    p_show_prices: showPrices,
    p_show_names: showNames,
  })
  if (error) throw error
}

/** It stops working at once; the next link will be a new one. */
export async function stopShare(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('stop_share', { p_trip_id: tripId })
  if (error) throw error
}

export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`

/**
 * The trip behind a link, or null (turned off, or never existed). It comes marked read-only like
 * the demo (is_demo), with the link's address as its base.
 */
export async function sharedTrip(token: string): Promise<TripDetail | null> {
  const { data, error } = await supabase.rpc('shared_trip', { p_token: token })
  if (error) throw error
  if (!data) return null
  const d = data as unknown as TripDetail & { share: ShareLink; money: TripMoney }
  return {
    ...d,
    trip: { ...d.trip, is_demo: true },
    shared: { token, showPrices: d.share.show_prices, showNames: d.share.show_names, money: d.money },
  }
}
