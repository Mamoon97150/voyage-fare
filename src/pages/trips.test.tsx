import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { AuthProvider } from '../lib/auth'

// Signed in as Ana; trip data and city search are faked.
const session = { user: { email: 'ana@mail.com', user_metadata: { first_name: 'Ana' } } }
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: vi.fn(),
    },
  },
}))

const data = vi.hoisted(() => ({
  createTrip: vi.fn(),
  listTrips: vi.fn(),
  getTrip: vi.fn(),
  addPlace: vi.fn(),
  searchPlaces: vi.fn(),
}))
vi.mock('../lib/trips', () => ({
  createTrip: data.createTrip,
  listTrips: data.listTrips,
  getTrip: data.getTrip,
  addPlace: data.addPlace,
}))
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: data.searchPlaces,
}))

const trip = {
  id: 't1',
  name: 'Colombia',
  start_date: null,
  end_date: null,
  home_city: 'St Martin',
  currency: 'EUR',
  target_amount: 2500,
  target_scope: 'per_person',
}
const travellers = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bea' }]

beforeEach(() => {
  Object.values(data).forEach((fn) => fn.mockReset())
  data.searchPlaces.mockResolvedValue([])
  data.getTrip.mockResolvedValue({ trip, travellers, places: [] })
})

function open(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

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

describe('inside a trip', () => {
  it('says what the trip is, with a dash for the budget', async () => {
    open('/trips/t1')
    expect(await screen.findByRole('heading', { name: 'Colombia' })).toBeInTheDocument()
    expect(screen.getByText('Dates not decided · from St Martin · 2 travellers')).toBeInTheDocument()
    expect(screen.getByText('target 2 500 € pp')).toBeInTheDocument()
  })

  it('adds the first place, then asks for the next one', async () => {
    data.addPlace.mockResolvedValue({ id: 'p1', name: 'Cartagena', country: 'Colombia', nights: 4, position: 1 })
    open('/trips/t1')
    await screen.findByText('Add your first place')
    type('City or area', 'Cartagena')
    type('Nights', '4')
    click('Add the place')
    expect(await screen.findByText('Cartagena')).toBeInTheDocument()
    expect(screen.getByText('4 nights')).toBeInTheDocument()
    expect(screen.getByText('Add the next place')).toBeInTheDocument()
    expect(data.addPlace).toHaveBeenCalledWith(expect.objectContaining({ tripId: 't1', name: 'Cartagena', nights: 4, position: 1 }))
  })

  it('a trip that isn’t shared with you says so', async () => {
    data.getTrip.mockResolvedValue(null)
    open('/trips/nope')
    expect(await screen.findByText('This trip isn’t here')).toBeInTheDocument()
  })
})
