import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('daily estimates and the category words (build 6)', () => {
  const food = { id: 'e1', trip_id: 't1', place_id: 'p1', category: 'food', label: 'Food & drinks', amount: 30, currency: 'EUR', rate: 1, days: 4 }
  const withFood = (check = { daily_estimate_id: 'e1', days: 4, expected_days: 4, days_mismatch: false }) =>
    detail({
      places: [cartagena],
      dailyEstimates: [food],
      estimatePeople: [
        { daily_estimate_id: 'e1', trip_id: 't1', traveller_id: 'a' },
        { daily_estimate_id: 'e1', trip_id: 't1', traveller_id: 'b' },
      ],
      estimateChecks: [check],
    })

  it('adding to a place offers the budget’s words', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    open('/trips/t1')
    click(await screen.findByRole('button', { name: 'Add to Cartagena' }).then((b) => b.textContent!.trim().replace(/^\+\s*/, '')))
    const picker = screen.getByRole('radiogroup', { name: 'What is it?' })
    const words = [...picker.querySelectorAll('[role=radio]')].map((r) => r.textContent!.replace(/^\S+\s/, '').trim())
    expect(words).toEqual(['Stay', 'Activities', 'Food', 'Getting around', 'Other'])
  })

  it('an estimate under its place: ≈, the sum by hand, your share, estimated', async () => {
    data.getTrip.mockResolvedValue(withFood())
    open('/trips/t1')
    expect(await screen.findByText('Food & drinks')).toBeInTheDocument()
    expect(screen.getByText(/30 € a day each ×/)).toBeInTheDocument()
    expect(screen.getByText('120 €')).toBeInTheDocument() // 30 × 4 days, Ana's share
    expect(screen.getByText('Estimated')).toBeInTheDocument()
  })

  it('add one: a day each, days from the nights, who', async () => {
    data.getTrip.mockResolvedValue(detail({ places: [cartagena] }))
    data.saveDailyEstimate.mockResolvedValue('e9')
    open('/trips/t1')
    const adds = await screen.findAllByRole('button', { name: /Daily estimate/ })
    fireEvent.click(adds[0])
    expect(screen.getByLabelText('Days')).toHaveValue('4')
    type('A day, each', '30')
    fireEvent.click(screen.getByRole('radio', { name: 'Getting around' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Getting around')
    click('Bea')
    expect(screen.getByText('120 €')).toBeInTheDocument() // 30 € × 4 days × 1 person
    click('Add')
    await waitFor(() =>
      expect(data.saveDailyEstimate).toHaveBeenCalledWith({
        id: null,
        tripId: 't1',
        placeId: 'p1',
        category: 'local_transport',
        label: 'Getting around',
        amount: 30,
        currency: 'EUR',
        rate: 1,
        days: 4,
        travellers: ['a'],
      }),
    )
  })

  it('when the nights change: circled days, a note, and a one-tap fix', async () => {
    data.getTrip.mockResolvedValue(withFood({ daily_estimate_id: 'e1', days: 4, expected_days: 2, days_mismatch: true }))
    data.setEstimateDays.mockResolvedValue(undefined)
    open('/trips/t1')
    expect(await screen.findByText('↑ Cartagena has 2 nights now')).toBeInTheDocument()
    click('Make it 2 days')
    await waitFor(() => expect(data.setEstimateDays).toHaveBeenCalledWith('e1', 2))
  })

  it('“Keep 4” puts the note away', async () => {
    data.getTrip.mockResolvedValue(withFood({ daily_estimate_id: 'e1', days: 4, expected_days: 2, days_mismatch: true }))
    open('/trips/t1')
    click(await screen.findByRole('button', { name: 'Keep 4' }).then((b) => b.textContent!))
    expect(screen.queryByText(/has 2 nights now/)).not.toBeInTheDocument()
  })
})
