// Options: compare, choose, coup de cœur (build 3), rooms (build 4).
import type { Json } from '../database.types'
import { supabase } from '../supabase'
import { addItem, type ItemKind } from './items'
import type { TripDetail } from './tripDetail'

export type RoomInput = { name: string; amount: number; occupants: string[] }

export type OptionInput = {
  name: string
  amount: number | null
  /** A stay by room (SR-4): its rooms, or null for one price. Left out: the rooms aren't touched. */
  rooms?: RoomInput[] | null
  /** The price's own currency and the rate saved when it was typed (BR-10). Default: the trip's, 1. */
  currency?: string
  rate?: number
  details: Json
  link: string | null
  note: string | null
  /** Where it is (maps-v6). Left out: not touched. */
  place?: { name: string; latitude: number | null; longitude: number | null } | null
  /** The link's preview picture (it stays a link). Left out: not touched. */
  photoUrl?: string | null
  /** Your own photo to keep, or 'remove'. */
  photo?: { file: File; tripId: string } | 'remove'
}

/** The place and picture columns, only for what the form says. */
const extras = (input: OptionInput) => ({
  ...(input.place !== undefined
    ? {
        location_name: input.place?.name.trim() || null,
        latitude: input.place?.name.trim() ? (input.place.latitude ?? null) : null,
        longitude: input.place?.name.trim() ? (input.place.longitude ?? null) : null,
      }
    : {}),
  ...(input.photoUrl !== undefined ? { photo_url: input.photoUrl } : {}),
})

/**
 * Add a candidate to an item. The first option of an item is chosen right away (like adding an
 * item with a price); the next ones wait until you choose. Priced in the trip currency until
 * currencies arrive (rate 1).
 */
export async function addOption(detail: TripDetail, itemId: string, input: OptionInput): Promise<string> {
  const siblings = detail.options.filter((o) => o.item_id === itemId)
  const { data, error } = await supabase
    .from('options')
    .insert({
      trip_id: detail.trip.id,
      item_id: itemId,
      name: input.name,
      amount: input.amount,
      currency: input.currency ?? detail.trip.currency,
      rate: input.rate ?? 1,
      details: input.details,
      link: input.link,
      note: input.note,
      ...extras(input),
      is_chosen: siblings.length === 0,
      position: Math.max(0, ...siblings.map((o) => o.position)) + 1,
    })
    .select('id')
    .single()
  if (error) throw error
  if (input.rooms !== undefined) await setOptionRooms(data.id, input.rooms)
  if (input.photo && input.photo !== 'remove') await setOptionPhoto(input.photo.tripId, data.id, input.photo.file, null)
  return data.id
}

/** A stay's rooms (SR-4), saved in one step; null or none = one price, split equally. */
export async function setOptionRooms(optionId: string, rooms: RoomInput[] | null): Promise<void> {
  const { error } = await supabase.rpc('set_option_rooms', {
    p_option_id: optionId,
    p_rooms: (rooms ?? []) as unknown as Json,
  })
  if (error) throw error
}

/** A page of Compare with nothing yet (no stay in Medellín): the item and its first option together. */
export async function addItemWithOption(
  detail: TripDetail,
  item: { placeId: string | null; kind: ItemKind; name: string },
  input: OptionInput,
): Promise<void> {
  const itemId = await addItem({ tripId: detail.trip.id, ...item, dayNumber: null, endDayNumber: null, amount: null })
  await addOption({ ...detail, options: [] }, itemId, input)
}

export async function updateOption(id: string, input: OptionInput): Promise<void> {
  const { error } = await supabase
    .from('options')
    .update({
      name: input.name,
      amount: input.amount,
      details: input.details,
      link: input.link,
      note: input.note,
      ...extras(input),
      ...(input.currency ? { currency: input.currency, rate: input.rate ?? 1 } : {}),
    })
    .eq('id', id)
  if (error) throw error
  if (input.rooms !== undefined) await setOptionRooms(id, input.rooms)
  if (input.photo) {
    const { data } = await supabase.from('options').select('photo_path').eq('id', id).single()
    if (input.photo === 'remove') await removeOptionPhoto(id, data?.photo_path ?? null)
    else await setOptionPhoto(input.photo.tripId, id, input.photo.file, data?.photo_path ?? null)
  }
}

const BUCKET = 'trip-files'

/** A phone photo made smaller on the way in (1600 px, JPEG): about 300 KB instead of 4 MB. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82))
    return blob ?? file
  } catch {
    return file // a format the browser can't open (HEIC outside Safari): kept as it is
  }
}

/** Your own photo for an option, in the trip's private files; the old one goes. */
export async function setOptionPhoto(tripId: string, optionId: string, file: File, old: string | null): Promise<void> {
  const blob = await shrinkPhoto(file)
  const type = blob.type || file.type
  const path = `${tripId}/photos/${optionId}-${crypto.randomUUID().slice(0, 8)}.${type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] ?? 'img')}`
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false })
  if (up.error) throw up.error
  const { error } = await supabase.from('options').update({ photo_path: path }).eq('id', optionId)
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  if (old) await supabase.storage.from(BUCKET).remove([old])
}

export async function removeOptionPhoto(optionId: string, path: string | null): Promise<void> {
  const { error } = await supabase.from('options').update({ photo_path: null }).eq('id', optionId)
  if (error) throw error
  if (path) await supabase.storage.from(BUCKET).remove([path])
}

/** Short-lived addresses for the trip's own photos (private files: no lasting link). */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error) throw error
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

export type LinkPreview = {
  name: string | null
  image: string | null
  site: string | null
  price: number | null
  currency: string | null
  place: string | null
  latitude: number | null
  longitude: number | null
  url: string
  refused?: boolean
}

/** Paste a link → option (maps-v6): what the page publishes for previews, read on the server. */
export async function previewLink(url: string): Promise<LinkPreview> {
  const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } })
  if (error) {
    const context = (error as { context?: Response }).context
    const said = context ? await context.json().catch(() => null) : null
    throw new Error(said?.error ?? 'The link couldn’t be read. Type the details instead.')
  }
  return data as LinkPreview
}

/** Choosing one un-chooses the others; the item becomes "chosen" (the database keeps that rule). */
export async function chooseOption(id: string): Promise<void> {
  const { error } = await supabase.from('options').update({ is_chosen: true }).eq('id', id)
  if (error) throw error
}

export async function setFavourite(id: string, favourite: boolean): Promise<void> {
  const { error } = await supabase.from('options').update({ is_favourite: favourite }).eq('id', id)
  if (error) throw error
}

/** Deleting the chosen one leaves nothing chosen: the item is an idea again until you choose. */
export async function deleteOption(id: string): Promise<void> {
  const { data } = await supabase.from('options').select('photo_path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('options').delete().eq('id', id)
  if (error) throw error
  // Its own photo goes with it (Storage doesn't follow the database on its own).
  if (data?.photo_path) await supabase.storage.from(BUCKET).remove([data.photo_path])
}
