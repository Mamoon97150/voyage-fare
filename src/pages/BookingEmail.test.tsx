import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/rates', async (original) => ({
  ...(await original<typeof import('../lib/rates')>()),
  fetchRate: vi.fn(async (from: string) => (from === 'COP' ? 0.00024 : 1)),
}))

const hotel = {
  id: 'h1',
  place_id: 'p1',
  name: 'Casona del Porvenir',
  kind: 'housing',
  status: 'chosen',
  actual_amount: null,
  actual_currency: null,
  package_id: null,
}
const withHotel = () =>
  detail({
    places: [cartagena],
    items: [hotel, { ...hotel, id: 't2', name: 'Tuk-tuk tour', kind: 'activity' }],
    options: [
      { id: 'o1', item_id: 'h1', name: 'Hotel Casona del Porvenir', amount: 1200, currency: 'EUR', is_chosen: true },
    ],
  })

const email = {
  is_booking: true,
  kind: 'stay',
  name: 'Hotel Casona del Porvenir',
  provider: 'Booking.com',
  city: 'Cartagena',
  from: null,
  to: null,
  start_date: '2026-09-12',
  end_date: '2026-09-17',
  price: 1140,
  currency: 'EUR',
  confirmation: 'CP-48213',
  link: 'https://booking.test/cp',
}

describe('paste a booking email (build 8 step 5a)', () => {
  it('from the trip menu: paste, read, it finds the line, mark it booked', async () => {
    data.getTrip.mockResolvedValue(withHotel())
    data.readBooking.mockResolvedValue(email)
    data.applyBooking.mockResolvedValue('h1')
    open('/trips/t1')
    expect(await screen.findByRole('link', { name: /Paste a booking email/ })).toHaveAttribute(
      'href',
      '/trips/t1/booking-email',
    )

    open('/trips/t1/booking-email')
    await screen.findByLabelText('The confirmation email')
    expect(screen.getByText(/Sent to/)).toHaveTextContent('Claude (Anthropic)')
    type('The confirmation email', 'Your booking at Hotel Casona del Porvenir is confirmed…')
    click('Read it')
    expect(await screen.findByText('It goes on this line')).toBeInTheDocument()
    expect(screen.getByText('CP-48213')).toBeInTheDocument()
    expect(screen.getByText(/The price was 1 200 €/)).toBeInTheDocument()
    click('Mark it booked')
    await waitFor(() => expect(data.applyBooking).toHaveBeenCalled())
    expect(data.applyBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1',
        itemId: 'h1',
        amount: 1140,
        currency: 'EUR',
        rate: 1,
        ref: 'CP-48213',
        link: 'https://booking.test/cp',
      }),
    )
    expect(await screen.findByText(/From the email: Casona del Porvenir is booked/)).toBeInTheDocument()
  })

  it('nothing matches: a new line, booked, in its place and currency', async () => {
    data.getTrip.mockResolvedValue(withHotel())
    data.readBooking.mockResolvedValue({
      ...email,
      kind: 'activity',
      name: 'Rosario Islands day trip',
      provider: 'Resmont Travel',
      price: 240000,
      currency: 'COP',
      confirmation: 'RT-9',
      link: null,
    })
    data.applyBooking.mockResolvedValue('new')
    open('/trips/t1/booking-email')
    await screen.findByLabelText('The confirmation email')
    type('The confirmation email', 'Resmont Travel: your Rosario Islands day trip…')
    click('Read it')
    expect(await screen.findByText('Not in the trip yet')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Add it, booked' }))
    await waitFor(() => expect(data.applyBooking).toHaveBeenCalled())
    expect(data.applyBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: null,
        kind: 'activity',
        name: 'Rosario Islands day trip',
        placeId: 'p1',
        amount: 240000,
        currency: 'COP',
        rate: 0.00024,
      }),
    )
  })

  it('“Not this one”: pick another line', async () => {
    data.getTrip.mockResolvedValue(withHotel())
    data.readBooking.mockResolvedValue(email)
    data.applyBooking.mockResolvedValue('t2')
    open('/trips/t1/booking-email')
    await screen.findByLabelText('The confirmation email')
    type('The confirmation email', 'Confirmed!')
    click('Read it')
    fireEvent.click(await screen.findByRole('button', { name: 'Not this one' }))
    fireEvent.change(screen.getByLabelText('Which line?'), { target: { value: 't2' } })
    click('Mark it booked')
    await waitFor(() => expect(data.applyBooking).toHaveBeenCalledWith(expect.objectContaining({ itemId: 't2' })))
  })

  it('not a booking: says so, nothing saved', async () => {
    data.readBooking.mockResolvedValue({ ...email, is_booking: false })
    open('/trips/t1/booking-email')
    await screen.findByLabelText('The confirmation email')
    type('The confirmation email', 'Our summer sale is on!')
    click('Read it')
    expect(await screen.findByText(/doesn’t look like a booking confirmation/)).toBeInTheDocument()
    expect(data.applyBooking).not.toHaveBeenCalled()
  })
})
