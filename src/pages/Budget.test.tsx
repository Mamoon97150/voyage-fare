import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, travellers, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

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
