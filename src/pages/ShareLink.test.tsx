import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, data, detail, open } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

const shared = (showPrices = true) => {
  const d = detail({
    places: [cartagena],
    travellers: [
      { id: 'a', name: 'Traveller 1', user_id: null, position: 1 },
      { id: 'b', name: 'Traveller 2', user_id: null, position: 2 },
    ],
  })
  return { ...d, trip: { ...d.trip, is_demo: true }, shared: { token: 'tok123', showPrices, showNames: false } }
}

describe('read-only share link (build 8 step 6)', () => {
  it('from the trip menu: the link, Copy, what it shows, turning it off', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    data.shareLink.mockResolvedValue({ token: 'tok123', show_prices: true, show_names: false })
    data.setShare.mockResolvedValue(undefined)
    data.stopShare.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Share the trip' }))
    fireEvent.click(screen.getByRole('button', { name: 'Share a read-only link' }))
    const sheet = await screen.findByRole('dialog', { name: 'Share a read-only link' })
    expect(await within(sheet).findByText('voyagefare.app/s/tok123')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://voyagefare.app/s/tok123'))
    expect(within(sheet).getByText(/Never in the link/)).toHaveTextContent('who paid what')

    expect(within(sheet).getByRole('switch', { name: /Prices and the budget/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(sheet).getByRole('switch', { name: /Travellers’ names/ }))
    await waitFor(() => expect(data.setShare).toHaveBeenCalledWith('t1', true, true))

    fireEvent.click(within(sheet).getByRole('button', { name: 'Turn the link off' }))
    await waitFor(() => expect(data.stopShare).toHaveBeenCalledWith('t1'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Share a read-only link' })).toBeNull())
  })

  it('what a visitor sees: the trip, read-only, a note on top; no Who paid', async () => {
    data.sharedTrip.mockResolvedValue(shared())
    open('/s/tok123')
    expect(await screen.findByRole('heading', { name: 'Colombia' })).toBeInTheDocument()
    const note = screen.getByRole('complementary', { name: 'Shared with you' })
    expect(within(note).getByText(/read-only/)).toBeInTheDocument()
    expect(within(note).getByRole('link', { name: 'Plan mine ›' })).toHaveAttribute('href', '/')
    const nav = screen.getByRole('navigation', { name: 'Trip' })
    expect(within(nav).getByRole('link', { name: /Budget/ })).toHaveAttribute('href', '/s/tok123/budget')
    expect(within(nav).queryByRole('link', { name: /Who paid/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add a place|Add to Cartagena/ })).toBeNull()
    expect(data.getTrip).not.toHaveBeenCalled()
  })

  it('prices off: no Budget tab', async () => {
    data.sharedTrip.mockResolvedValue(shared(false))
    open('/s/tok123')
    await screen.findByRole('heading', { name: 'Colombia' })
    expect(within(screen.getByRole('navigation', { name: 'Trip' })).queryByRole('link', { name: /Budget/ })).toBeNull()
  })

  it('a link turned off (or made up): one plain page', async () => {
    data.sharedTrip.mockResolvedValue(null)
    open('/s/nope')
    expect(await screen.findByRole('heading', { name: 'This link doesn’t work any more' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'What’s Voyage Fare?' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('heading', { name: 'Colombia' })).toBeNull()
  })
})
