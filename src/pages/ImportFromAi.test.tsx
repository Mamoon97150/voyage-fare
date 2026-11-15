import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/rates', async (original) => ({
  ...(await original<typeof import('../lib/rates')>()),
  fetchRate: vi.fn(async (from: string) => (from === 'JPY' ? 0.0062 : 1)),
}))

const answer = `Here you go!
\`\`\`json
{ "trip": { "name": "Japan in spring", "start": "2027-04-02", "end": "2027-04-12", "from": "Paris", "currency": "EUR", "travellers": ["Ana", "Bea"] },
  "places": [ { "name": "Tokyo", "nights": 4, "lines": [
    { "type": "stay", "name": "Where we sleep", "options": [ { "name": "Hotel Gracery", "price": 160, "per": "night" } ] },
    { "type": "activity", "name": "teamLab Planets", "day": 2, "options": [ { "price": 5200, "currency": "JPY", "per": "person" } ] } ] } ] }
\`\`\``

describe('import from my AI (build 8 step 2)', () => {
  it('a new trip: copy the request, paste the answer, check the preview, create it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    data.createTrip.mockResolvedValue('new-trip')
    data.importLines.mockResolvedValue({ places: 1, lines: 2 })
    data.getTrip.mockResolvedValue(detail({ trip: { ...detail().trip, id: 'new-trip', name: 'Japan in spring' } }))
    open('/trips/import')
    fireEvent.click(await screen.findByRole('button', { name: 'Copy the request' }))
    await waitFor(() => expect(writeText.mock.calls[0][0]).toContain('Answer with the JSON only'))
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument()

    type('Paste its answer', answer)
    click('See what it gives')
    expect(await screen.findByRole('heading', { name: 'Japan in spring' })).toBeInTheDocument()
    const tokyo = screen.getByRole('region', { name: 'Tokyo' })
    expect(within(tokyo).getByText('Where we sleep: Hotel Gracery')).toBeInTheDocument()
    expect(within(tokyo).getByText('4 nights × 160 €')).toBeInTheDocument()
    expect(await screen.findByText(/Prices in JPY are saved with today’s rate/)).toBeInTheDocument()
    expect(screen.getByText(/you mark what’s booked yourself/)).toBeInTheDocument()

    click('Create the trip')
    await waitFor(() => expect(data.importLines).toHaveBeenCalled())
    expect(data.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Japan in spring',
        me: 'Ana',
        travellers: ['Bea'],
        startDate: '2027-04-02',
        homeCity: 'Paris',
        currency: 'EUR',
      }),
    )
    const payload = data.importLines.mock.calls[0][1] as {
      places: { lines: { options: { amount: number; currency: string; rate: number }[] }[] }[]
    }
    expect(payload.places[0].lines[1].options[0]).toMatchObject({ amount: 10400, currency: 'JPY', rate: 0.0062 })
    expect(await screen.findByText(/Added from your AI: 1 place, 2 lines/)).toBeInTheDocument()
  })

  it('an answer with no trip in it: say so, and offer the request again', async () => {
    open('/trips/import')
    await screen.findByLabelText('Paste its answer')
    type('Paste its answer', 'I planned a lovely trip to Japan for you!')
    click('See what it gives')
    expect(await screen.findByText(/We couldn’t find the trip in this answer/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy the request again' })).toBeInTheDocument()
  })

  it('from a trip’s menu: add to it, only what’s new', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        places: [{ id: 'p1', name: 'Tokyo', nights: 4, position: 1 }],
        items: [{ id: 'x', place_id: 'p1', name: 'teamLab Planets' }],
      }),
    )
    data.importLines.mockResolvedValue({ places: 0, lines: 1 })
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Trip menu' }))
    expect(screen.getByRole('menuitem', { name: /Import from my AI/ })).toHaveAttribute('href', '/trips/t1/import')
    open('/trips/t1/import')
    expect(await screen.findByRole('heading', { name: 'Add to Colombia' })).toBeInTheDocument()
    type('Paste its answer', answer)
    click('See what it gives')
    expect(await screen.findByText('already there')).toBeInTheDocument()
    click('Add 1 line')
    await waitFor(() => expect(data.importLines).toHaveBeenCalledWith('t1', expect.anything()))
    const payload = data.importLines.mock.calls.at(-1)![1] as { places: { id: string; lines: { name: string }[] }[] }
    expect(payload.places).toEqual([
      expect.objectContaining({ id: 'p1', lines: [expect.objectContaining({ name: 'Where we sleep' })] }),
    ])
  })
})
