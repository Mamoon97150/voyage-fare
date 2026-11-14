// Invitations (build 6).
import type { Tables } from '../database.types'
import { supabase } from '../supabase'

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
