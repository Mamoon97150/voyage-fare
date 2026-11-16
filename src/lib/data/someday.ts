// Someday (build 8½, mockup menus-home-v6): ideas saved before there's a trip. Only yours (RLS).
import { supabase } from '../supabase'

export type SomedayIdea = {
  id: string
  place_name: string | null
  place_country: string | null
  place_latitude: number | null
  place_longitude: number | null
  kind: 'restaurant' | 'activity'
  name: string
  link: string | null
  note: string | null
  created_at: string
}

export async function listSomeday(): Promise<SomedayIdea[]> {
  const { data, error } = await supabase.from('someday_ideas').select('*').order('created_at')
  if (error) throw error
  return (data ?? []) as SomedayIdea[]
}

export async function saveSomeday(idea: {
  id?: string
  place: { name: string; country: string | null; latitude: number | null; longitude: number | null } | null
  kind: 'restaurant' | 'activity'
  name: string
  link: string | null
  note: string | null
}): Promise<void> {
  const row = {
    place_name: idea.place?.name.trim() || null,
    place_country: idea.place?.country ?? null,
    place_latitude: idea.place?.latitude ?? null,
    place_longitude: idea.place?.longitude ?? null,
    kind: idea.kind,
    name: idea.name.trim(),
    link: idea.link?.trim() || null,
    note: idea.note?.trim() || null,
  }
  const { error } = idea.id
    ? await supabase.from('someday_ideas').update(row).eq('id', idea.id)
    : await supabase.from('someday_ideas').insert(row)
  if (error) throw error
}

export async function deleteSomeday(id: string): Promise<void> {
  const { error } = await supabase.from('someday_ideas').delete().eq('id', id)
  if (error) throw error
}

/** A trip from one place's ideas: the ideas go to its To try. Returns the new trip's id. */
export async function startTripFromSomeday(placeName: string, me: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('start_trip_from_someday', {
    p_place_name: placeName,
    p_me: me ?? undefined,
  })
  if (error) throw error
  return data
}

/** "+ N from Someday": your ideas for a place of this name go into its To try. How many moved. */
export async function somedayIntoPlace(placeId: string): Promise<number> {
  const { data, error } = await supabase.rpc('someday_into_place', { p_place_id: placeId })
  if (error) throw error
  return data
}
