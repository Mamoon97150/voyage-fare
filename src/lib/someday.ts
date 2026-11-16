// Someday's ideas by place (build 8½): pure, so the screens and tests share it.
import type { SomedayIdea } from './data/someday'

/** By place, the places in the order they were first saved; ideas with no place last ("Anywhere"). */
export function groupSomeday(ideas: SomedayIdea[]): { place: string | null; ideas: SomedayIdea[] }[] {
  const groups = new Map<string | null, SomedayIdea[]>()
  for (const i of ideas) {
    const key = i.place_name
    groups.set(key, [...(groups.get(key) ?? []), i])
  }
  const named = [...groups.entries()].filter(([k]) => k !== null).map(([place, ideas]) => ({ place, ideas }))
  const anywhere = groups.get(null)
  return anywhere ? [...named, { place: null, ideas: anywhere }] : named
}

/** How many of your Someday ideas wait for a place of this name (any case, any spaces). */
export const somedayFor = (ideas: SomedayIdea[], placeName: string) =>
  ideas.filter((i) => i.place_name && i.place_name.trim().toLowerCase() === placeName.trim().toLowerCase()).length
