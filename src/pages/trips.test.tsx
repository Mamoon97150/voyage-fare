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
  getTripHeader: vi.fn(),
  updateTrip: vi.fn(),
  isTripOwner: vi.fn(),
  deleteTrip: vi.fn(),
  addTraveller: vi.fn(),
  renameTraveller: vi.fn(),
  removeTraveller: vi.fn(),
  addOption: vi.fn(),
  addItemWithOption: vi.fn(),
  updateOption: vi.fn(),
  chooseOption: vi.fn(),
  setFavourite: vi.fn(),
  deleteOption: vi.fn(),
  addItem: vi.fn(),
  addTicket: vi.fn(),
  updateItem: vi.fn(),
  updateTicket: vi.fn(),
  deleteItem: vi.fn(),
  updatePlace: vi.fn(),
  deletePlace: vi.fn(),
  searchPlaces: vi.fn(),
}))
vi.mock('../lib/trips', () => ({
  createTrip: data.createTrip,
  listTrips: data.listTrips,
  getTrip: data.getTrip,
  addPlace: data.addPlace,
  getTripHeader: data.getTripHeader,
  updateTrip: data.updateTrip,
  isTripOwner: data.isTripOwner,
  deleteTrip: data.deleteTrip,
  addTraveller: data.addTraveller,
  renameTraveller: data.renameTraveller,
  removeTraveller: data.removeTraveller,
  addOption: data.addOption,
  addItemWithOption: data.addItemWithOption,
  updateOption: data.updateOption,
  chooseOption: data.chooseOption,
  setFavourite: data.setFavourite,
  deleteOption: data.deleteOption,
  addItem: data.addItem,
  addTicket: data.addTicket,
  updateItem: data.updateItem,
  updateTicket: data.updateTicket,
  deleteItem: data.deleteItem,
  updatePlace: data.updatePlace,
  deletePlace: data.deletePlace,
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
  options: [],
  legs: [],
  amounts: [],
  shares: [],
  budget: { current_total: null, confirmed_total: null, estimated_total: null, target_total: 5000, missing_amount_count: 0 },
  travellerShares: [],
  placeTotals: [],
  travellerPlaceTotals: [],
  ...over,
})

beforeEach(() => {
  window.localStorage.clear()
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
    expect(screen.getByRole('button', { name: 'Add a place' })).toBeInTheDocument()
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

  it('a price typed the French way is read right (2.400.000, not 2.4)', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    data.addItem.mockResolvedValue('i1')
    open('/trips/t1')
    await screen.findByRole('button', { name: 'Add to Cartagena' })
    click('Add to Cartagena')
    type('Name', 'Casa Lola')
    type('Price', '2.400.000')
    click('Add')
    await waitFor(() => expect(data.addItem).toHaveBeenCalledWith(expect.objectContaining({ amount: 2400000 })))
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

  it('a ticket: cities suggested from the route, a round trip by default from home', async () => {
    const medellin = { id: 'p2', name: 'Medellín', country: 'Colombia', nights: 3, position: 2 }
    data.getTrip.mockResolvedValue(detail({ places: [cartagena, medellin] }))
    data.addTicket.mockResolvedValue('t9')
    open('/trips/t1')
    await screen.findByRole('button', { name: 'Add to the whole trip' })
    click('Add to the whole trip')
    expect(screen.getByRole('radio', { name: /Transport/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('From')).toHaveValue('St Martin')
    expect(screen.getByLabelText('To')).toHaveValue('Cartagena')
    expect(screen.getByLabelText('Round trip, one ticket')).toBeChecked()
    expect(screen.getByLabelText('The way back')).toHaveValue('p2') // after the last place
    type('Via (optional)', 'Panama')
    type('Price (both ways)', '1 800 000')
    click('Add the ticket')
    await waitFor(() =>
      expect(data.addTicket).toHaveBeenCalledWith({
        tripId: 't1',
        from: 'St Martin',
        to: 'Cartagena',
        mode: 'plane',
        name: null,
        via: 'Panama',
        afterPlaceId: null,
        roundTrip: true,
        returnAfterPlaceId: 'p2',
        amount: 1800000,
      }),
    )
  })

  it('moving a ticket in the route suggests the next cities', async () => {
    const medellin = { id: 'p2', name: 'Medellín', country: 'Colombia', nights: 3, position: 2 }
    data.getTrip.mockResolvedValue(detail({ places: [cartagena, medellin] }))
    open('/trips/t1')
    await screen.findByRole('button', { name: 'Add to the whole trip' })
    click('Add to the whole trip')
    fireEvent.change(screen.getByLabelText('In the route'), { target: { value: 'p1' } })
    expect(screen.getByLabelText('From')).toHaveValue('Cartagena')
    expect(screen.getByLabelText('To')).toHaveValue('Medellín')
    expect(screen.getByLabelText('Round trip, one ticket')).not.toBeChecked()
  })

  it('draws a round trip in the route: priced on the way out, included on the way back', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        places: [cartagena],
        items: [{ id: 'f', place_id: null, kind: 'transport', name: 'St Martin ⇄ Cartagena', status: 'chosen' }],
        legs: [
          { id: 'l1', item_id: 'f', leg_number: 1, mode: 'plane', from_name: 'St Martin', to_name: 'Cartagena', via: null, after_place_id: null, position: 0 },
          { id: 'l2', item_id: 'f', leg_number: 2, mode: 'plane', from_name: 'Cartagena', to_name: 'St Martin', via: null, after_place_id: 'p1', position: 1 },
        ],
        amounts: [{ item_id: 'f', current: 1800, is_confirmed: false }],
        shares: [
          { item_id: 'f', traveller_id: 'a', fraction: 0.5 },
          { item_id: 'f', traveller_id: 'b', fraction: 0.5 },
        ],
      }),
    )
    open('/trips/t1')
    expect(await screen.findByText('St Martin → Cartagena')).toBeInTheDocument()
    expect(screen.getByText('Cartagena → St Martin')).toBeInTheDocument()
    expect(screen.getByText('⇄ Round trip')).toBeInTheDocument()
    expect(screen.getByText('Included in the round trip')).toBeInTheDocument()
    expect(screen.getAllByText('900 €')).toHaveLength(1) // counted once, your half
    // Not listed again in the whole-trip sheet.
    expect(screen.queryByText('St Martin ⇄ Cartagena')).not.toBeInTheDocument()
  })

  it('a trip that isn’t shared with you says so', async () => {
    data.getTrip.mockResolvedValue(null)
    open('/trips/nope')
    expect(await screen.findByText('This trip isn’t here')).toBeInTheDocument()
  })
})

describe('changing what was added', () => {
  const roundTrip = {
    places: [cartagena],
    items: [
      { id: 'i1', place_id: 'p1', kind: 'housing', name: 'Casa Lola', status: 'chosen', day_number: 1, end_day_number: 5 },
      { id: 'f', place_id: null, kind: 'transport', name: 'St Martin ⇄ Cartagena', status: 'chosen', day_number: null, end_day_number: null },
    ],
    legs: [
      { id: 'l1', item_id: 'f', leg_number: 1, mode: 'plane', from_name: 'St Martin', to_name: 'Cartagena', via: 'Panama', after_place_id: null, position: 0 },
      { id: 'l2', item_id: 'f', leg_number: 2, mode: 'plane', from_name: 'Cartagena', to_name: 'St Martin', via: 'Panama', after_place_id: 'p1', position: 1 },
    ],
    amounts: [
      { item_id: 'i1', current: 1200, is_confirmed: false },
      { item_id: 'f', current: 1800, is_confirmed: false },
    ],
  }

  it('tap an item: the same form, filled in; save the new price', async () => {
    data.getTrip.mockResolvedValue(detail(roundTrip))
    data.updateItem.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Casa Lola')
    expect(screen.getByLabelText('From')).toHaveValue('1')
    expect(screen.getByLabelText('Until')).toHaveValue('5')
    expect(screen.getByLabelText('Price')).toHaveValue('1 200')
    type('Price', '1 350')
    click('Save')
    await waitFor(() =>
      expect(data.updateItem).toHaveBeenCalledWith({
        id: 'i1',
        kind: 'housing',
        name: 'Casa Lola',
        dayNumber: 1,
        endDayNumber: 5,
        amount: 1350,
        keepPrice: false,
      }),
    )
  })

  it('delete asks once, and says it can’t be undone', async () => {
    data.getTrip.mockResolvedValue(detail(roundTrip))
    data.deleteItem.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    click('Delete')
    expect(screen.getByText('This can’t be undone.')).toBeInTheDocument()
    expect(data.deleteItem).not.toHaveBeenCalled()
    click('Keep it')
    click('Delete')
    click('Yes, delete Casa Lola')
    await waitFor(() => expect(data.deleteItem).toHaveBeenCalledWith('i1'))
  })

  it('tap a ticket leg: its route comes back; make it one way', async () => {
    data.getTrip.mockResolvedValue(detail(roundTrip))
    data.updateTicket.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Cartagena → St Martin' }))
    expect(screen.getByLabelText('From')).toHaveValue('St Martin')
    expect(screen.getByLabelText('Via (optional)')).toHaveValue('Panama')
    expect(screen.getByLabelText('Round trip, one ticket')).toBeChecked()
    expect(screen.getByLabelText('Price (both ways)')).toHaveValue('1 800')
    fireEvent.click(screen.getByLabelText('Round trip, one ticket'))
    type('Price', '1 000')
    click('Save')
    await waitFor(() =>
      expect(data.updateTicket).toHaveBeenCalledWith('f', {
        from: 'St Martin',
        to: 'Cartagena',
        mode: 'plane',
        via: 'Panama',
        afterPlaceId: null,
        roundTrip: false,
        returnAfterPlaceId: null,
        amount: 1000,
      }),
    )
  })

  it('deleting a round trip says both ways go', async () => {
    data.getTrip.mockResolvedValue(detail(roundTrip))
    data.deleteItem.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change St Martin → Cartagena' }))
    click('Delete')
    expect(screen.getByText('Both ways go, and its price comes out of the budget.')).toBeInTheDocument()
    click('Yes, delete this ticket')
    await waitFor(() => expect(data.deleteItem).toHaveBeenCalledWith('f'))
  })

  it('a place: rename it, change its nights, or delete it with what’s in it', async () => {
    data.getTrip.mockResolvedValue(detail(roundTrip))
    data.updatePlace.mockResolvedValue(undefined)
    data.deletePlace.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Cartagena' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Cartagena')
    // Only the edit form has a Nights field now: the add-place form is closed until asked for.
    fireEvent.change(document.getElementById('place-edit-p1-nights')!, { target: { value: '5' } })
    click('Save')
    await waitFor(() => expect(data.updatePlace).toHaveBeenCalledWith('p1', { name: 'Cartagena', nights: 5 }))

    fireEvent.click(await screen.findByRole('button', { name: 'Change Cartagena' }))
    click('Delete')
    expect(screen.getByText(/Cartagena and the 1 thing in it go. Tickets after it move up in the route./)).toBeInTheDocument()
    click('Yes, delete Cartagena')
    await waitFor(() => expect(data.deletePlace).toHaveBeenCalledWith('p1'))
  })
})

describe('design review fixes (13 Nov)', () => {
  const trip3 = {
    places: [cartagena],
    items: [
      { id: 'i1', place_id: 'p1', kind: 'housing', name: 'Casa Lola', status: 'chosen', day_number: null, end_day_number: null },
      { id: 'i2', place_id: 'p1', kind: 'activity', name: 'Islands', status: 'booked', day_number: 2, end_day_number: null },
    ],
    amounts: [
      { item_id: 'i1', current: 1200, is_confirmed: false },
      { item_id: 'i2', current: 90, is_confirmed: true },
    ],
  }

  it('says once that rows can be tapped, until the first time', async () => {
    data.getTrip.mockResolvedValue(detail(trip3))
    const first = open('/trips/t1')
    expect(await screen.findByText('tap anything to change it')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change Casa Lola' }))
    expect(screen.queryByText('tap anything to change it')).not.toBeInTheDocument()
    first.unmount()
    open('/trips/t1')
    await screen.findByRole('heading', { name: /Cartagena/ })
    expect(screen.queryByText('tap anything to change it')).not.toBeInTheDocument()
  })

  it('“Chosen” stays silent; Booked says so', async () => {
    data.getTrip.mockResolvedValue(detail(trip3))
    open('/trips/t1')
    await screen.findByRole('button', { name: 'Change Casa Lola' })
    expect(screen.queryByText('Chosen')).not.toBeInTheDocument()
    expect(screen.getByText('Booked')).toBeInTheDocument()
  })
})

describe('moving around a trip', () => {
  it('the bottom bar: Trip, Compare, Budget, Who paid', async () => {
    open('/trips/t1')
    const nav = await screen.findByRole('navigation', { name: 'Trip' })
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])
    expect(links).toEqual([
      ['Trip', '/trips/t1'],
      ['Compare', '/trips/t1/compare'],
      ['Budget', '/trips/t1/budget'],
      ['Who paid', '/trips/t1/who-paid'],
    ])
  })

  it('solo: no Who paid', async () => {
    data.getTrip.mockResolvedValue(detail({ travellers: [travellers[0]] }))
    open('/trips/t1')
    const nav = await screen.findByRole('navigation', { name: 'Trip' })
    expect(nav).not.toHaveTextContent('Who paid')
  })

  it('a page not built yet says what’s coming, and keeps the bar', async () => {
    data.getTripHeader.mockResolvedValue({ name: 'Colombia', travellers: 3 })
    open('/trips/t1/budget')
    expect(await screen.findByRole('heading', { name: 'Budget', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Trip' })).toBeInTheDocument()
  })
})

describe('trip settings', () => {
  it('the initials at the top lead to the settings', async () => {
    open('/trips/t1')
    const link = await screen.findByRole('link', { name: 'Trip settings: Ana, Bea' })
    expect(link).toHaveAttribute('href', '/trips/t1/settings')
  })

  it('change the name, dates and target, and save', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.updateTrip.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    expect(await screen.findByLabelText('Name')).toHaveValue('Colombia')
    type('Name', 'Colombia with my sisters')
    fireEvent.click(screen.getByLabelText('Dates not decided yet'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-05-12' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2027-05-24' } })
    type('Target', '3.000')
    click('Save the trip')
    await waitFor(() =>
      expect(data.updateTrip).toHaveBeenCalledWith('t1', {
        name: 'Colombia with my sisters',
        startDate: '2027-05-12',
        endDate: '2027-05-24',
        homeCity: 'St Martin',
        homeLatitude: undefined,
        homeLongitude: undefined,
        targetAmount: 3000,
        targetScope: 'per_person',
      }),
    )
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('removing a traveller who paid says why it can’t', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.removeTraveller.mockRejectedValue({ code: 'P0001', message: 'Bea has paid or owes money on this trip: settle up first.' })
    open('/trips/t1/settings')
    await screen.findByText('Travellers')
    expect(screen.queryByRole('button', { name: 'Remove Ana' })).not.toBeInTheDocument() // that's you
    click('Remove Bea')
    click('Yes, remove Bea')
    expect(await screen.findByText('Bea has paid or owes money on this trip: settle up first.')).toBeInTheDocument()
  })

  it('rename and add travellers', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.renameTraveller.mockResolvedValue(undefined)
    data.addTraveller.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    await screen.findByText('Travellers')
    click('Rename Bea')
    type('New name for Bea', 'Béatrice')
    click('Save')
    await waitFor(() => expect(data.renameTraveller).toHaveBeenCalledWith('b', 'Béatrice'))
    type('New traveller', 'Dana')
    click('Add')
    await waitFor(() => expect(data.addTraveller).toHaveBeenCalledWith('t1', 'Dana', expect.any(Number)))
  })

  it('only the creator can delete the trip', async () => {
    data.isTripOwner.mockResolvedValue(false)
    open('/trips/t1/settings')
    expect(await screen.findByText('Only the person who created this trip can delete it.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete Colombia/ })).not.toBeInTheDocument()
  })

  it('the creator deletes it after one confirmation, and lands on Your trips', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.deleteTrip.mockResolvedValue(undefined)
    data.listTrips.mockResolvedValue([])
    open('/trips/t1/settings')
    await screen.findByRole('button', { name: 'Delete Colombia' })
    click('Delete Colombia')
    expect(screen.getByText(/Everything in Colombia goes/)).toBeInTheDocument()
    click('Yes, delete Colombia')
    await waitFor(() => expect(data.deleteTrip).toHaveBeenCalledWith('t1'))
    expect(await screen.findByText('No trips yet')).toBeInTheDocument()
  })
})

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
    expect(screen.getByText(/Round trip · 2 options · journey 1 of 1/)).toBeInTheDocument()
    const names = screen.getAllByRole('button', { name: /^Change / }).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Change Avianca', 'Change Copa'])
    expect(screen.getByText('700 €')).toBeInTheDocument() // your half of Avianca
    expect(screen.getByText('Cheapest', { selector: '.option__tag' })).toBeInTheDocument()
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
    click('Choose')
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
