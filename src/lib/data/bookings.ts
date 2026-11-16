// Booking details on a line (build 8 step 4, mockup booking-details-v5): the confirmation number,
// the booking link, and tickets and vouchers kept in private Storage (only the trip's members).
import { supabase } from '../supabase'
import type { ItemFile } from './tripDetail'

const BUCKET = 'trip-files'
export const MAX_FILE = 10 * 1024 * 1024
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']

/** The confirmation number and the link; empty boxes clear them. */
export async function saveBooking(itemId: string, ref: string | null, link: string | null): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ booking_ref: ref?.trim() || null, booking_link: link?.trim() || null })
    .eq('id', itemId)
  if (error) throw error
}

/** A file's place in Storage: <trip>/<item>/<random>-<safe name>. */
export function filePath(tripId: string, itemId: string, name: string, random = crypto.randomUUID().slice(0, 8)) {
  const safe =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(-80) || 'file'
  return `${tripId}/${itemId}/${random}-${safe}`
}

/** What's wrong with a file before sending it, or null. */
export function fileProblem(file: { size: number; type: string }): string | null {
  if (!FILE_TYPES.includes(file.type)) return 'Add a PDF or a photo (JPG, PNG, WebP, HEIC).'
  if (file.size > MAX_FILE) return 'This file is over 10 MB: try a smaller one, or a screenshot of it.'
  return null
}

export async function addFile(tripId: string, itemId: string, file: File): Promise<void> {
  const path = filePath(tripId, itemId, file.name)
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw up.error
  const { error } = await supabase
    .from('item_files')
    .insert({ trip_id: tripId, item_id: itemId, path, name: file.name, size: file.size, mime: file.type })
  if (error) {
    // No row, no file: don't leave it behind.
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
}

/** A short-lived address to open the file (it's private: no lasting link). */
export async function fileUrl(file: Pick<ItemFile, 'path'>): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.path, 120)
  if (error) throw error
  return data.signedUrl
}

export async function removeFile(file: Pick<ItemFile, 'id' | 'path'>): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([file.path])
  if (error) throw error
  const row = await supabase.from('item_files').delete().eq('id', file.id)
  if (row.error) throw row.error
}

/** Before a trip goes: its files go too (Storage doesn't follow the database on its own). */
export async function removeTripFiles(tripId: string): Promise<void> {
  const { data } = await supabase.from('item_files').select('path').eq('trip_id', tripId)
  // Options' own photos too (build 9).
  const photos = await supabase.from('options').select('photo_path').eq('trip_id', tripId).not('photo_path', 'is', null)
  const paths = [...(data ?? []).map((f) => f.path), ...(photos.data ?? []).map((o) => o.photo_path as string)]
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

/** Before "Delete my account": the files of the trips that go with it (those only you are on). */
export async function removeFilesOfMyOwnTrips(userId: string): Promise<void> {
  const { data: mine } = await supabase.from('trips').select('id').eq('created_by', userId)
  for (const t of mine ?? []) {
    const { count } = await supabase
      .from('trip_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('trip_id', t.id)
    if ((count ?? 0) <= 1) await removeTripFiles(t.id)
  }
}
