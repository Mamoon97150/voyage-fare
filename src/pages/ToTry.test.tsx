import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { addDays } from '../lib/tripText'
import { todayIso } from '../lib/shelf'
import { cartagena, click, data, detail, open, trip, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

// Mockup to-try-v5 (15 Nov): the restaurant pool "To try".
const restaurant = (over: Record<string, unknown>) => ({
  place_id: 'p1',
  kind: 'restaurant',
  category: 'food',
  status: 'idea',
  day_number: null,
  end_day_number: null,
  position: 1,
  note: null,
  link: null,
  meal: null,
  verdict: null,
  package_id: null,
  ...over,
})
const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ')

const pool = (over: Record<string, unknown> = {}) =>
  detail({
    trip: { ...trip, start_date: '2026-09-04', end_date: '2026-09-07' },
    places: [cartagena],
    items: [
      restaurant({ id: 'c1', name: 'El Cielo', note: 'the tasting menu', link: 'https://www.instagram.com/p/C9xK2/' }),
      restaurant({ id: 'c2', name: 'Carmen', status: 'chosen', day_number: 2, meal: 'dinner' }),
    ],
    options: [{ id: 'o1', item_id: 'c1', name: 'El Cielo', amount: 190, rate: 1, currency: 'EUR', is_chosen: false }],
    ...over,
  })

describe('To try', () => {
  it('on the place: where it was found, the note, the price each, and how many wait', async () => {
    data.getTrip.mockResolvedValue(pool())
    open('/trips/t1')
    expect(await screen.findByText('no day yet')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Cartagena/ })).toHaveTextContent('4 nights · 1 to try')
    expect(screen.getByRole('link', { name: 'Open on Instagram' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/p/C9xK2/',
    )
    expect(screen.getByText('the tasting menu')).toBeInTheDocument()
    expect(plain(screen.getByText(/each$/).textContent)).toBe('≈ 95 € each')
  })

  it('put it on a day: the days with their dates and what’s on them, then a meal', async () => {
    data.getTrip.mockResolvedValue(pool())
    data.setRestaurantDay.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Put El Cielo on a day' }))
    const picker = screen.getByRole('group', { name: 'Which day in Cartagena?' })
    expect(within(picker).getByRole('button', { name: 'Day 2, Carmen already' })).toHaveTextContent('2Sat 5● Carmen')
    expect(within(picker).getByRole('button', { name: 'Day 1' })).toHaveTextContent('arrive')
    expect(within(picker).getByRole('button', { name: 'Pick a day' })).toBeDisabled()
    fireEvent.click(within(picker).getByRole('button', { name: 'Day 3' }))
    fireEvent.click(within(picker).getByRole('radio', { name: 'Lunch' }))
    fireEvent.click(within(picker).getByRole('button', { name: 'Put on day 3' }))
    await waitFor(() => expect(data.setRestaurantDay).toHaveBeenCalledWith('c1', 3, 'lunch'))
  })

  it('+ To try from a link: Google Maps gives the name; the price is each', async () => {
    data.getTrip.mockResolvedValue(pool())
    data.addToTry.mockResolvedValue('new')
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'To try' }))
    type('Link', 'https://www.google.com/maps/place/Pergamino+Caf%C3%A9/@6.2,-75.5,17z')
    expect(screen.getByLabelText('Name')).toHaveValue('Pergamino Café')
    expect(screen.getByText('Google Maps')).toBeInTheDocument()
    type('A note (optional)', 'best coffee')
    click('+ A price, if you know it')
    type('A price, each', '6')
    click('Add to To try')
    await waitFor(() =>
      expect(data.addToTry).toHaveBeenCalledWith({
        placeId: 'p1',
        name: 'Pergamino Café',
        link: 'https://www.google.com/maps/place/Pergamino+Caf%C3%A9/@6.2,-75.5,17z',
        note: 'best coffee',
        amount: 12,
        kind: 'restaurant',
      }),
    )
  })

  it('a link that isn’t one is said', async () => {
    data.getTrip.mockResolvedValue(pool())
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'To try' }))
    type('Link', 'instagram el cielo')
    type('Name', 'El Cielo')
    click('Add to To try')
    expect(screen.getByText('Paste the whole address, starting with https://')).toBeInTheDocument()
    expect(data.addToTry).not.toHaveBeenCalled()
  })

  it('on a day with no price and a food estimate: “in your food budget”', async () => {
    data.getTrip.mockResolvedValue(
      pool({
        items: [restaurant({ id: 'c3', name: 'Mondongo’s', day_number: 3, meal: 'lunch' })],
        options: [],
        dailyEstimates: [
          { id: 'e1', category: 'food', place_id: 'p1', label: 'Food', amount: 30, rate: 1, days: 4, currency: 'EUR' },
        ],
      }),
    )
    open('/trips/t1')
    const row = await screen.findByRole('button', { name: /Change Mondongo’s/ })
    expect(row).toHaveTextContent('lunch')
    expect(row).toHaveTextContent('in your food budget')
    expect(row).not.toHaveTextContent('Idea')
  })

  it('once the day has come: Loved it · Fine · Skip; the loved ones are kept', async () => {
    data.setVerdict.mockResolvedValue(undefined)
    data.getTrip.mockResolvedValue(
      pool({
        trip: { ...trip, start_date: addDays(todayIso(), -1), end_date: addDays(todayIso(), 3) },
        items: [
          restaurant({ id: 'c2', name: 'Carmen', status: 'chosen', day_number: 2, meal: 'dinner' }),
          restaurant({
            id: 'c4',
            name: 'La Cevichería',
            status: 'chosen',
            day_number: 1,
            verdict: 'loved',
            link: 'https://www.tiktok.com/@ceviche/video/1',
          }),
        ],
        options: [],
      }),
    )
    open('/trips/t1')
    const how = await screen.findByRole('group', { name: 'How was Carmen?' })
    fireEvent.click(within(how).getByRole('button', { name: '♥ Loved it' }))
    await waitFor(() => expect(data.setVerdict).toHaveBeenCalledWith('c2', 'loved'))
    expect(screen.queryByRole('group', { name: 'How was La Cevichería?' })).not.toBeInTheDocument()
    const loved = screen.getByRole('region', { name: /Places we loved/ })
    expect(loved).toHaveTextContent('La Cevichería')
    expect(loved).toHaveTextContent('Cartagena · day 1')
    expect(within(loved).getByRole('link', { name: 'Open on TikTok' })).toBeInTheDocument()
  })

  it('back to To try from the line’s form', async () => {
    data.setRestaurantDay.mockResolvedValue(undefined)
    data.getTrip.mockResolvedValue(pool())
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: /Change Carmen/ }))
    click('More ▾')
    click('Back to To try')
    await waitFor(() => expect(data.setRestaurantDay).toHaveBeenCalledWith('c2', null))
  })
})
