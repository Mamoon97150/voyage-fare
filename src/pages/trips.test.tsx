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
  getMoney: vi.fn(),
  addRepayment: vi.fn(),
  deleteRepayment: vi.fn(),
  updateTrip: vi.fn(),
  isTripOwner: vi.fn(),
  deleteTrip: vi.fn(),
  addTraveller: vi.fn(),
  renameTraveller: vi.fn(),
  removeTraveller: vi.fn(),
  addOption: vi.fn(),
  addItemWithOption: vi.fn(),
  updateOption: vi.fn(),
  setOptionRooms: vi.fn(),
  chooseOption: vi.fn(),
  setFavourite: vi.fn(),
  deleteOption: vi.fn(),
  addItem: vi.fn(),
  addTicket: vi.fn(),
  updateItem: vi.fn(),
  updateTicket: vi.fn(),
  setItemStatus: vi.fn(),
  changeTripCurrency: vi.fn(),
  setItemDropped: vi.fn(),
  setItemSplit: vi.fn(),
  deleteItem: vi.fn(),
  updatePlace: vi.fn(),
  deletePlace: vi.fn(),
  searchPlaces: vi.fn(),
  listOpenInvitations: vi.fn(),
  inviteTraveller: vi.fn(),
  cancelInvitation: vi.fn(),
  getInvitationPreview: vi.fn(),
  acceptInvitation: vi.fn(),
  getMyWelcome: vi.fn(),
  leaveTrip: vi.fn(),
}))
vi.mock('../lib/trips', () => ({
  createTrip: data.createTrip,
  listTrips: data.listTrips,
  getTrip: data.getTrip,
  addPlace: data.addPlace,
  getMoney: data.getMoney,
  addRepayment: data.addRepayment,
  deleteRepayment: data.deleteRepayment,
  updateTrip: data.updateTrip,
  isTripOwner: data.isTripOwner,
  deleteTrip: data.deleteTrip,
  addTraveller: data.addTraveller,
  renameTraveller: data.renameTraveller,
  removeTraveller: data.removeTraveller,
  addOption: data.addOption,
  addItemWithOption: data.addItemWithOption,
  updateOption: data.updateOption,
  setOptionRooms: data.setOptionRooms,
  chooseOption: data.chooseOption,
  setFavourite: data.setFavourite,
  deleteOption: data.deleteOption,
  addItem: data.addItem,
  addTicket: data.addTicket,
  updateItem: data.updateItem,
  updateTicket: data.updateTicket,
  setItemStatus: data.setItemStatus,
  changeTripCurrency: data.changeTripCurrency,
  setItemDropped: data.setItemDropped,
  setItemSplit: data.setItemSplit,
  deleteItem: data.deleteItem,
  updatePlace: data.updatePlace,
  deletePlace: data.deletePlace,
  listOpenInvitations: data.listOpenInvitations,
  inviteTraveller: data.inviteTraveller,
  cancelInvitation: data.cancelInvitation,
  getInvitationPreview: data.getInvitationPreview,
  acceptInvitation: data.acceptInvitation,
  getMyWelcome: data.getMyWelcome,
  leaveTrip: data.leaveTrip,
  joinLink: (token: string) => `https://voyagefare.test/join/${token}`,
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
  created_by: 'u-ana',
  is_demo: false,
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
  rooms: [],
  roomOccupants: [],
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
    expect(screen.getByText('Dates not decided · 2 travellers')).toBeInTheDocument()
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
    expect(screen.getByText('1 500 €', { selector: '.trip-budget__figure' })).toBeInTheDocument() // your share in the bar
    expect(screen.getByText('900 €')).toBeInTheDocument() // your half of the flights
    expect(screen.getByText('Idea')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'total' }))
    expect(screen.getByText('3 000 €', { selector: '.trip-budget__figure' })).toBeInTheDocument()
    expect(screen.getByText('1 800 €')).toBeInTheDocument()
    expect(screen.getByText('2 000 € under your 5 000 € target')).toBeInTheDocument()
  })

  it('solo: no switch, the trip is your share', async () => {
    data.getTrip.mockResolvedValue({ ...priced, travellers: [travellers[0]] })
    open('/trips/t1')
    expect(await screen.findByText(/the trip/)).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'total' })).not.toBeInTheDocument()
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
      }, false),
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

  it('only the creator can delete the trip; the others can leave it', async () => {
    data.isTripOwner.mockResolvedValue(false)
    open('/trips/t1/settings')
    expect(await screen.findByRole('button', { name: 'Leave Colombia' })).toBeInTheDocument()
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

describe('where it stands', () => {
  const stay = (over: Record<string, unknown> = {}) =>
    detail({
      places: [cartagena],
      items: [{ id: 'i1', place_id: 'p1', kind: 'housing', name: 'Casa Lola', status: 'chosen', day_number: null, end_day_number: null, actual_amount: null, paid_by: null, paid_on: null, ...over }],
      options: [{ id: 'o1', item_id: 'i1', name: 'Casa Lola', amount: 1200, rate: 1, is_chosen: true, position: 1, details: {} }],
      amounts: [{ item_id: 'i1', current: 1200, is_confirmed: false }],
    })

  it('booked, for what it really costs', async () => {
    data.getTrip.mockResolvedValue(stay())
    data.setItemStatus.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    expect(screen.getByRole('radio', { name: 'Chosen' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Booked' }))
    expect(screen.getByLabelText('Booked for')).toHaveValue('1 200')
    type('Booked for', '1 150')
    click('Save where it stands')
    await waitFor(() =>
      expect(data.setItemStatus).toHaveBeenCalledWith({ id: 'i1', status: 'booked', actualAmount: 1150, paidBy: null, paidEach: false, paidOn: null }),
    )
  })

  it('paid: by whom, you by default', async () => {
    data.getTrip.mockResolvedValue(stay({ status: 'booked', actual_amount: 1150 }))
    data.setItemStatus.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Paid' }))
    expect(screen.getByLabelText('Really paid')).toHaveValue('1 150')
    expect(screen.getByLabelText('Paid by')).toHaveValue('a')
    fireEvent.change(screen.getByLabelText('Paid by'), { target: { value: 'b' } })
    click('Save where it stands')
    await waitFor(() =>
      expect(data.setItemStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', actualAmount: 1150, paidBy: 'b' })),
    )
  })

  it('paid needs the amount', async () => {
    data.getTrip.mockResolvedValue(stay())
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Paid' }))
    type('Really paid', '')
    click('Save where it stands')
    expect(await screen.findByText('How much was really paid?')).toBeInTheDocument()
    expect(data.setItemStatus).not.toHaveBeenCalled()
  })

  it('an idea has nothing to book yet', async () => {
    data.getTrip.mockResolvedValue(detail({ ...stay(), options: [] }))
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    expect(screen.queryByRole('radio', { name: 'Booked' })).not.toBeInTheDocument()
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

describe('currencies', () => {
  // Today's rates, faked: 1 USD = 0,90 EUR; 1 EUR = 3 645 COP.
  const rates: Record<string, Record<string, number>> = { USD: { EUR: 0.9 }, COP: { EUR: 0.00027435 }, EUR: { COP: 3645, USD: 1.1111 } }
  beforeEach(async () => {
    const { clearRates } = await import('../lib/rates')
    clearRates()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const base = url.split('/').pop() ?? ''
        return { ok: true, json: async () => ({ result: 'success', rates: rates[base] ?? {} }) }
      }),
    )
  })

  const stayPage = (options: unknown[] = []) =>
    detail({
      places: [cartagena],
      items: [{ id: 'i1', place_id: 'p1', kind: 'activity', name: 'Photoshoot', status: 'chosen', day_number: null, end_day_number: null }],
      options,
    })

  it('an option in dollars: today’s rate filled in, saved with the price', async () => {
    data.getTrip.mockResolvedValue(stayPage([{ id: 'o1', item_id: 'i1', name: 'Viator', amount: 81, currency: 'EUR', rate: 1, is_chosen: true, position: 1, details: {} }]))
    data.addOption.mockResolvedValue('o2')
    open('/trips/t1/compare?tab=activities&page=p1')
    click(await screen.findByText('Add an option').then(() => 'Add an option'))
    type('Name', 'Fly Dress')
    type('Price', '230')
    fireEvent.change(screen.getByLabelText('Price: currency'), { target: { value: 'USD' } })
    expect(await screen.findByDisplayValue('1,1111')).toBeInTheDocument() // 1 EUR = 1,1111 USD
    expect(screen.getByText(/≈ 207 €/)).toBeInTheDocument()
    click('Add the option')
    await waitFor(() =>
      expect(data.addOption).toHaveBeenCalledWith(expect.anything(), 'i1', expect.objectContaining({ amount: 230, currency: 'USD', rate: 0.9 })),
    )
  })

  it('pesos read the other way round: 1 EUR = 3 645 COP', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    data.addItemWithOption.mockResolvedValue(undefined)
    open('/trips/t1/compare?tab=activities&page=p1')
    fireEvent.click(await screen.findByRole('button', { name: /Add an activity/ }))
    type('Name', 'Nails')
    type('Price', '615 000')
    fireEvent.change(screen.getByLabelText('Price: currency'), { target: { value: 'COP' } })
    expect(await screen.findByDisplayValue('3 645')).toBeInTheDocument()
    expect(screen.getByText('1 EUR =')).toBeInTheDocument()
    click('Add the option')
    await waitFor(() =>
      expect(data.addItemWithOption).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ currency: 'COP', rate: 0.00027435 }),
      ),
    )
  })

  it('no rate to be had: it asks for one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    data.getTrip.mockResolvedValue(stayPage([{ id: 'o1', item_id: 'i1', name: 'Viator', amount: 81, currency: 'EUR', rate: 1, is_chosen: true, position: 1, details: {} }]))
    open('/trips/t1/compare?tab=activities&page=p1')
    click(await screen.findByText('Add an option').then(() => 'Add an option'))
    type('Name', 'Fly Dress')
    type('Price', '230')
    fireEvent.change(screen.getByLabelText('Price: currency'), { target: { value: 'USD' } })
    expect(await screen.findByText(/Couldn’t get today’s rate/)).toBeInTheDocument()
    click('Add the option')
    expect(await screen.findByText('What’s the rate? 1 USD is how many EUR?')).toBeInTheDocument()
    expect(data.addOption).not.toHaveBeenCalled()
  })

  it('a card in dollars: the price as typed, then what it comes to', async () => {
    data.getTrip.mockResolvedValue(stayPage([{ id: 'o1', item_id: 'i1', name: 'Fly Dress', amount: 230, currency: 'USD', rate: 0.9, is_chosen: true, position: 1, details: {} }]))
    open('/trips/t1/compare?tab=activities&page=p1')
    expect(await screen.findByText('230 $ for 2 · ≈ 207 €')).toBeInTheDocument()
  })

  it('settings: change the main currency at today’s rate; the target follows', async () => {
    data.getTrip.mockResolvedValue(detail())
    data.isTripOwner.mockResolvedValue(true)
    data.changeTripCurrency.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    click(await screen.findByText('Change the main currency').then(() => 'Change the main currency'))
    fireEvent.change(screen.getByLabelText('New main currency'), { target: { value: 'COP' } })
    expect(await screen.findByDisplayValue('3 645')).toBeInTheDocument()
    expect(screen.getByText(/Your target becomes 9 112 500 COP/)).toBeInTheDocument()
    click('Change to COP')
    await waitFor(() => expect(data.changeTripCurrency).toHaveBeenCalledWith('t1', 'COP', 3645))
  })

  it('settings: fixed once someone has paid', async () => {
    data.getTrip.mockResolvedValue(detail({ items: [{ id: 'i1', place_id: null, kind: 'other', name: 'x', status: 'paid' }] }))
    data.isTripOwner.mockResolvedValue(true)
    open('/trips/t1/settings')
    expect(await screen.findByText(/Fixed since the first payment/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change the main currency' })).not.toBeInTheDocument()
  })
})

describe('review fixes (13 Nov)', () => {
  const nails = (over: Record<string, unknown> = {}) =>
    detail({
      places: [cartagena],
      items: [{ id: 'i1', place_id: 'p1', kind: 'activity', name: 'Nails', status: 'chosen', day_number: null, end_day_number: null, ...over }],
      options: [{ id: 'o1', item_id: 'i1', name: 'Momo Beauty Bar', amount: 615000, currency: 'COP', rate: 0.00027435, is_chosen: true, position: 1, details: {} }],
      amounts: [{ item_id: 'i1', current: 168.73, is_confirmed: false }],
      shares: [
        { item_id: 'i1', traveller_id: 'a', fraction: 0.5 },
        { item_id: 'i1', traveller_id: 'b', fraction: 0.5 },
      ],
    })

  it('a line in pesos: its form shows the price from Compare and leaves it alone', async () => {
    data.getTrip.mockResolvedValue(nails())
    data.updateItem.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Momo Beauty Bar' }))
    expect(screen.getByText(/615 000 COP ≈ 169 €/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Price')).not.toBeInTheDocument()
    expect(screen.getByLabelText('What you’re deciding')).toHaveValue('Nails')
    click('Save')
    await waitFor(() => expect(data.updateItem).toHaveBeenCalledWith(expect.objectContaining({ keepPrice: true })))
  })

  it('lines in whole units; 0 is Included when booked, Free otherwise', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        places: [cartagena],
        items: [
          { id: 'h', place_id: 'p1', kind: 'housing', name: 'Hotel', status: 'booked', day_number: null, end_day_number: null },
          { id: 'm', place_id: 'p1', kind: 'activity', name: 'Museum', status: 'chosen', day_number: null, end_day_number: null },
          { id: 'n', place_id: 'p1', kind: 'activity', name: 'Nails', status: 'chosen', day_number: null, end_day_number: null },
        ],
        amounts: [
          { item_id: 'h', current: 0, is_confirmed: true },
          { item_id: 'm', current: 0, is_confirmed: false },
          { item_id: 'n', current: 84.36, is_confirmed: false },
        ],
      }),
    )
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('radio', { name: 'total' }))
    expect(await screen.findByText('Included')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('84 €')).toBeInTheDocument()
  })

  it('drop a line, then bring it back', async () => {
    data.getTrip.mockResolvedValue(nails())
    data.setItemDropped.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Momo Beauty Bar' }))
    click('Drop it')
    await waitFor(() => expect(data.setItemDropped).toHaveBeenCalledWith('i1', true))
  })

  it('a dropped line: greyed, not counted, and it can come back', async () => {
    data.getTrip.mockResolvedValue({ ...nails({ status: 'dropped' }), options: (nails().options as Record<string, unknown>[]).map((o) => ({ ...o, is_chosen: false })), amounts: [] })
    data.setItemDropped.mockResolvedValue(undefined)
    open('/trips/t1')
    expect(await screen.findByText('Dropped')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change Nails' }))
    click('Bring it back')
    await waitFor(() => expect(data.setItemDropped).toHaveBeenCalledWith('i1', false))
  })

  it('a dropped line doesn’t leave a “to decide” dot', async () => {
    data.getTrip.mockResolvedValue({ ...nails({ status: 'dropped' }), options: (nails().options as Record<string, unknown>[]).map((o) => ({ ...o, is_chosen: false })) })
    open('/trips/t1/compare?tab=activities&page=p1')
    expect(await screen.findByText(/Kept for the record/)).toBeInTheDocument()
    expect(screen.getByText(/dropped/, { selector: '.compare-item__dropped' })).toBeInTheDocument()
    expect(screen.queryByText('(something to decide)')).not.toBeInTheDocument()
  })
})

describe('Budget and Who paid (build 4)', () => {
  // Ana and Bea; Ana paid the 1 000 € flat; the 200 € dinner is a gift to Bea (only Ana on it).
  const flat = { id: 'flat', place_id: 'p1', kind: 'housing', name: 'Flat', category: 'accommodation', status: 'paid', paid_by: 'a', paid_each: false, paid_on: '2026-09-01', actual_amount: 1000, actual_currency: 'EUR', day_number: null, end_day_number: null }
  const dinner = { id: 'din', place_id: 'p1', kind: 'restaurant', name: 'Dinner', category: 'food', status: 'chosen', paid_by: null, paid_each: false, day_number: 2, end_day_number: null }
  const lunch = { id: 'lun', place_id: 'p1', kind: 'restaurant', name: 'Lunch', category: 'food', status: 'chosen', paid_by: null, paid_each: false, day_number: 3, end_day_number: null }
  const trip2 = detail({
    places: [cartagena],
    items: [flat, dinner, lunch],
    options: [
      { id: 'o1', item_id: 'flat', name: 'Flat', amount: 1000, rate: 1, currency: 'EUR', is_chosen: true, position: 1, details: {} },
      { id: 'o2', item_id: 'din', name: 'Dinner', amount: 200, rate: 1, currency: 'EUR', is_chosen: true, position: 1, details: {} },
      { id: 'o3', item_id: 'lun', name: 'La Puerta Falsa', amount: null, rate: 1, currency: 'EUR', is_chosen: true, position: 1, details: {} },
    ],
    amounts: [
      { item_id: 'flat', current: 1000, actual: 1000, is_confirmed: true, status: 'paid' },
      { item_id: 'din', current: 200, actual: null, is_confirmed: false, status: 'chosen' },
    ],
    shares: [
      { item_id: 'flat', traveller_id: 'a', fraction: 0.5 },
      { item_id: 'flat', traveller_id: 'b', fraction: 0.5 },
      { item_id: 'din', traveller_id: 'a', fraction: 1 },
    ],
    budget: { current_total: 1200, confirmed_total: 1000, estimated_total: 200, target_total: null, missing_amount_count: 1 },
    travellerShares: [
      { traveller_id: 'a', share_current: 700, share_confirmed: 500, share_estimated: 200 },
      { traveller_id: 'b', share_current: 500, share_confirmed: 500, share_estimated: null },
    ],
    placeTotals: [{ place_id: 'p1', current: 1200, confirmed: 1000, estimated: 200 }],
    travellerPlaceTotals: [{ place_id: 'p1', traveller_id: 'a', current: 700, confirmed: 500, estimated: 200 }],
  })
  const money = {
    categories: [],
    travellerCategories: [
      { traveller_id: 'a', category: 'accommodation', current: 500, confirmed: 500, estimated: null },
      { traveller_id: 'a', category: 'food', current: 200, confirmed: null, estimated: 200 },
    ],
    balances: [
      { traveller_id: 'a', paid: 1000, share_of_paid: 500, repaid: 0, received: 0, balance: 500 },
      { traveller_id: 'b', paid: 0, share_of_paid: 500, repaid: 0, received: 0, balance: -500 },
    ],
    settlement: [{ from_traveller: 'b', to_traveller: 'a', amount: 500 }],
    repayments: [],
  }

  beforeEach(() => {
    data.getTrip.mockResolvedValue(trip2)
    data.getMoney.mockResolvedValue(money)
  })

  it('Budget: one card per section, your share by category and by place', async () => {
    open('/trips/t1/budget')
    expect(await screen.findByRole('region', { name: 'By category' })).toHaveTextContent('Stay')
    expect(screen.getByRole('region', { name: 'By category' })).toHaveTextContent('1 without a price')
    expect(screen.getByRole('region', { name: 'By place' })).toHaveTextContent('Cartagena')
    const everyone = screen.getByRole('region', { name: 'Everyone’s share' })
    expect(everyone).toHaveTextContent('1 200 €')
    expect(everyone).toHaveTextContent('just yours: Dinner')
    expect(everyone).not.toHaveTextContent('not in') // a line for one person isn’t a gift to the others
    expect(screen.getByRole('region', { name: 'Not counted yet' })).toHaveTextContent('La Puerta Falsa')
  })

  it('Who paid: the answer first, then the payment that settles it', async () => {
    data.addRepayment.mockResolvedValue(undefined)
    open('/trips/t1/who-paid')
    expect(await screen.findByText('You are owed')).toBeInTheDocument()
    expect(screen.getByText('500 €', { selector: '.card--hero b' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Paid so far' })).toHaveTextContent('paid by you on 1 Sept')
    click('Paid back: Bea pays you')
    expect(screen.getByText(/Record 500 € paid back today\?/)).toBeInTheDocument()
    click('Yes, record it')
    await waitFor(() => expect(data.addRepayment).toHaveBeenCalledWith(expect.objectContaining({ from: 'b', to: 'a', amount: 500 })))
  })

  it('Who paid: record any repayment', async () => {
    data.addRepayment.mockResolvedValue(undefined)
    open('/trips/t1/who-paid')
    click(await screen.findByText('Record a repayment').then(() => 'Record a repayment'))
    type('How much', '200')
    click('Record it')
    await waitFor(() => expect(data.addRepayment).toHaveBeenCalledWith(expect.objectContaining({ from: 'b', to: 'a', amount: 200 })))
  })

  it('Paid: each paid their own share', async () => {
    data.setItemStatus.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Flat' }))
    fireEvent.change(screen.getByLabelText('Paid by'), { target: { value: 'each' } })
    expect(screen.getByText(/nobody owes anything for it/)).toBeInTheDocument()
    click('Save where it stands')
    await waitFor(() => expect(data.setItemStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', paidBy: null, paidEach: true })))
  })
})

describe('who it’s for (split between…)', () => {
  const three = [...travellers, { id: 'c', name: 'Cleo', user_id: null }]
  const shoot = (shares: { item_id: string; traveller_id: string; fraction: number }[]) =>
    detail({
      travellers: three,
      places: [cartagena],
      items: [{ id: 'i1', place_id: 'p1', kind: 'activity', name: 'Photoshoot', status: 'chosen', day_number: null, end_day_number: null }],
      options: [{ id: 'o1', item_id: 'i1', name: 'Fly Dress', amount: 210, rate: 1, currency: 'EUR', is_chosen: true, position: 1, details: {} }],
      amounts: [{ item_id: 'i1', current: 210, is_confirmed: false }],
      shares,
    })

  it('everyone by default; take one off for a gift', async () => {
    data.getTrip.mockResolvedValue(shoot([]))
    data.setItemSplit.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Fly Dress' }))
    expect(screen.getByText('Everyone: split equally.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bea' }))
    expect(screen.getByText('Split between 2: not Bea.')).toBeInTheDocument()
    await waitFor(() => expect(data.setItemSplit).toHaveBeenCalledWith('i1', ['a', 'c']))
  })

  it('back to everyone sends an empty list; the last one can’t be taken off', async () => {
    data.getTrip.mockResolvedValue(shoot([{ item_id: 'i1', traveller_id: 'a', fraction: 1 }]))
    data.setItemSplit.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Fly Dress' }))
    expect(screen.getByText('Just Ana.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ana' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Bea' }))
    await waitFor(() => expect(data.setItemSplit).toHaveBeenCalledWith('i1', ['a', 'b']))
    fireEvent.click(screen.getByRole('button', { name: 'Cleo' }))
    await waitFor(() => expect(data.setItemSplit).toHaveBeenLastCalledWith('i1', []))
  })

  it('solo: nothing to split', async () => {
    data.getTrip.mockResolvedValue({ ...shoot([]), travellers: [travellers[0]] })
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Fly Dress' }))
    expect(screen.queryByText('Who it’s for')).not.toBeInTheDocument()
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

describe('invitations (build 6)', () => {
  const withGabriel = () =>
    detail({
      travellers: [
        { id: 'a', name: 'Ana', user_id: 'u-ana' },
        { id: 'd', name: 'Danielle', user_id: 'u-dan' },
        { id: 'p', name: 'Peggy', user_id: null },
        { id: 'g', name: 'Gabriel', user_id: null },
      ],
    })

  it('each traveller says where they stand', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.getTrip.mockResolvedValue(withGabriel())
    data.listOpenInvitations.mockResolvedValue([{ traveller_id: 'p', created_at: new Date().toISOString() }])
    open('/trips/t1/settings')
    expect(await screen.findByText('You · created the trip')).toBeInTheDocument()
    expect(screen.getByText('On the trip')).toBeInTheDocument()
    expect(await screen.findByText('sent today, not opened yet')).toBeInTheDocument()
    expect(screen.getByText('Not invited yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send the link again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Danielle' })).toBeInTheDocument() // the creator can
  })

  it('“Invite” gives the link tied to that name', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.getTrip.mockResolvedValue(withGabriel())
    data.inviteTraveller.mockResolvedValue({ token: 'k7q2', expiresAt: '2026-11-28' })
    open('/trips/t1/settings')
    const invites = await screen.findAllByRole('button', { name: 'Invite' })
    fireEvent.click(invites[1]) // Peggy, then Gabriel
    expect(await screen.findByLabelText('Link for Gabriel')).toHaveValue('https://voyagefare.test/join/k7q2')
    expect(data.inviteTraveller).toHaveBeenCalledWith('g')
    expect(screen.getByRole('button', { name: 'Share…' })).toBeInTheDocument()
  })

  it('cancel an invite', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.getTrip.mockResolvedValue(withGabriel())
    data.listOpenInvitations.mockResolvedValue([{ traveller_id: 'p', created_at: new Date().toISOString() }])
    data.cancelInvitation.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel the invite' }))
    await waitFor(() => expect(data.cancelInvitation).toHaveBeenCalledWith('p'))
  })

  it('someone on the trip with an account: only the creator removes them', async () => {
    data.isTripOwner.mockResolvedValue(false)
    data.getTrip.mockResolvedValue(withGabriel())
    open('/trips/t1/settings')
    await screen.findByText('On the trip')
    expect(screen.queryByRole('button', { name: 'Remove Danielle' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Gabriel' })).toBeInTheDocument()
  })

  it('the link: whose trip, who you are, then join', async () => {
    data.getInvitationPreview.mockResolvedValue({
      trip_id: 't1',
      trip_name: 'Colombia',
      start_date: null,
      end_date: null,
      places: ['Bogotá', 'Medellín'],
      traveller_name: 'Gabriel',
      invited_by_name: 'Djamina',
      state: 'open',
    })
    data.acceptInvitation.mockResolvedValue('t1')
    open('/join/k7q2')
    expect(await screen.findByText('Djamina invited you to')).toBeInTheDocument()
    expect(screen.getByText('Gabriel')).toBeInTheDocument()
    click('Join as Gabriel')
    await waitFor(() => expect(data.acceptInvitation).toHaveBeenCalledWith('k7q2'))
    expect(await screen.findByRole('link', { name: 'Trip settings: Ana, Bea' })).toBeInTheDocument()
  })

  it('a link that doesn’t work any more says to ask for a new one', async () => {
    data.getInvitationPreview.mockResolvedValue({
      trip_id: 't1', trip_name: 'Colombia', start_date: null, end_date: null, places: [],
      traveller_name: 'Gabriel', invited_by_name: 'Djamina', state: 'expired',
    })
    open('/join/old')
    expect(await screen.findByText('This invitation doesn’t work any more')).toBeInTheDocument()
    expect(screen.getByText(/Ask Djamina for a new one/)).toBeInTheDocument()
  })

  it('a welcome note from whoever invited you, shown once', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        trip: { ...trip, created_by: 'u-dj' },
        travellers: [
          { id: 'dj', name: 'Djamina', user_id: 'u-dj' },
          { id: 'a', name: 'Ana', user_id: 'u-ana' },
        ],
      }),
    )
    data.getMyWelcome.mockResolvedValue({ invitedBy: 'u-dj' })
    const first = open('/trips/t1')
    expect(await screen.findByText(/Welcome aboard, Ana!/)).toBeInTheDocument()
    expect(screen.getByText('— Djamina')).toBeInTheDocument()
    click('got it ✓')
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument()
    first.unmount()
    open('/trips/t1')
    await screen.findByRole('link', { name: /Trip settings/ })
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument()
  })
})
