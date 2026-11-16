import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

const stay = (over: Record<string, unknown> = {}, files: unknown[] = []) =>
  detail({
    places: [cartagena],
    items: [
      {
        id: 'i1',
        place_id: 'p1',
        kind: 'housing',
        name: 'Casa Lola',
        status: 'booked',
        day_number: null,
        end_day_number: null,
        actual_amount: 1140,
        paid_by: null,
        paid_on: null,
        booking_ref: null,
        booking_link: null,
        ...over,
      },
    ],
    options: [
      { id: 'o1', item_id: 'i1', name: 'Casa Lola', amount: 1140, rate: 1, is_chosen: true, position: 1, details: {} },
    ],
    amounts: [{ item_id: 'i1', current: 1140, is_confirmed: true }],
    files,
  })

const pdf = {
  id: 'f1',
  item_id: 'i1',
  trip_id: 't1',
  path: 't1/i1/a-c.pdf',
  name: 'Confirmation.pdf',
  size: 212000,
  mime: 'application/pdf',
  added_by: 'u-ana',
}

describe('booking details (build 8 step 4)', () => {
  it('marking it booked: a confirmation number and a link, both optional', async () => {
    data.getTrip.mockResolvedValue(stay({ status: 'chosen', actual_amount: null }))
    data.setItemStatus.mockResolvedValue(undefined)
    data.saveBooking.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    expect(screen.queryByLabelText(/Confirmation number/)).toBeNull()
    click('Mark it booked')
    // Both optional: folded behind "+" until asked for.
    expect(screen.queryByLabelText(/Confirmation number/)).not.toBeInTheDocument()
    click(/Confirmation number/)
    click(/Booking link/)
    type(/Confirmation number/, 'CP-48213')
    type(/Booking link/, 'booking.com/x')
    click('Booked')
    expect(await screen.findByText('Paste the whole booking link, starting with https://')).toBeInTheDocument()
    type(/Booking link/, 'https://booking.com/x')
    click('Booked')
    await waitFor(() => expect(data.saveBooking).toHaveBeenCalledWith('i1', 'CP-48213', 'https://booking.com/x'))
    expect(data.setItemStatus).toHaveBeenCalled()
  })

  it('on the trip page: the number and the files under the line', async () => {
    data.getTrip.mockResolvedValue(stay({ booking_ref: 'CP-48213' }, [pdf]))
    open('/trips/t1')
    expect(await screen.findByText('🎫 #CP-48213')).toBeInTheDocument()
    expect(screen.getByText('📎 1 file')).toBeInTheDocument()
  })

  it('on the line: copy the number, open the link, add a file, remove one after asking', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    data.getTrip.mockResolvedValue(stay({ booking_ref: 'CP-48213', booking_link: 'https://booking.test/x' }, [pdf]))
    data.addFile.mockResolvedValue(undefined)
    data.removeFile.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Casa Lola' }))
    // Booked: a "Booking" row appears in the summary.
    click(/^Booking/)
    const booking = screen.getByRole('region', { name: 'Booking' })
    fireEvent.click(within(booking).getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('CP-48213'))
    expect(within(booking).getByRole('link', { name: 'Open ↗' })).toHaveAttribute('href', 'https://booking.test/x')
    expect(within(booking).getByText('207 KB · added by you')).toBeInTheDocument()

    const input = booking.querySelector('input[type=file]') as HTMLInputElement
    const exe = new File(['x'], 'x.exe', { type: 'application/x-msdownload' })
    fireEvent.change(input, { target: { files: [exe] } })
    expect(await within(booking).findByText(/Add a PDF or a photo/)).toBeInTheDocument()
    const ticket = new File(['%PDF'], 'Ticket.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [ticket] } })
    await waitFor(() => expect(data.addFile).toHaveBeenCalledWith('t1', 'i1', ticket))

    fireEvent.click(within(booking).getByRole('button', { name: 'Remove Confirmation.pdf' }))
    expect(data.removeFile).not.toHaveBeenCalled()
    fireEvent.click(within(booking).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(data.removeFile).toHaveBeenCalledWith(pdf))
  })
})
