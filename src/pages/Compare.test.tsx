import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, travellers, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('Compare', () => {
  const journey = {
    places: [cartagena],
    items: [{ id: 'f', place_id: null, kind: 'transport', name: 'St Martin ⇄ Cartagena', status: 'chosen', day_number: null, end_day_number: null, position: 1 }],
    legs: [
      { id: 'l1', item_id: 'f', leg_number: 1, mode: 'plane', from_name: 'St Martin', to_name: 'Cartagena', via: null, after_place_id: null, position: 0 },
      { id: 'l2', item_id: 'f', leg_number: 2, mode: 'plane', from_name: 'Cartagena', to_name: 'St Martin', via: null, after_place_id: 'p1', position: 1 },
    ],
    options: [
      { id: 'copa', item_id: 'f', name: 'Copa', amount: 1600, rate: 1, currency: 'EUR', is_chosen: true, is_favourite: true, position: 1, note: 'Short stop',
        details: { mode: 'plane', out: { fromAirport: 'SXM', toAirport: 'CTG', leaves: '13:05', arrives: '19:25', stops: 1, via: 'Panama' }, back: { leaves: '08:40', arrives: '15:45', stops: 1 }, bag: true, refundable: true } },
      { id: 'avianca', item_id: 'f', name: 'Avianca', amount: 1400, rate: 1, currency: 'EUR', is_chosen: false, is_favourite: false, position: 2, note: null,
        details: { mode: 'plane', out: { leaves: '07:10', arrives: '16:50', stops: 1, via: 'Bogotá' }, back: { leaves: '11:30', arrives: '20:25' }, bag: false } },
    ],
    shares: [
      { item_id: 'f', traveller_id: 'a', fraction: 0.5 },
      { item_id: 'f', traveller_id: 'b', fraction: 0.5 },
    ],
  }

  it('Travel: the journey, its options by price, your share, the tags', async () => {
    data.getTrip.mockResolvedValue(detail(journey))
    open('/trips/t1/compare')
    expect(await screen.findByRole('heading', { name: 'St Martin ⇄ Cartagena' })).toBeInTheDocument()
    expect(screen.getByText('Round trip')).toBeInTheDocument()
    const names = screen.getAllByRole('button', { name: /^Change / }).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Change Avianca', 'Change Copa'])
    expect(screen.getByText('700 €')).toBeInTheDocument() // your half of Avianca
    expect(screen.getByText('Cheapest', { selector: '.opt__tag' })).toBeInTheDocument()
    expect(screen.getByText('+100 €')).toBeInTheDocument()
    expect(screen.getByText('SXM 13:05 → CTG 19:25')).toBeInTheDocument()
    expect(screen.getByText('6 h 20')).toBeInTheDocument()
    expect(screen.getByText('✗ No checked bag')).toBeInTheDocument()
    expect(screen.getByText(/Fastest · 13 h 25 in all/)).toBeInTheDocument()
  })

  it('choose in one tap; ♥ your coup de cœur', async () => {
    data.getTrip.mockResolvedValue(detail(journey))
    data.chooseOption.mockResolvedValue(undefined)
    data.setFavourite.mockResolvedValue(undefined)
    open('/trips/t1/compare')
    await screen.findByRole('heading', { name: 'St Martin ⇄ Cartagena' })
    expect(screen.getByRole('button', { name: 'Copa: chosen' })).toHaveAttribute('aria-pressed', 'true')
    click('Choose Avianca')
    await waitFor(() => expect(data.chooseOption).toHaveBeenCalledWith('avianca'))
    click('My coup de cœur: Avianca')
    await waitFor(() => expect(data.setFavourite).toHaveBeenCalledWith('avianca', true))
  })

  it('sort by speed', async () => {
    data.getTrip.mockResolvedValue(detail(journey))
    open('/trips/t1/compare')
    await screen.findByRole('heading', { name: 'St Martin ⇄ Cartagena' })
    fireEvent.click(screen.getByRole('radio', { name: 'Fastest' }))
    const names = screen.getAllByRole('button', { name: /^Change / }).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Change Copa', 'Change Avianca'])
  })

  it('add two one-way tickets as one option: two prices, added up', async () => {
    data.getTrip.mockResolvedValue(detail(journey))
    data.addOption.mockResolvedValue('new')
    open('/trips/t1/compare')
    await screen.findByRole('heading', { name: 'St Martin ⇄ Cartagena' })
    click('Add a travel option')
    type('Airline or company', 'JetBlue + Copa')
    fireEvent.click(screen.getByRole('radio', { name: 'Two one-ways' }))
    type('Price out', '890')
    type('Price back', '800')
    click('Add the option')
    await waitFor(() =>
      expect(data.addOption).toHaveBeenCalledWith(
        expect.anything(),
        'f',
        expect.objectContaining({ name: 'JetBlue + Copa', amount: 1690, details: { mode: 'plane', prices: [890, 800] } }),
      ),
    )
  })

  it('Stay: an empty place invites its first place to stay', async () => {
    data.getTrip.mockResolvedValue(detail(journey))
    data.addItemWithOption.mockResolvedValue(undefined)
    open('/trips/t1/compare?tab=stay')
    expect(await screen.findByText('No place to stay yet in Cartagena')).toBeInTheDocument()
    click('+ Add a place to stay')
    type('Name of the place', 'Casa Lola')
    type('Price', '1.200')
    fireEvent.click(screen.getByRole('radio', { name: '4 out of 5' }))
    click('Add the option')
    await waitFor(() =>
      expect(data.addItemWithOption).toHaveBeenCalledWith(
        expect.anything(),
        { placeId: 'p1', kind: 'housing', name: 'Casa Lola' },
        expect.objectContaining({ amount: 1200, details: { looks: 4 } }),
      ),
    )
  })

  it('on the trip page, an item with options says so, sends to Compare, and keeps its price', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        places: [cartagena],
        items: [{ id: 'i1', place_id: 'p1', kind: 'housing', name: 'Casa Lola', status: 'chosen', day_number: null, end_day_number: null }],
        options: [
          { id: 'o1', item_id: 'i1', name: 'Casa Lola', amount: 1200, rate: 1, is_chosen: true, position: 1, details: {} },
          { id: 'o2', item_id: 'i1', name: 'Hotel Sofitel', amount: 2000, rate: 1, is_chosen: false, position: 2, details: {} },
        ],
        amounts: [{ item_id: 'i1', current: 1200, is_confirmed: false }],
      }),
    )
    data.updateItem.mockResolvedValue(undefined)
    open('/trips/t1')
    expect(await screen.findByText(/2 options compared/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change Casa Lola' }))
    expect(screen.getByText(/2 options compared · chosen: Casa Lola/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Compare' })).toHaveAttribute('href', '/trips/t1/compare?tab=stay&page=p1')
    expect(screen.queryByLabelText('Price')).not.toBeInTheDocument()
    type('Name', 'Stay in Cartagena')
    click('Save')
    await waitFor(() =>
      expect(data.updateItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Stay in Cartagena', keepPrice: true })),
    )
  })
})

describe('Compare: a line shared by some', () => {
  it('says the whole price for the people who share it, not the whole group', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        travellers: [...travellers, { id: 'c', name: 'Cleo', user_id: null }],
        places: [cartagena],
        items: [{ id: 'i1', place_id: 'p1', kind: 'activity', name: 'Photoshoot', status: 'chosen', day_number: null, end_day_number: null }],
        options: [{ id: 'o1', item_id: 'i1', name: 'Fly Dress', amount: 210, rate: 1, is_chosen: true, position: 1, details: {} }],
        shares: [
          { item_id: 'i1', traveller_id: 'a', fraction: 1 / 2 },
          { item_id: 'i1', traveller_id: 'b', fraction: 1 / 2 },
        ],
      }),
    )
    open('/trips/t1/compare?tab=activities&page=p1')
    expect(await screen.findByText(/210,00 € for 2|210 € for 2/)).toBeInTheDocument()
  })
})

describe('rooms (a stay by room)', () => {
  const three = [...travellers, { id: 'c', name: 'Cleo', user_id: null }]
  const hotel = (over: Record<string, unknown> = {}) =>
    detail({
      travellers: three,
      places: [cartagena],
      items: [{ id: 'h', place_id: 'p1', kind: 'housing', name: 'Casona', status: 'chosen', day_number: null, end_day_number: null }],
      options: [{ id: 'o1', item_id: 'h', name: 'Casona', amount: 1000, rate: 1, currency: 'EUR', is_chosen: true, position: 1, details: {} }],
      amounts: [{ item_id: 'h', current: 1000, is_confirmed: false }],
      ...over,
    })

  it('by room: each room its price and who sleeps there; the stay is the rooms added up', async () => {
    data.getTrip.mockResolvedValue(hotel())
    data.updateOption.mockResolvedValue(undefined)
    open('/trips/t1/compare?tab=stay&page=p1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casona' }))
    fireEvent.click(screen.getByRole('radio', { name: 'By room' }))
    fireEvent.change(screen.getAllByLabelText('Room')[0], { target: { value: 'Superior' } })
    fireEvent.change(screen.getAllByLabelText('Price')[0], { target: { value: '640' } })
    fireEvent.change(screen.getAllByLabelText('Price')[1], { target: { value: '360' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ana sleeps in Superior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bea sleeps in Room 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cleo sleeps in Room 2' }))
    expect(screen.getByText('1 000 €', { selector: '.rooms__total b' })).toBeInTheDocument()
    click('Save')
    await waitFor(() =>
      expect(data.updateOption).toHaveBeenCalledWith(
        'o1',
        expect.objectContaining({
          amount: 1000,
          rooms: [
            { name: 'Superior', amount: 640, occupants: ['a'] },
            { name: 'Room 2', amount: 360, occupants: ['b', 'c'] },
          ],
        }),
      ),
    )
  })

  it('a room without a price is said', async () => {
    data.getTrip.mockResolvedValue(hotel())
    open('/trips/t1/compare?tab=stay&page=p1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casona' }))
    fireEvent.click(screen.getByRole('radio', { name: 'By room' }))
    click('Save')
    expect(await screen.findByText('Each room needs its price, like 640.')).toBeInTheDocument()
    expect(data.updateOption).not.toHaveBeenCalled()
  })

  it('shown on the card, and on the trip page “Who it’s for” says who’s where', async () => {
    const rooms = {
      rooms: [
        { id: 'r1', option_id: 'o1', trip_id: 't1', name: 'Superior', amount: 640, position: 1 },
        { id: 'r2', option_id: 'o1', trip_id: 't1', name: 'Junior suite', amount: 360, position: 2 },
      ],
      roomOccupants: [
        { room_id: 'r1', traveller_id: 'a', trip_id: 't1' },
        { room_id: 'r2', traveller_id: 'b', trip_id: 't1' },
        { room_id: 'r2', traveller_id: 'c', trip_id: 't1' },
      ],
    }
    data.getTrip.mockResolvedValue(hotel(rooms))
    const view = open('/trips/t1/compare?tab=stay&page=p1')
    expect(await screen.findByText('Superior 640 € · Ana')).toBeInTheDocument()
    view.unmount()
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casona' }))
    expect(screen.getByText(/Split by room: Ana · Bea & Cleo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bea' })).not.toBeInTheDocument()
  })
})
