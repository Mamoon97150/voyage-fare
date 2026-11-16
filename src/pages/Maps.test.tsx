import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, data, detail, open } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

// Build 9 (mockup maps-v6): stays on a map, paste a link → option, photos.
const option = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  item_id: 'h',
  name: id,
  amount: 500,
  rate: 1,
  currency: 'EUR',
  is_chosen: false,
  is_favourite: false,
  position: 1,
  details: {},
  latitude: null,
  longitude: null,
  location_name: null,
  photo_url: null,
  photo_path: null,
  ...over,
})
const stays = (options: Record<string, unknown>[]) =>
  detail({
    places: [{ ...cartagena, latitude: 10.4, longitude: -75.5 }],
    items: [
      {
        id: 'h',
        place_id: 'p1',
        kind: 'housing',
        name: 'Where we sleep',
        status: 'idea',
        day_number: null,
        end_day_number: null,
      },
    ],
    options,
    amounts: [{ item_id: 'h', current: null, is_confirmed: false }],
  })

describe('stays on a map, in Compare', () => {
  it('each option with a place shows its price on the map; one without, not', async () => {
    data.getTrip.mockResolvedValue(
      stays([
        option('Casona', { latitude: 10.42, longitude: -75.55, photo_url: 'https://img.example/casona.jpg' }),
        option('Casa Lola', { amount: 720 }),
      ]),
    )
    open('/trips/t1/compare?tab=stay&page=p1')
    expect(await screen.findByRole('img', { name: 'Map of the places to stay in Cartagena' })).toBeInTheDocument()
    expect(screen.getByText('tap a price: its card comes up')).toBeInTheDocument()
    // The link's picture on the card.
    expect(document.querySelector('#opt-Casona img')).toHaveAttribute('src', 'https://img.example/casona.jpg')
  })

  it('no option with a place: no map', async () => {
    data.getTrip.mockResolvedValue(stays([option('Casa Lola')]))
    open('/trips/t1/compare?tab=stay&page=p1')
    await screen.findByRole('button', { name: 'Change Casa Lola' })
    expect(screen.queryByRole('img', { name: /Map of the places to stay/ })).not.toBeInTheDocument()
  })
})

describe('paste a link → option', () => {
  it('fills the name, picture and place; says what it didn’t find', async () => {
    data.getTrip.mockResolvedValue(stays([option('Casa Lola')]))
    data.previewLink.mockResolvedValue({
      name: 'Quiet flat near the walls',
      image: 'https://img.example/flat.jpg',
      site: 'Airbnb',
      price: null,
      currency: null,
      place: 'Getsemaní',
      latitude: 10.42,
      longitude: -75.54,
      url: 'https://www.airbnb.com/rooms/1',
    })
    data.addOption.mockResolvedValue('new')
    open('/trips/t1/compare?tab=stay&page=p1')
    fireEvent.click(await screen.findByRole('button', { name: 'Add an option' }))
    fireEvent.change(screen.getByLabelText(/Paste a link/), { target: { value: 'https://www.airbnb.com/rooms/1' } })
    expect(await screen.findByText('where it is: Getsemaní, pinned')).toBeInTheDocument()
    expect(screen.getByText('the price: Airbnb doesn’t show it to us, type it')).toBeInTheDocument()
    expect(screen.getByLabelText('Name of the place')).toHaveValue('Quiet flat near the walls')
    expect(screen.getByLabelText('Where (optional)')).toHaveValue('Getsemaní')
    fireEvent.click(screen.getByRole('button', { name: 'Add the option' }))
    await waitFor(() =>
      expect(data.addOption).toHaveBeenCalledWith(
        expect.anything(),
        'h',
        expect.objectContaining({
          name: 'Quiet flat near the walls',
          link: 'https://www.airbnb.com/rooms/1',
          photoUrl: 'https://img.example/flat.jpg',
          place: expect.objectContaining({ name: 'Getsemaní', latitude: 10.42 }),
        }),
      ),
    )
  })

  it('a site that refuses: it says so, nothing made up', async () => {
    data.getTrip.mockResolvedValue(stays([option('Casa Lola')]))
    data.previewLink.mockResolvedValue({
      name: null,
      image: null,
      site: 'booking.com',
      price: null,
      currency: null,
      place: null,
      latitude: null,
      longitude: null,
      url: 'https://www.booking.com/x',
      refused: true,
    })
    open('/trips/t1/compare?tab=stay&page=p1')
    fireEvent.click(await screen.findByRole('button', { name: 'Add an option' }))
    fireEvent.change(screen.getByLabelText(/Paste a link/), { target: { value: 'https://www.booking.com/x' } })
    expect(await screen.findByText('The site didn’t let the app read it: type the details.')).toBeInTheDocument()
    expect(screen.getByText('the name: type it')).toBeInTheDocument()
    expect(screen.getByLabelText('Name of the place')).toHaveValue('')
  })
})

describe('the stay’s photo on the trip page', () => {
  it('the chosen option’s picture, glued in', async () => {
    data.getTrip.mockResolvedValue(
      stays([option('Casona', { is_chosen: true, photo_url: 'https://img.example/casona.jpg' })]),
    )
    open('/trips/t1')
    await screen.findByText('Where we sleep')
    expect(document.querySelector('.item-row__photo img')).toHaveAttribute('src', 'https://img.example/casona.jpg')
  })
})
