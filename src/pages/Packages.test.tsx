import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cartagena, click, data, detail, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('agency packages (build 6)', () => {
  const hotel = { id: 'h1', trip_id: 't1', place_id: 'p1', kind: 'housing', category: 'accommodation', name: 'Casa Lola', status: 'booked', package_id: 'pk', position: 1, day_number: null, end_day_number: null, note: null }
  const dinner = { id: 'd1', trip_id: 't1', place_id: 'p1', kind: 'restaurant', category: 'food', name: 'La Cevichería', status: 'chosen', package_id: null, position: 2, day_number: null, end_day_number: null, note: null }
  const pkg = { id: 'pk', trip_id: 't1', place_id: null, kind: 'package', category: 'package', name: 'Frégate Agency package', status: 'booked', package_id: null, position: 1, day_number: null, end_day_number: null, note: null }
  const withPackage = () =>
    detail({
      places: [cartagena],
      items: [hotel, dinner, pkg],
      amounts: [
        { item_id: 'h1', current: 0, is_confirmed: true },
        { item_id: 'd1', current: 80, is_confirmed: false },
        { item_id: 'pk', current: 5120, is_confirmed: true },
      ],
    })

  it('a covered line says “in the package”; the package says what it covers; the place, “+ package”', async () => {
    data.getTrip.mockResolvedValue(withPackage())
    open('/trips/t1')
    expect(await screen.findByText('Casa Lola')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'Change Casa Lola' })
    expect(row).toHaveTextContent('in the')
    expect(row.querySelector('.item-row__status--package')).toHaveTextContent('Package')
    expect(screen.getByText('covers 1 stay')).toBeInTheDocument()
    expect(screen.getByText('+ package')).toBeInTheDocument()
  })

  it('add a package to the whole trip and tick what it covers', async () => {
    data.getTrip.mockResolvedValue(withPackage())
    data.addItem.mockResolvedValue('pk2')
    data.setPackageCover.mockResolvedValue(undefined)
    open('/trips/t1')
    click(await screen.findByRole('button', { name: /Add to the whole trip/ }).then((b) => b.textContent!.replace(/^\+\s*/, '').trim()))
    const picker = screen.getByRole('radiogroup', { name: 'What is it?' })
    fireEvent.click([...picker.querySelectorAll('[role=radio]')].find((r) => r.textContent?.includes('Package'))!)
    type('Name', 'Second package')
    type('Price', '900')
    fireEvent.click(screen.getByRole('checkbox', { name: /La Cevichería/ }))
    expect(screen.queryByRole('checkbox', { name: /Casa Lola/ })).not.toBeInTheDocument() // already in the other package
    click('Add')
    await waitFor(() => expect(data.setPackageCover).toHaveBeenCalledWith('pk2', ['d1']))
    expect(data.addItem).toHaveBeenCalledWith(expect.objectContaining({ kind: 'package', name: 'Second package', amount: 900, placeId: null }))
  })

  it('a line can join a package from its own form', async () => {
    data.getTrip.mockResolvedValue(withPackage())
    data.setItemPackage.mockResolvedValue(undefined)
    open('/trips/t1')
    fireEvent.click(await screen.findByRole('button', { name: 'Change La Cevichería' }))
    fireEvent.change(screen.getByLabelText('Part of a package'), { target: { value: 'pk' } })
    await waitFor(() => expect(data.setItemPackage).toHaveBeenCalledWith('d1', 'pk'))
  })
})
