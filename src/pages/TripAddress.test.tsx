import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

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
const found = {
  is_booking: true,
  kind: 'stay',
  name: 'Hotel Casona del Porvenir',
  provider: 'Booking.com',
  city: 'Cartagena',
  from: null,
  to: null,
  start_date: null,
  end_date: null,
  price: 1140,
  currency: 'EUR',
  confirmation: 'CP-48213',
  link: null,
}
const mail = {
  id: 'm1',
  trip_id: 't1',
  resend_id: 'em_1',
  forwarded_by: 'u-bea',
  forwarder: 'Bea',
  subject: 'Your booking is confirmed',
  found,
  problem: null,
  status: 'new',
  received_at: '2026-11-16T09:00:00Z',
}
const withMail = (mails: unknown[]) =>
  detail({
    places: [cartagena],
    items: [hotel],
    options: [
      { id: 'o1', item_id: 'h1', name: 'Hotel Casona del Porvenir', amount: 1200, currency: 'EUR', is_chosen: true },
    ],
    mails,
  })

describe('the trip’s email address (build 8 step 5b)', () => {
  it('in Trip settings: the address, Copy, who it reads; a new one on demand', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    data.isTripOwner.mockResolvedValue(true)
    open('/trips/t1/settings')
    expect(await screen.findByText('colombia-k7q2@voyagefare.app')).toBeInTheDocument()
    const box = screen.getByRole('region', { name: 'The trip’s email address' })
    expect(within(box).getByText(/the ones they sign in with/)).toHaveTextContent('Ana')
    fireEvent.click(within(box).getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('colombia-k7q2@voyagefare.app'))

    data.tripMailAddress.mockResolvedValue('colombia-x9z4@voyagefare.app')
    fireEvent.click(within(box).getByRole('button', { name: 'Get a new address' }))
    expect(within(box).getByText(/The old address stops working/)).toBeInTheDocument()
    fireEvent.click(within(box).getAllByRole('button', { name: 'Get a new address' }).at(-1)!)
    expect(await screen.findByText('colombia-x9z4@voyagefare.app')).toBeInTheDocument()
    expect(data.tripMailAddress).toHaveBeenLastCalledWith('t1', true)
  })

  it('“Bring things in”, at the end of the trip: the address, to copy (build 8½)', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    data.tripMailAddress.mockResolvedValue('colombia-k7q2@voyagefare.app')
    open('/trips/t1')
    const card = (await screen.findByRole('heading', { name: 'Bring things in' })).parentElement!
    expect(await within(card).findByText(/colombia-k7q2@voyagefare\.app/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /Paste a booking email/ })).toHaveAttribute(
      'href',
      '/trips/t1/booking-email',
    )
  })

  it('To review: what was forwarded; Check marks it booked and done', async () => {
    data.getTrip.mockResolvedValue(withMail([mail]))
    data.applyBooking.mockResolvedValue('h1')
    data.markTripMail.mockResolvedValue(undefined)
    open('/trips/t1')
    const review = await screen.findByRole('region', { name: 'To review' })
    expect(within(review).getByText('Hotel Casona del Porvenir')).toBeInTheDocument()
    expect(within(review).getByText(/forwarded by Bea/)).toHaveTextContent('Booked · 1 140 € · #CP-48213')
    expect(within(review).getByRole('link', { name: 'Check' })).toHaveAttribute(
      'href',
      '/trips/t1/booking-email?mail=m1',
    )

    open('/trips/t1/booking-email?mail=m1')
    expect(await screen.findByText('It goes on this line')).toBeInTheDocument()
    expect(data.readBooking).not.toHaveBeenCalled()
    click('Mark it booked')
    await waitFor(() => expect(data.markTripMail).toHaveBeenCalledWith('m1', 'done'))
    expect(data.applyBooking).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'h1', ref: 'CP-48213' }))
  })

  it('Not for this trip: dropped; one that couldn’t be read can be removed', async () => {
    data.getTrip.mockResolvedValue(
      withMail([
        mail,
        { ...mail, id: 'm2', resend_id: 'em_2', found: null, problem: 'unreadable', subject: 'Fwd: hello' },
      ]),
    )
    data.markTripMail.mockResolvedValue(undefined)
    open('/trips/t1')
    const review = await screen.findByRole('region', { name: 'To review' })
    expect(within(review).getByText(/couldn’t be read/)).toBeInTheDocument()
    fireEvent.click(within(review).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(data.markTripMail).toHaveBeenCalledWith('m2', 'dropped'))
    fireEvent.click(within(review).getByRole('button', { name: 'Not for this trip' }))
    await waitFor(() => expect(data.markTripMail).toHaveBeenCalledWith('m1', 'dropped'))
  })
})
