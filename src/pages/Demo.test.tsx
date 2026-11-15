import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, data, detail, open, trip } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

// Mockup demo-v5 (15 Nov): a real trip, names changed, read-only, open without signing up.
const travellers = [
  { id: 'a', name: 'Ana', user_id: null, position: 1 },
  { id: 'b', name: 'Bea', user_id: null, position: 2 },
]
const dinner = {
  id: 'd1',
  place_id: 'p1',
  kind: 'restaurant',
  category: 'food',
  name: 'Birthday dinner',
  status: 'paid',
  day_number: 2,
  end_day_number: null,
  position: 1,
  package_id: null,
  paid_by: null,
  paid_each: false,
  paid_on: null,
  link: null,
  meal: 'dinner',
  verdict: null,
}
const demoTrip = () =>
  detail({
    trip: { ...trip, id: 'demo', name: 'Colombia & Panama', is_demo: true, created_by: null },
    travellers,
    places: [cartagena],
    items: [dinner],
    options: [{ id: 'o1', item_id: 'd1', name: 'Morena', amount: 108, rate: 1, currency: 'EUR', is_chosen: true }],
    amounts: [{ item_id: 'd1', current: 108, is_confirmed: true }],
    shares: [
      { item_id: 'd1', traveller_id: 'a', fraction: 0.5 },
      { item_id: 'd1', traveller_id: 'b', fraction: 0.5 },
    ],
    travellerShares: [
      { traveller_id: 'a', share_current: 3487, share_confirmed: 3462, share_estimated: 25 },
      { traveller_id: 'b', share_current: 3108, share_confirmed: 3083, share_estimated: 25 },
    ],
    payments: [
      {
        id: 'y1',
        item_id: 'd1',
        kind: 'deposit',
        amount: 33.28,
        rate: 1,
        currency: 'EUR',
        paid_by: 'a',
        paid_each: false,
        paid_on: '2026-08-29',
      },
      {
        id: 'y2',
        item_id: 'd1',
        kind: 'balance',
        amount: 74.5,
        rate: 1,
        currency: 'EUR',
        paid_by: 'b',
        paid_each: false,
        paid_on: '2026-09-14',
      },
    ],
  })
const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ')

describe('the demo', () => {
  it('opens without signing in: the note, “See it as”, Ana’s share, nothing to change', async () => {
    data.getDemoTripId.mockResolvedValue('demo')
    data.getTrip.mockResolvedValue(demoTrip())
    open('/demo')
    expect(await screen.findByText(/A real trip, the names changed/)).toBeInTheDocument()
    expect(data.getTrip).toHaveBeenCalledWith('demo')
    expect(screen.getByRole('link', { name: 'Make my own ›' })).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('radio', { name: 'Ana’s share' })).toBeInTheDocument()
    expect(plain(screen.getByText(/3 487/).textContent)).toContain('3 487 €')
    expect(screen.queryByRole('button', { name: /Add to Cartagena/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Change Cartagena/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Trip settings/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Welcome page' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute('href', '/demo/compare')
    expect(screen.getByRole('heading', { name: 'Your turn?' })).toBeInTheDocument()
  })

  it('“See it as Bea”: every amount becomes Bea’s share', async () => {
    data.getDemoTripId.mockResolvedValue('demo')
    data.getTrip.mockResolvedValue(demoTrip())
    open('/demo')
    const see = await screen.findByRole('radiogroup', { name: 'See it as' })
    fireEvent.click(within(see).getByRole('radio', { name: 'Bea' }))
    expect(screen.getByRole('radio', { name: 'Bea’s share' })).toBeInTheDocument()
    expect(plain(screen.getByText(/3 108/).textContent)).toContain('3 108 €')
  })

  it('tapping a line shows its details: the whole price, who it’s for, the deposit and the balance', async () => {
    data.getDemoTripId.mockResolvedValue('demo')
    data.getTrip.mockResolvedValue(demoTrip())
    open('/demo')
    fireEvent.click(await screen.findByRole('button', { name: /^Details of / }))
    const text = plain(document.querySelector('.item-peek')?.textContent ?? '')
    expect(text).toContain('108 € for 2')
    expect(text).toContain('everyone, 54 € each')
    expect(text).toContain('Deposit 33 € by Ana, 29 Aug · Balance 75 € by Bea, 14 Sept')
    expect(text).toContain('this is where you’d change it')
  })

  it('no demo open: says so', async () => {
    data.getDemoTripId.mockResolvedValue(null)
    open('/demo')
    expect(await screen.findByText('The demo isn’t open right now.')).toBeInTheDocument()
  })

  it('Who paid: who owes whom, but no recording', async () => {
    data.getDemoTripId.mockResolvedValue('demo')
    data.getTrip.mockResolvedValue(demoTrip())
    data.getMoney.mockResolvedValue({
      categories: [],
      travellerCategories: [],
      balances: [
        { traveller_id: 'a', paid: 1000, share_of_paid: 500, repaid: 0, received: 0, balance: 500 },
        { traveller_id: 'b', paid: 0, share_of_paid: 500, repaid: 0, received: 0, balance: -500 },
      ],
      settlement: [{ from_traveller: 'b', to_traveller: 'a', amount: 500 }],
      repayments: [],
    })
    open('/demo/who-paid')
    await waitFor(() => expect(screen.getAllByText(/Bea pays you/).length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: /Paid back/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Record a repayment')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your turn?' })).toBeInTheDocument()
  })
})
