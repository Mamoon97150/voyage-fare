import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, travellers, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

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
    expect(screen.getByRole('radio', { name: /Travel/ })).toHaveAttribute('aria-checked', 'true')
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
