import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open } from '../test/app'
import { card } from '../test/cards'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

// Build 8½ (mockup menus-home-v6): Someday, Needs you, the ways to start.
const idea = (id: string, place: string | null, kind = 'restaurant', link: string | null = null) => ({
  id,
  place_name: place,
  place_country: null,
  place_latitude: null,
  place_longitude: null,
  kind,
  name: id,
  link,
  note: null,
  created_at: id,
})

describe('Someday', () => {
  it('ideas by place, where they came from; “Start a trip from these” opens the new trip', async () => {
    data.listSomeday.mockResolvedValue([
      idea('Pujol', 'Mexico City', 'restaurant', 'https://www.instagram.com/p/abc'),
      idea('Frida Kahlo museum', 'Mexico City', 'activity'),
      idea('A cooking class', null, 'activity'),
    ])
    data.startTripFromSomeday.mockResolvedValue('t9')
    open('/someday')
    const mexico = (await screen.findByRole('heading', { name: /Mexico City/ })).parentElement!
    expect(within(mexico).getByText('2 ideas')).toBeInTheDocument()
    expect(within(mexico).getByText('Instagram')).toBeInTheDocument()
    const anywhere = screen.getByRole('heading', { name: /Anywhere/ }).parentElement!
    expect(within(anywhere).queryByRole('button', { name: /Start a trip/ })).toBeNull()
    fireEvent.click(within(mexico).getByRole('button', { name: 'Start a trip from these ›' }))
    await waitFor(() => expect(data.startTripFromSomeday).toHaveBeenCalledWith('Mexico City', 'Ana'))
  })

  it('save an idea: a pasted Google Maps link gives the name', async () => {
    data.listSomeday.mockResolvedValue([])
    data.saveSomeday.mockResolvedValue(undefined)
    open('/someday')
    fireEvent.click(await screen.findByRole('button', { name: '+ Save an idea' }))
    fireEvent.change(screen.getByLabelText(/^Link/), {
      target: { value: 'https://www.google.com/maps/place/Contramar/@19.4,-99.1,17z' },
    })
    expect(screen.getByLabelText('Name')).toHaveValue('Contramar')
    click('Save the idea')
    await waitFor(() =>
      expect(data.saveSomeday).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Contramar', kind: 'restaurant', place: null }),
      ),
    )
  })
})

describe('Your trips: Needs you and the ways to start', () => {
  it('what’s waiting across your trips, each line to the right page', async () => {
    data.listTrips.mockResolvedValue([
      card({
        id: 'j',
        name: 'Japan',
        start_date: '2099-04-02',
        end_date: '2099-04-12',
        undecidedCount: 2,
        undecided: { name: 'Where we sleep', options: 2 },
      }),
    ])
    open('/trips')
    const needs = (await screen.findByRole('heading', { name: 'Needs you' })).parentElement!
    expect(within(needs).getByRole('link', { name: /2 lines to decide/ })).toHaveAttribute('href', '/trips/j/compare')
    const start = screen.getByRole('region', { name: 'Start a trip' })
    expect(within(start).getByRole('link', { name: /From my AI/ })).toHaveAttribute('href', '/trips/import')
    fireEvent.click(within(start).getByRole('button', { name: /From a trip you had/ }))
    expect(within(start).getByRole('link', { name: /Japan/ })).toHaveAttribute('href', '/trips/j/settings?again=1')
  })
})

describe('+ N from Someday, on a place of the same name', () => {
  it('shows how many wait, and brings them into the place’s To try', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    data.listSomeday.mockResolvedValue([idea('La Cevichería', 'cartagena '), idea('Pujol', 'Mexico City')])
    data.somedayIntoPlace.mockResolvedValue(1)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: /1 idea from Someday/ }))
    await waitFor(() => expect(data.somedayIntoPlace).toHaveBeenCalledWith('p1'))
  })
})
