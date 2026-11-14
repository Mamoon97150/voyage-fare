import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

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
