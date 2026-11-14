// What every screen test shares: a trip as the database gives it, opening a page, typing, clicking.
// Each test file still declares its mocks (vi.mock only works there): see the top of any *.test.tsx.
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach } from 'vitest'
import { AppRoutes } from '../App'
import { AuthProvider } from '../lib/auth'
import { data } from './fakes'

export { data }

export const trip = {
  id: 't1',
  name: 'Colombia',
  start_date: null,
  end_date: null,
  home_city: 'St Martin',
  currency: 'EUR',
  target_amount: 2500,
  target_scope: 'per_person',
  created_by: 'u-ana',
  is_demo: false,
}
export const travellers = [
  { id: 'a', name: 'Ana', user_id: 'u-ana' },
  { id: 'b', name: 'Bea', user_id: null },
]
export const cartagena = { id: 'p1', name: 'Cartagena', country: 'Colombia', nights: 4, position: 1 }


/** A trip as the database gives it; empty budget unless said otherwise. */
export const detail = (over: Record<string, unknown> = {}) => ({
  trip,
  travellers,
  places: [],
  items: [],
  options: [],
  legs: [],
  amounts: [],
  shares: [],
  budget: { current_total: null, confirmed_total: null, estimated_total: null, target_total: 5000, missing_amount_count: 0 },
  travellerShares: [],
  placeTotals: [],
  travellerPlaceTotals: [],
  rooms: [],
  roomOccupants: [],
  dailyEstimates: [],
  estimatePeople: [],
  estimateChecks: [],
  payments: [],
  itemLeft: [],
  ...over,
})


beforeEach(() => {
  window.localStorage.clear()
  Object.values(data).forEach((fn) => fn.mockReset())
  data.searchPlaces.mockResolvedValue([])
  data.getTrip.mockResolvedValue(detail())
  data.listOpenInvitations.mockResolvedValue([])
  data.getMyWelcome.mockResolvedValue(null)
})


export function open(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

export const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
export const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

