import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { AuthProvider } from '../lib/auth'

// Signed in as Ana; trip data and city search are faked.
const session = { user: { id: 'u-ana', email: 'ana@mail.com', user_metadata: { first_name: 'Ana' } } }
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
  addItem: vi.fn(),
  searchPlaces: vi.fn(),
}))
vi.mock('../lib/trips', () => ({
  createTrip: data.createTrip,
  listTrips: data.listTrips,
  getTrip: data.getTrip,
  addPlace: data.addPlace,
  addItem: data.addItem,
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
const travellers = [
  { id: 'a', name: 'Ana', user_id: 'u-ana' },
  { id: 'b', name: 'Bea', user_id: null },
]
const cartagena = { id: 'p1', name: 'Cartagena', country: 'Colombia', nights: 4, position: 1 }

/** A trip as the database gives it; empty budget unless said otherwise. */
const detail = (over: Record<string, unknown> = {}) => ({
  trip,
  travellers,
  places: [],
  items: [],
  amounts: [],
  shares: [],
  budget: { current_total: null, confirmed_total: null, estimated_total: null, target_total: 5000, missing_amount_count: 0 },
  travellerShares: [],
  placeTotals: [],
  travellerPlaceTotals: [],
  ...over,
})

beforeEach(() => {
  Object.values(data).forEach((fn) => fn.mockReset())
  data.searchPlaces.mockResolvedValue([])
  data.getTrip.mockResolvedValue(detail())
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
    expect(screen.getByText('your share')).toBeInTheDocument()
    expect(screen.getByText('Target 2 500 €. Nothing priced yet.')).toBeInTheDocument()
  })

  it('adds the first place, then asks for the next one', async () => {
    data.addPlace.mockResolvedValue(cartagena)
    data.getTrip.mockResolvedValueOnce(detail()).mockResolvedValue(detail({ places: [cartagena] }))
    open('/trips/t1')
    await screen.findByText('Add your first place')
    type('City or area', 'Cartagena')
    type('Nights', '4')
    click('Add the place')
    expect(await screen.findByRole('heading', { name: /Cartagena/ })).toBeInTheDocument()
    expect(screen.getByText('4 nights')).toBeInTheDocument()
    expect(screen.getByText('Add the next place')).toBeInTheDocument()
    expect(data.addPlace).toHaveBeenCalledWith(expect.objectContaining({ tripId: 't1', name: 'Cartagena', nights: 4, position: 1 }))
  })

  it('adds a stay to a place, with its days and price', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    data.addItem.mockResolvedValue('i1')
    open('/trips/t1')
    await screen.findByRole('button', { name: 'Add to Cartagena' })
    click('Add to Cartagena')
    expect(screen.getByRole('radio', { name: /Stay/ })).toHaveAttribute('aria-checked', 'true')
    type('Name', 'Casa Lola')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: '5' } })
    type('Price', '1 200')
    click('Add')
    await waitFor(() =>
      expect(data.addItem).toHaveBeenCalledWith({
        tripId: 't1',
        placeId: 'p1',
        kind: 'housing',
        name: 'Casa Lola',
        dayNumber: 1,
        endDayNumber: 5,
        amount: 1200,
      }),
    )
  })

  it('a last day before the first one is said on the field', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    open('/trips/t1')
    await screen.findByRole('button', { name: 'Add to Cartagena' })
    click('Add to Cartagena')
    type('Name', 'Casa Lola')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: '2' } })
    click('Add')
    expect(screen.getByLabelText('Until')).toHaveAccessibleDescription('Pick a last day after the first one.')
    expect(data.addItem).not.toHaveBeenCalled()
  })

  const priced = detail({
    places: [cartagena],
    items: [
      { id: 'i1', place_id: 'p1', kind: 'housing', name: 'Casa Lola', status: 'chosen', day_number: 1, end_day_number: 5 },
      { id: 'i2', place_id: 'p1', kind: 'activity', name: 'Rosario islands', status: 'idea', day_number: null, end_day_number: null },
      { id: 'i3', place_id: null, kind: 'transport', name: 'Flights', status: 'chosen', day_number: null, end_day_number: null },
    ],
    amounts: [
      { item_id: 'i1', current: 1200, is_confirmed: false },
      { item_id: 'i2', current: null, is_confirmed: false },
      { item_id: 'i3', current: 1800, is_confirmed: false },
    ],
    shares: [
      { item_id: 'i1', traveller_id: 'a', fraction: 0.5 },
      { item_id: 'i1', traveller_id: 'b', fraction: 0.5 },
      { item_id: 'i3', traveller_id: 'a', fraction: 0.5 },
      { item_id: 'i3', traveller_id: 'b', fraction: 0.5 },
    ],
    budget: { current_total: 3000, confirmed_total: null, estimated_total: 3000, target_total: 5000, missing_amount_count: 0 },
    travellerShares: [{ traveller_id: 'a', share_current: 1500, share_confirmed: null, share_estimated: 1500 }],
    placeTotals: [{ place_id: 'p1', current: 1200 }],
    travellerPlaceTotals: [{ place_id: 'p1', traveller_id: 'a', current: 600 }],
  })

  it('shows your share everywhere, and the total at a tap', async () => {
    data.getTrip.mockResolvedValue(priced)
    open('/trips/t1')
    expect(await screen.findByText('1 000 € under your 2 500 € target')).toBeInTheDocument()
    expect(screen.getByText('1 500 €')).toBeInTheDocument() // your share in the bar
    expect(screen.getByText('900 €')).toBeInTheDocument() // your half of the flights
    expect(screen.getByText('Idea')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Total' }))
    expect(screen.getByText('3 000 €')).toBeInTheDocument()
    expect(screen.getByText('1 800 €')).toBeInTheDocument()
    expect(screen.getByText('2 000 € under your 5 000 € target')).toBeInTheDocument()
  })

  it('solo: no switch, the trip is your share', async () => {
    data.getTrip.mockResolvedValue({ ...priced, travellers: [travellers[0]] })
    open('/trips/t1')
    expect(await screen.findByText('the trip')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Total' })).not.toBeInTheDocument()
  })

  it('a trip that isn’t shared with you says so', async () => {
    data.getTrip.mockResolvedValue(null)
    open('/trips/nope')
    expect(await screen.findByText('This trip isn’t here')).toBeInTheDocument()
  })
})
