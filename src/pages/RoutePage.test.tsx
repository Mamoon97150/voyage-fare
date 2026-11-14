import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { data, detail, open, trip } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('the route map (build 6)', () => {
  const bogota = { id: 'p1', name: 'Bogotá', country: 'Colombia', nights: 2, position: 1, latitude: 4.711, longitude: -74.0721 }
  const guatape = { id: 'p2', name: 'Guatapé', country: 'Colombia', nights: 2, position: 2, latitude: null, longitude: null }
  const medellin = { id: 'p3', name: 'Medellín', country: 'Colombia', nights: 4, position: 3, latitude: 6.2442, longitude: -75.5812 }
  const withRoute = () =>
    detail({ trip: { ...trip, home_latitude: 18.04, home_longitude: -63.05 }, places: [bogota, guatape, medellin] })

  it('a small map on the trip page, with the route in words and what isn’t on it', async () => {
    data.getTrip.mockResolvedValue(withRoute())
    open('/trips/t1')
    expect(await screen.findByRole('heading', { name: 'The route' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Map of the route: Bogotá, Medellín' })).toBeInTheDocument()
    expect(screen.getByText('from St Martin → 3 places → back home · 8 nights')).toBeInTheDocument()
    expect(screen.getByText(/Guatapé isn’t on the map/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the map ›' })).toHaveAttribute('href', '/trips/t1/route')
  })

  it('no map until a place has a spot', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [guatape] }))
    open('/trips/t1')
    await screen.findByText('Guatapé')
    expect(screen.queryByRole('heading', { name: 'The route' })).not.toBeInTheDocument()
  })

  it('the big map lists the stops in order, home at both ends', async () => {
    data.getTrip.mockResolvedValue(withRoute())
    open('/trips/t1/route')
    expect(await screen.findByRole('heading', { name: 'The route' })).toBeInTheDocument()
    const stops = screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/\s+/g, ' ').trim())
    expect(stops).toEqual(['⌂St Martin', '1Bogotá 2 nights', '2Guatapé 2 nights', '3Medellín 4 nights', '⌂St Martin home'])
    expect(screen.getByRole('link', { name: /Medellín/ })).toHaveAttribute('href', '/trips/t1#place-p3')
  })
})
