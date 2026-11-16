import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

// Forms by kind (build 8¾, mockup kinds-v6, 16 Nov): each kind asks its own questions.
const pick = (name: RegExp | string) => fireEvent.click(screen.getByRole('radio', { name }))

async function openAdd() {
  data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
  data.addItem.mockResolvedValue('new')
  data.addToTry.mockResolvedValue('new')
  open('/trips/t1')
  await screen.findByRole('button', { name: 'Add to Cartagena' })
  click('Add to Cartagena')
}

describe('questions by kind', () => {
  it('an activity: a time, a price per person that the app multiplies, booking, how long', async () => {
    await openAdd()
    pick(/Activities/)
    type('Name', 'Fushimi Inari')
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Time/), { target: { value: '07:00' } })
    expect(screen.getByRole('radio', { name: 'Per person' })).toHaveAttribute('aria-checked', 'true')
    type('Price', '25')
    expect(screen.getByText('× 2 travellers = 50 €')).toBeInTheDocument()
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Booking needed?' })).getByRole('radio', { name: 'Yes' }),
    )
    type(/How long/, '2 h')
    click('Add')
    await waitFor(() =>
      expect(data.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'activity', name: 'Fushimi Inari', dayNumber: 2, amount: 50 }),
      ),
    )
    expect(data.setItemDetails).toHaveBeenCalledWith(
      'new',
      expect.objectContaining({ start_time: '07:00', price_per_person: true, needs_booking: true, duration: '2 h' }),
    )
  })

  it('an activity with no day waits in To try', async () => {
    await openAdd()
    pick(/Activities/)
    type('Name', 'Tea ceremony')
    expect(screen.getByText('no day yet: it waits in To try')).toBeInTheDocument()
    pick('For everyone')
    type('Price', '100')
    click('Add')
    await waitFor(() =>
      expect(data.addToTry).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tea ceremony', kind: 'activity', amount: 100 }),
      ),
    )
    expect(data.addItem).not.toHaveBeenCalled()
  })

  it('a restaurant: a day and a meal, an estimate per person, a reservation, the kind of food', async () => {
    await openAdd()
    pick(/Food/)
    type('Name', 'Kikunoi')
    pick('Day 3')
    pick('Dinner')
    type('About how much, per person', '90')
    expect(screen.getByText('× 2 travellers = 180 €')).toBeInTheDocument()
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Reservation needed?' })).getByRole('radio', { name: 'Yes' }),
    )
    type(/The kind of food/, 'kaiseki')
    click('Add')
    await waitFor(() =>
      expect(data.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'restaurant', dayNumber: 3, amount: 180 }),
      ),
    )
    expect(data.setItemDetails).toHaveBeenCalledWith(
      'new',
      expect.objectContaining({ meal: 'dinner', food_kind: 'kaiseki', needs_booking: true, price_per_person: true }),
    )
  })

  it('a restaurant with no day yet goes to To try', async () => {
    await openAdd()
    pick(/Food/)
    type('Name', 'Nishiki market')
    expect(screen.getByRole('radio', { name: 'No day yet: To try' })).toHaveAttribute('aria-checked', 'true')
    click('Add')
    await waitFor(() =>
      expect(data.addToTry).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nishiki market', kind: 'restaurant' }),
      ),
    )
  })

  it('a car rental: pick-up and drop-off, a price a day, insurance, a deposit kept out of the budget', async () => {
    await openAdd()
    pick(/Car rental/)
    fireEvent.change(screen.getByLabelText('Pick up'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Drop off'), { target: { value: '4' } })
    type(/Pick-up place/, 'Airport')
    type('Price for the rental', '210')
    expect(screen.getByText('4 days · ≈ 53 € a day')).toBeInTheDocument()
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Insurance included?' })).getByRole('radio', { name: 'No' }),
    )
    type(/Deposit/, '300')
    expect(screen.getByText('Not in the budget: it comes back.')).toBeInTheDocument()
    click('Add')
    await waitFor(() =>
      expect(data.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'car_rental', name: 'Car rental', dayNumber: 1, endDayNumber: 4, amount: 210 }),
      ),
    )
    expect(data.setItemDetails).toHaveBeenCalledWith(
      'new',
      expect.objectContaining({ from_place: 'Airport', insurance_included: false, deposit: 300 }),
    )
  })

  it('getting around: from → to and how, the name made from them', async () => {
    await openAdd()
    pick(/Getting around/)
    type('From', 'Naha')
    type('To', 'Zamami')
    pick('Ferry')
    type('Price', '18')
    click('Add')
    await waitFor(() =>
      expect(data.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'transport', name: 'Ferry Naha → Zamami', amount: 36 }),
      ),
    )
    expect(data.setItemDetails).toHaveBeenCalledWith(
      'new',
      expect.objectContaining({ from_place: 'Naha', to_place: 'Zamami', local_mode: 'ferry', price_per_person: true }),
    )
  })
})

describe('the place card', () => {
  it('a place with nights and nowhere to sleep shows a dashed “Where we sleep”', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: /Where we sleep/ }))
    expect(screen.getByRole('radio', { name: /Stay/ })).toHaveAttribute('aria-checked', 'true')
  })

  const meal = (id: string, m: string) => ({
    id,
    place_id: 'p1',
    kind: 'restaurant',
    name: id,
    status: 'idea',
    day_number: 2,
    end_day_number: null,
    meal: m,
  })

  it('each day has + What we do · + Where we eat, even an empty one', async () => {
    data.getTrip.mockResolvedValue(
      detail({ places: [cartagena], items: [meal('Café', 'breakfast'), meal('Taberna', 'lunch')] }),
    )
    open('/trips/t1')
    expect(await screen.findByRole('button', { name: 'Where we eat on day 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'What we do on day 4' })).toBeInTheDocument()
  })

  it('“Where we eat” goes once breakfast, lunch and dinner are set that day', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        places: [cartagena],
        items: [meal('Café', 'breakfast'), meal('Taberna', 'lunch'), meal('El Chato', 'dinner')],
      }),
    )
    open('/trips/t1')
    expect(await screen.findByRole('button', { name: 'What we do on day 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Where we eat on day 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Where we eat on day 3' })).toBeInTheDocument()
  })

  it('+ Where we eat opens a restaurant on that day', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Where we eat on day 3' }))
    expect(screen.getByRole('radio', { name: /Food/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Day 3' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('where it is (maps-v6)', () => {
  it('a Google Maps link pins the spot, and saves with the line', async () => {
    await openAdd()
    pick(/Activities/)
    type('Name', 'Kikunoi')
    fireEvent.change(screen.getByLabelText('Where (optional)'), {
      target: { value: 'https://www.google.com/maps/place/Kikunoi/@35.0010,135.7810,17z' },
    })
    expect(screen.getByLabelText('Where (optional)')).toHaveValue('Kikunoi')
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2' } })
    click('Add')
    await waitFor(() =>
      expect(data.setItemDetails).toHaveBeenCalledWith(
        'new',
        expect.objectContaining({ location_name: 'Kikunoi', latitude: 35.001, longitude: 135.781 }),
      ),
    )
  })

  it('a day with places opens its map; its lines get their numbers', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        places: [cartagena],
        items: [
          {
            id: 'a1',
            place_id: 'p1',
            kind: 'activity',
            name: 'Walled city',
            status: 'idea',
            day_number: 2,
            end_day_number: null,
            latitude: 10.42,
            longitude: -75.55,
          },
          {
            id: 'a2',
            place_id: 'p1',
            kind: 'activity',
            name: 'Mud volcano',
            status: 'idea',
            day_number: 2,
            end_day_number: null,
          },
        ],
      }),
    )
    open('/trips/t1')
    const toggle = await screen.findByRole('button', { name: /Map of Day 2/ })
    expect(toggle).toHaveTextContent('⌖ Map · 1')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('img', { name: /Map of Day 2/ })).toBeInTheDocument()
    expect(screen.getByLabelText('stop 1 on the map')).toBeInTheDocument()
    expect(screen.getByLabelText('no place yet')).toBeInTheDocument()
  })
})

describe('a short Google Maps link (the Share button)', () => {
  it('the server follows it to the spot, then it’s pinned', async () => {
    data.previewLink.mockResolvedValue({
      name: 'Nock Reserved Residences',
      image: null,
      site: 'google.com',
      price: null,
      currency: null,
      place: 'Medellín',
      latitude: 6.2089,
      longitude: -75.5701,
      url: 'https://www.google.com/maps/place/x',
    })
    await openAdd()
    pick(/Activities/)
    type('Name', 'Our flat')
    fireEvent.change(screen.getByLabelText('Where (optional)'), { target: { value: 'https://maps.app.goo.gl/AbC123' } })
    await waitFor(() => expect(screen.getByLabelText('Where (optional)')).toHaveValue('Nock Reserved Residences'))
    expect(data.previewLink).toHaveBeenCalledWith('https://maps.app.goo.gl/AbC123')
  })
})
