import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { card } from '../test/cards'
import { todayIso } from '../lib/shelf'
import { addDays } from '../lib/tripText'
import { click, data, open, type } from '../test/app'
import { session } from '../test/fakes'

const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ')

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('your trips', () => {
  it('empty: the notebook, and a way to start', async () => {
    data.listTrips.mockResolvedValue([])
    open('/trips')
    expect(await screen.findByText('Your first trip')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ Start a trip' })).toHaveAttribute('href', '/trips/new')
    expect(screen.getByRole('link', { name: 'or look at a real trip first ›' })).toHaveAttribute('href', '/demo')
  })

  it('right after confirming the email: a welcome note, once', async () => {
    const user = session.user as Record<string, unknown>
    user.email_confirmed_at = new Date().toISOString()
    data.listTrips.mockResolvedValue([])
    const first = open('/trips')
    expect(await screen.findByText('Email confirmed, welcome Ana! Your notebook is ready.')).toBeInTheDocument()
    first.unmount()
    open('/trips')
    await screen.findByText('Your first trip')
    expect(screen.queryByText(/Email confirmed/)).not.toBeInTheDocument()
    delete user.email_confirmed_at
  })

  it('a shelf: the next trip big, then the dreams, a blank page, the past trips', async () => {
    data.listTrips.mockResolvedValue([
      card({
        id: 'li',
        name: 'Lisbon & Porto',
        start_date: addDays(todayIso(), 148),
        end_date: addDays(todayIso(), 156),
        home_city: 'St Martin',
        places: [
          { id: 'l', name: 'Lisbon', nights: 3 },
          { id: 'p', name: 'Porto', nights: 5 },
        ],
        travellers: [
          { id: 'a', name: 'Ana', me: true },
          { id: 'b', name: 'Bea', me: false },
        ],
        shareConfirmed: 770,
        shareEstimated: 470,
        nextDue: { name: 'Hotel deposit', dueOn: '2026-12-15', left: 180 },
        undecided: { name: 'Train', options: 3 },
        undecidedCount: 1,
      }),
      card({ id: 'ja', name: 'Japan', shareEstimated: 2900, places: [{ id: 't', name: 'Tokyo', nights: 5 }] }),
      card({
        id: 'co',
        name: 'Colombia & Panama',
        start_date: '2026-09-04',
        end_date: '2026-09-18',
        shareConfirmed: 3519,
        settled: false,
        settle: [{ name: 'Gabriel', amount: 69, youPay: false }],
        travellers: [
          { id: 'a', name: 'Ana', me: true },
          { id: 'g', name: 'Gabriel', me: false },
        ],
      }),
    ])
    open('/trips')
    expect(await screen.findByText('Hi Ana, 148 days to Lisbon')).toBeInTheDocument()

    const next = screen.getByRole('link', { name: 'Lisbon & Porto: open' })
    expect(next).toHaveAttribute('href', '/trips/li')
    expect(next).toHaveTextContent('In 148 days')
    expect(next).toHaveTextContent('St Martin→Lisbon→Porto→home')
    expect(plain(next.textContent)).toContain('1 240 €your share')
    expect(plain(next.textContent)).toContain('Hotel deposit, 180 € · due 15 Dec')
    expect(next).toHaveTextContent('Train: 3 options, none chosen')
    expect(next).toHaveTextContent('2 things to sort out')
    expect(within(next).getByLabelText('Ana (you), Bea')).toBeInTheDocument()

    const dreams = screen.getByRole('region', { name: 'Still a dream' })
    expect(plain(dreams.textContent)).toContain('≈ 2 900 €')
    expect(screen.getByRole('link', { name: /\+ A new trip/ })).toHaveAttribute('href', '/trips/new')
    const past = screen.getByRole('region', { name: 'Past trips' })
    expect(past).toHaveTextContent('Sept 2026')
    expect(plain(past.textContent)).toContain('it cost you3 519 €Gabriel owes you 69 €')
  })

  it('while travelling: the day, where you are, today’s plans; it opens at today’s place', async () => {
    data.listTrips.mockResolvedValue([
      card({
        id: 'co',
        name: 'Colombia & Panama',
        start_date: addDays(todayIso(), -5),
        end_date: addDays(todayIso(), 8),
        places: [
          { id: 'b', name: 'Bogotá', nights: 2 },
          { id: 'g', name: 'Guatapé', nights: 2 },
          { id: 'm', name: 'Medellín', nights: 9 },
        ],
        today: ['Comuna 13 tour', 'Dinner at Carmen'],
        settled: false,
        settle: [{ name: 'Danielle', amount: 42, youPay: true }],
      }),
    ])
    open('/trips')
    expect(await screen.findByText('Day 6, enjoy Medellín!')).toBeInTheDocument()
    const now = screen.getByRole('link', { name: 'Colombia & Panama: open' })
    expect(now).toHaveAttribute('href', '/trips/co#place-m')
    expect(now).toHaveTextContent('Day 6 of 14')
    expect(now).toHaveTextContent('Medellín ●')
    expect(now).toHaveTextContent('Today: Comuna 13 tour, Dinner at Carmen')
    expect(plain(now.textContent)).toContain('You owe Danielle 42 €')
    expect(now).toHaveTextContent('Open today ›')
    expect(screen.getByRole('region', { name: 'Travelling now' })).toBeInTheDocument()
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
    await waitFor(() =>
      expect(data.createTrip).toHaveBeenCalledWith(expect.objectContaining({ me: 'Ana', travellers: [] })),
    )
  })

  it('a target that isn’t an amount is said on the field', async () => {
    open('/trips/new')
    await screen.findByText('Where are you going?')
    type('Trip name', 'Colombia')
    click('Next')
    click('Next')
    type('Target', 'a lot')
    click('Create the trip')
    expect(screen.getByLabelText('Target')).toHaveAccessibleDescription('Enter an amount, like 2 500.')
    expect(data.createTrip).not.toHaveBeenCalled()
  })
})

describe('the app on the phone (pwa-v5)', () => {
  const tripSoon = () =>
    card({ id: 'li', name: 'Lisbon & Porto', start_date: addDays(todayIso(), 30), end_date: addDays(todayIso(), 38) })

  it('on an iPhone, once there is a trip: "Keep it on your phone" with the 2 steps; Not now hides it', async () => {
    const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')
    localStorage.clear()
    data.listTrips.mockResolvedValue([tripSoon()])
    const first = open('/trips')
    expect(await screen.findByText('Keep it on your phone')).toBeInTheDocument()
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
    click('Not now')
    expect(screen.queryByText('Keep it on your phone')).not.toBeInTheDocument()
    first.unmount()
    open('/trips')
    await screen.findAllByText('Lisbon & Porto')
    expect(screen.queryByText('Keep it on your phone')).not.toBeInTheDocument()
    ua.mockRestore()
    localStorage.clear()
  })

  it('opened with no connection: "No connection" and Try again', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    data.listTrips.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce([tripSoon()])
    open('/trips')
    expect(await screen.findByText('No connection')).toBeInTheDocument()
    expect(screen.getByText(/● Offline · read only\./)).toBeInTheDocument()
    online.mockReturnValue(true)
    click('Try again')
    expect(await screen.findAllByText('Lisbon & Porto')).not.toHaveLength(0)
    online.mockRestore()
  })
})

describe('Your trips · Someday · Me (build 8½, menus-home-v6)', () => {
  it('a bar at the bottom of Your trips', async () => {
    data.listTrips.mockResolvedValue([])
    open('/trips')
    await screen.findByText('Your first trip')
    const bar = screen.getByRole('navigation', { name: 'Main' })
    expect(within(bar).getByRole('link', { name: 'Your trips' })).toHaveAttribute('href', '/trips')
    expect(within(bar).getByRole('link', { name: 'Someday' })).toHaveAttribute('href', '/someday')
    expect(within(bar).getByRole('link', { name: 'Me' })).toHaveAttribute('href', '/me')
  })

  it('Me, a full page: your account, the app, sign out; no admin for most people', async () => {
    open('/me')
    expect(await screen.findByRole('heading', { name: 'Me' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Name, email, password/ })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: 'See the demo' })).toHaveAttribute('href', '/demo')
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    // Feedback opens a sheet in the app (feedback-admin-v5), no email app.
    expect(screen.getByRole('button', { name: /Send feedback/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Delete my account' })).toHaveAttribute('href', '/account#delete')
    expect(screen.queryByRole('heading', { name: /Admin/ })).toBeNull()
    // Not on a phone that can install it: no "Put it on my phone".
    expect(screen.queryByRole('button', { name: 'Put it on my phone' })).toBeNull()
  })
})
