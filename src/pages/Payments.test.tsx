import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('what’s left to pay (build 6)', () => {
  const iso = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const tour = { id: 'tour', trip_id: 't1', place_id: 'p1', kind: 'activity', category: 'activities', name: 'Graffiti tour', status: 'booked', package_id: null, paid_by: null, paid_each: false, actual_amount: 200, actual_currency: 'EUR', position: 1, day_number: null, end_day_number: null, note: null, due_on: iso(5) }
  const withDeposit = (payments: unknown[] = [{ id: 'pay1', trip_id: 't1', item_id: 'tour', kind: 'deposit', amount: 80, currency: 'EUR', rate: 1, paid_by: 'a', paid_each: false, paid_on: '2026-08-30' }], left = 120) =>
    detail({
      places: [cartagena],
      items: [tour],
      options: [{ id: 'ot', item_id: 'tour', name: 'Graffiti tour', amount: 200, rate: 1, currency: 'EUR', is_chosen: true, position: 1, details: {} }],
      amounts: [{ item_id: 'tour', current: 200, actual: 200, is_confirmed: true, status: 'booked' }],
      shares: [
        { item_id: 'tour', traveller_id: 'a', fraction: 0.5 },
        { item_id: 'tour', traveller_id: 'b', fraction: 0.5 },
      ],
      payments,
      itemLeft: [{ item_id: 'tour', trip_id: 't1', place_id: 'p1', due_on: iso(5), price: 200, paid: 200 - left, left_to_pay: left }],
    })

  it('a booked line paid in part: what’s left (your share) and a reminder before the date', async () => {
    data.getTrip.mockResolvedValue(withDeposit())
    open('/trips/t1')
    expect(await screen.findByText('deposit paid · 60 € left')).toBeInTheDocument()
    expect(screen.getByText('balance due in 5 days')).toBeInTheDocument()
  })

  it('open it: the payments, what’s left, and add the balance', async () => {
    data.getTrip.mockResolvedValue(withDeposit())
    data.addPayment.mockResolvedValue('pay2')
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change Graffiti tour' }))
    expect(screen.getByRole('region', { name: 'Payments' })).toHaveTextContent('Deposit')
    expect(screen.queryByRole('form', { name: /Where Graffiti tour stands/ })).not.toBeInTheDocument()
    click('Add a payment')
    type('Amount', '120')
    expect(screen.getByText(/will be/)).toHaveTextContent('Graffiti tour will be paid in full')
    click('Add')
    await waitFor(() =>
      expect(data.addPayment).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'tour', kind: 'balance', amount: 120, paidBy: 'a', each: false })),
    )
  })

  it('Budget: “What’s left to pay”, soonest first; a late one says so', async () => {
    const late = { ...tour, id: 'boat', name: 'Boat', due_on: iso(-3) }
    const base = withDeposit()
    data.getTrip.mockResolvedValue({
      ...base,
      items: [tour, late],
      shares: [...base.shares, { item_id: 'boat', traveller_id: 'a', fraction: 1 }],
      itemLeft: [...base.itemLeft, { item_id: 'boat', trip_id: 't1', place_id: 'p1', due_on: iso(-3), price: 90, paid: 0, left_to_pay: 90 }],
    })
    data.getMoney.mockResolvedValue({ categories: [], travellerCategories: [], balances: [], settlement: [], repayments: [] })
    open('/trips/t1/budget')
    const card = await screen.findByRole('region', { name: 'What’s left to pay' })
    expect(card).toHaveTextContent('150 €') // 90 (boat, yours) + 60 (your half of the tour)
    expect(card).toHaveTextContent('1 late')
    const names = [...card.querySelectorAll('.line__name')].map((n) => n.textContent)
    expect(names).toEqual(['Boat', 'Graffiti tour'])
    expect(card).toHaveTextContent('late: pay it or change the date')
  })
})
