import type { Item, TripDetail } from '../../lib/trips'

// "Chosen" is the default and stays silent: the dot already says estimated or confirmed (review 13 Nov).
export const STATUS: Record<string, string | undefined> = { idea: 'Idea', booked: 'Booked', paid: 'Paid' }

export const priceOf = (detail: TripDetail, item: Item) => {
  const current = detail.amounts.find((a) => a.item_id === item.id)?.current
  return current === null || current === undefined ? null : Number(current)
}
