import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { click, data, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('your trips', () => {
  it('empty: the notebook, and a way to start', async () => {
    data.listTrips.mockResolvedValue([])
    open('/trips')
    expect(await screen.findByText('No trips yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ New trip' })).toHaveAttribute('href', '/trips/new')
  })

  it('lists each trip in a line of words', async () => {
    data.listTrips.mockResolvedValue([
      { id: 't1', name: 'Colombia', start_date: '2027-05-12', end_date: '2027-05-24', travellers: 4, places: 3, nights: 12 },
      { id: 't2', name: 'Lisbon', start_date: null, end_date: null, travellers: 1, places: 0, nights: 0 },
    ])
    open('/trips')
    const colombia = await screen.findByRole('link', { name: /Colombia/ })
    expect(colombia).toHaveTextContent('12 – 24 May 2027 · 3 places · 12 nights · 4 travellers')
    expect(colombia).toHaveAttribute('href', '/trips/t1')
    expect(screen.getByRole('link', { name: /Lisbon/ })).toHaveTextContent('Planning · no dates yet · 1 traveller')
  })
})

describe('create a trip', () => {
  it('step 1 needs a name, and both days when dates are set', async () => {
    open('/trips/new')
    await screen.findByText('Where are you going?')
    click('Next')
    expect(screen.getByLabelText('Trip name')).toHaveAccessibleDescription('Give the trip a name.')

    type('Trip name', 'Colombia')
    fireEvent.click(screen.getByLabelText('Dates not decided yet'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-05-24' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2027-05-12' } })
    click('Next')
    expect(screen.getByText('The trip ends before it starts.')).toBeInTheDocument()
    expect(screen.queryByText('Who’s coming?')).not.toBeInTheDocument()
  })

  it('three steps, then the new trip opens', async () => {
    data.createTrip.mockResolvedValue('t1')
    open('/trips/new')
    await screen.findByText('Where are you going?')
    type('Trip name', '  Colombia with my sisters ')
    type('Leaving from', 'St Martin')
    click('Next')

    // Step 2: you're already there; add Bea and Cleo, remove an empty line.
    expect(await screen.findByText('Who’s coming?')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    type('Traveller 2', 'Bea')
    click('Add a traveller')
    type('Traveller 3', 'Cleo')
    click('Add a traveller')
    click('Remove this traveller')
    click('Next')

    // Step 3: a target per person in pesos.
    expect(await screen.findByText('What’s the budget?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Main currency'), { target: { value: 'COP' } })
    type('Target', '9 000 000')
    click('Create the trip')

    await waitFor(() =>
      expect(data.createTrip).toHaveBeenCalledWith({
        name: 'Colombia with my sisters',
        me: 'Ana',
        travellers: ['Bea', 'Cleo'],
        startDate: null,
        endDate: null,
        homeCity: 'St Martin',
        homeLatitude: null,
        homeLongitude: null,
        currency: 'COP',
        targetAmount: 9000000,
        targetScope: 'per_person',
      }),
    )
    expect(await screen.findByText('Add your first place')).toBeInTheDocument()
  })

  it('a city picked from the suggestions keeps its position for the map', async () => {
    data.searchPlaces.mockResolvedValue([
      { name: 'Saint Martin', detail: 'France', country: 'France', latitude: 18.07, longitude: -63.05 },
    ])
    data.createTrip.mockResolvedValue('t1')
    open('/trips/new')
    await screen.findByText('Where are you going?')
    type('Trip name', 'Colombia')
    type('Leaving from', 'Saint-Mar')
    fireEvent.click(await screen.findByRole('option', { name: /Saint Martin/ }))
    click('Next')
    click('Next')
    click('No target for now')
    await waitFor(() =>
      expect(data.createTrip).toHaveBeenCalledWith(
        expect.objectContaining({ homeCity: 'Saint Martin', homeLatitude: 18.07, targetAmount: null }),
      ),
    )
  })

  it('“It’s just me”: a solo trip, with no one else', async () => {
    data.createTrip.mockResolvedValue('t1')
    open('/trips/new')
    await screen.findByText('Where are you going?')
    type('Trip name', 'Tokyo alone')
    click('Next')
    type('Traveller 2', 'Typo')
    click('It’s just me')
    expect(await screen.findByText('What’s the budget?')).toBeInTheDocument()
    click('No target for now')
    await waitFor(() => expect(data.createTrip).toHaveBeenCalledWith(expect.objectContaining({ me: 'Ana', travellers: [] })))
  })

  it('a target that isn’t an amount is said on the field', async () => {
    open('/trips/new')
    await screen.findByText('Where are you going?')
    type('Trip name', 'Colombia')
    click('Next')
    click('Next')
    type('Target', 'a lot')
    click('Create the trip')
    expect(screen.getByLabelText('Target')).toHaveAccessibleDescription('Enter an amount, like 2500.')
    expect(data.createTrip).not.toHaveBeenCalled()
  })
})
