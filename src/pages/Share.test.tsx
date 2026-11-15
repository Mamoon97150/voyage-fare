import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { card } from '../test/cards'
import { todayIso } from '../lib/shelf'
import { addDays } from '../lib/tripText'
import { click, data, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

const lisbon = card({
  id: 'li',
  name: 'Lisbon & Porto',
  start_date: addDays(todayIso(), 148),
  end_date: addDays(todayIso(), 156),
  places: [
    { id: 'l', name: 'Lisbon', nights: 3 },
    { id: 's', name: 'Sintra', nights: 1 },
    { id: 'p', name: 'Porto', nights: 4 },
  ],
})
const japan = card({
  id: 'jp',
  name: 'Japan',
  start_date: null,
  end_date: null,
  places: [{ id: 'k', name: 'Kyoto', nights: 5 }],
})

describe('a post shared to Voyage Fare (Android Share menu)', () => {
  it('the link is in, the next trip first: pick the place, a name, done', async () => {
    data.listTrips.mockResolvedValue([japan, lisbon])
    data.addToTry.mockResolvedValue('new')
    open('/share?text=' + encodeURIComponent('https://www.instagram.com/p/C9xK2/'))
    expect(await screen.findByText('shared from Instagram')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Lisbon & Porto' })).toHaveAttribute('aria-checked', 'true')
    click('Add to To try')
    expect(await screen.findByText('Pick the place it’s in.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Porto' }))
    type('Name', 'Cantinho do Avillez')
    type('A note (optional)', 'the francesinha')
    click('Add to To try')
    await waitFor(() =>
      expect(data.addToTry).toHaveBeenCalledWith({
        placeId: 'p',
        name: 'Cantinho do Avillez',
        link: 'https://www.instagram.com/p/C9xK2/',
        note: 'the francesinha',
        amount: null,
      }),
    )
  })

  it('a trip with one place: the place is picked already', async () => {
    data.listTrips.mockResolvedValue([japan])
    open('/share?url=' + encodeURIComponent('https://maps.app.goo.gl/x') + '&title=Gion%20Duck')
    expect(await screen.findByRole('radio', { name: 'Kyoto' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Name')).toHaveValue('Gion Duck')
  })

  it('no trip yet: start one first', async () => {
    data.listTrips.mockResolvedValue([])
    open('/share?text=https://instagram.com/p/1')
    expect(await screen.findByRole('link', { name: '+ Start a trip' })).toHaveAttribute('href', '/trips/new')
  })
})
