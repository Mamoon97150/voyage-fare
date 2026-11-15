// The Admin dashboard, stage A (build 8, mockup admin-v5): feedback from the app, and what admins
// see. Every call is checked by the database (admins only), not just hidden in the app.
import type { Database } from '../database.types'
import { supabase } from '../supabase'

type Fns = Database['public']['Functions']
export type FeedbackKind = 'broken' | 'unclear' | 'idea' | 'love'
export type AdminMessage = Fns['admin_feedback']['Returns'][number]
export type AdminPerson = Fns['admin_people']['Returns'][number]
export type AdminEntry = Fns['admin_list']['Returns'][number]
export type Overview = {
  accounts: number
  accounts_week: number
  trips: number
  trips_week: number
  active_week: number
  new_messages: number
  database_bytes: number
  files_bytes: number
}

export async function sendFeedback(f: {
  kind: FeedbackKind
  message: string
  page: string | null
  device: string | null
  canReply: boolean
}): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const { error } = await supabase.from('feedback').insert({
    user_id: data.session?.user.id,
    kind: f.kind,
    message: f.message.trim(),
    page: f.page,
    device: f.device,
    can_reply: f.canReply,
  })
  if (error) throw error
}

export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_admin')
  if (error) return false
  return Boolean(data)
}

export async function adminOverview(): Promise<Overview> {
  const { data, error } = await supabase.rpc('admin_overview')
  if (error) throw error
  return data as unknown as Overview
}

export async function adminMessages(): Promise<AdminMessage[]> {
  const { data, error } = await supabase.rpc('admin_feedback')
  if (error) throw error
  return data ?? []
}

export async function markMessage(id: string, status: 'new' | 'done'): Promise<void> {
  const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
  if (error) throw error
}

export async function adminPeople(): Promise<AdminPerson[]> {
  const { data, error } = await supabase.rpc('admin_people')
  if (error) throw error
  return data ?? []
}

export async function adminList(): Promise<AdminEntry[]> {
  const { data, error } = await supabase.rpc('admin_list')
  if (error) throw error
  return data ?? []
}

export async function addAdmin(email: string): Promise<void> {
  const { error } = await supabase.rpc('admin_add', { p_email: email.trim() })
  if (error) throw error
}

export async function removeAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_remove', { p_user_id: userId })
  if (error) throw error
}
