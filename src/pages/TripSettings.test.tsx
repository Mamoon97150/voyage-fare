import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { click, data, detail, open, trip, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)
vi.mock('../lib/places', async (original) => ({
  ...(await original<typeof import('../lib/places')>()),
  searchPlaces: (await import('../test/fakes')).data.searchPlaces,
}))

describe('trip settings', () => {
  it('the initials at the top lead to the settings', async () => {
    open('/trips/t1')
    const link = await screen.findByRole('link', { name: 'Trip settings: Ana, Bea' })
    expect(link).toHaveAttribute('href', '/trips/t1/settings')
  })

  it('change the name, dates and target, and save', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.updateTrip.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    expect(await screen.findByLabelText('Name')).toHaveValue('Colombia')
    type('Name', 'Colombia with my sisters')
    fireEvent.click(screen.getByLabelText('Dates not decided yet'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-05-12' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2027-05-24' } })
    type('Target', '3.000')
    click('Save the trip')
    await waitFor(() =>
      expect(data.updateTrip).toHaveBeenCalledWith('t1', {
        name: 'Colombia with my sisters',
        startDate: '2027-05-12',
        endDate: '2027-05-24',
        homeCity: 'St Martin',
        homeLatitude: undefined,
        homeLongitude: undefined,
        targetAmount: 3000,
        targetScope: 'per_person',
      }),
    )
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('removing a traveller who paid says why it can’t', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.removeTraveller.mockRejectedValue({ code: 'P0001', message: 'Bea has paid or owes money on this trip: settle up first.' })
    open('/trips/t1/settings')
    await screen.findByText('Travellers')
    expect(screen.queryByRole('button', { name: 'Remove Ana' })).not.toBeInTheDocument() // that's you
    click('Remove Bea')
    click('Yes, remove Bea')
    expect(await screen.findByText('Bea has paid or owes money on this trip: settle up first.')).toBeInTheDocument()
  })

  it('rename and add travellers', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.renameTraveller.mockResolvedValue(undefined)
    data.addTraveller.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    await screen.findByText('Travellers')
    click('Rename Bea')
    type('New name for Bea', 'Béatrice')
    click('Save')
    await waitFor(() => expect(data.renameTraveller).toHaveBeenCalledWith('b', 'Béatrice'))
    type('New traveller', 'Dana')
    click('Add')
    await waitFor(() => expect(data.addTraveller).toHaveBeenCalledWith('t1', 'Dana', expect.any(Number)))
  })

  it('only the creator can delete the trip; the others can leave it', async () => {
    data.isTripOwner.mockResolvedValue(false)
    open('/trips/t1/settings')
    expect(await screen.findByRole('button', { name: 'Leave Colombia' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete Colombia/ })).not.toBeInTheDocument()
  })

  it('the creator deletes it after one confirmation, and lands on Your trips', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.deleteTrip.mockResolvedValue(undefined)
    data.listTrips.mockResolvedValue([])
    open('/trips/t1/settings')
    await screen.findByRole('button', { name: 'Delete Colombia' })
    click('Delete Colombia')
    expect(screen.getByText(/Everything in Colombia goes/)).toBeInTheDocument()
    click('Yes, delete Colombia')
    await waitFor(() => expect(data.deleteTrip).toHaveBeenCalledWith('t1'))
    expect(await screen.findByText('No trips yet')).toBeInTheDocument()
  })
})

describe('invitations (build 6)', () => {
  const withGabriel = () =>
    detail({
      travellers: [
        { id: 'a', name: 'Ana', user_id: 'u-ana' },
        { id: 'd', name: 'Danielle', user_id: 'u-dan' },
        { id: 'p', name: 'Peggy', user_id: null },
        { id: 'g', name: 'Gabriel', user_id: null },
      ],
    })

  it('each traveller says where they stand', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.getTrip.mockResolvedValue(withGabriel())
    data.listOpenInvitations.mockResolvedValue([{ traveller_id: 'p', created_at: new Date().toISOString() }])
    open('/trips/t1/settings')
    expect(await screen.findByText('You · created the trip')).toBeInTheDocument()
    expect(screen.getByText('On the trip')).toBeInTheDocument()
    expect(await screen.findByText('sent today, not opened yet')).toBeInTheDocument()
    expect(screen.getByText('Not invited yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send the link again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Danielle' })).toBeInTheDocument() // the creator can
  })

  it('“Invite” gives the link tied to that name', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.getTrip.mockResolvedValue(withGabriel())
    data.inviteTraveller.mockResolvedValue({ token: 'k7q2', expiresAt: '2026-11-28' })
    open('/trips/t1/settings')
    const invites = await screen.findAllByRole('button', { name: 'Invite' })
    fireEvent.click(invites[1]) // Peggy, then Gabriel
    expect(await screen.findByLabelText('Link for Gabriel')).toHaveValue('https://voyagefare.test/join/k7q2')
    expect(data.inviteTraveller).toHaveBeenCalledWith('g')
    expect(screen.getByRole('button', { name: 'Share…' })).toBeInTheDocument()
  })

  it('cancel an invite', async () => {
    data.isTripOwner.mockResolvedValue(true)
    data.getTrip.mockResolvedValue(withGabriel())
    data.listOpenInvitations.mockResolvedValue([{ traveller_id: 'p', created_at: new Date().toISOString() }])
    data.cancelInvitation.mockResolvedValue(undefined)
    open('/trips/t1/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel the invite' }))
    await waitFor(() => expect(data.cancelInvitation).toHaveBeenCalledWith('p'))
  })

  it('someone on the trip with an account: only the creator removes them', async () => {
    data.isTripOwner.mockResolvedValue(false)
    data.getTrip.mockResolvedValue(withGabriel())
    open('/trips/t1/settings')
    await screen.findByText('On the trip')
    expect(screen.queryByRole('button', { name: 'Remove Danielle' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Gabriel' })).toBeInTheDocument()
  })

  it('the link: whose trip, who you are, then join', async () => {
    data.getInvitationPreview.mockResolvedValue({
      trip_id: 't1',
      trip_name: 'Colombia',
      start_date: null,
      end_date: null,
      places: ['Bogotá', 'Medellín'],
      traveller_name: 'Gabriel',
      invited_by_name: 'Djamina',
      state: 'open',
    })
    data.acceptInvitation.mockResolvedValue('t1')
    open('/join/k7q2')
    expect(await screen.findByText('Djamina invited you to')).toBeInTheDocument()
    expect(screen.getByText('Gabriel')).toBeInTheDocument()
    click('Join as Gabriel')
    await waitFor(() => expect(data.acceptInvitation).toHaveBeenCalledWith('k7q2'))
    expect(await screen.findByRole('link', { name: 'Trip settings: Ana, Bea' })).toBeInTheDocument()
  })

  it('a link that doesn’t work any more says to ask for a new one', async () => {
    data.getInvitationPreview.mockResolvedValue({
      trip_id: 't1', trip_name: 'Colombia', start_date: null, end_date: null, places: [],
      traveller_name: 'Gabriel', invited_by_name: 'Djamina', state: 'expired',
    })
    open('/join/old')
    expect(await screen.findByText('This invitation doesn’t work any more')).toBeInTheDocument()
    expect(screen.getByText(/Ask Djamina for a new one/)).toBeInTheDocument()
  })

  it('a welcome note from whoever invited you, shown once', async () => {
    data.getTrip.mockResolvedValue(
      detail({
        trip: { ...trip, created_by: 'u-dj' },
        travellers: [
          { id: 'dj', name: 'Djamina', user_id: 'u-dj' },
          { id: 'a', name: 'Ana', user_id: 'u-ana' },
        ],
      }),
    )
    data.getMyWelcome.mockResolvedValue({ invitedBy: 'u-dj' })
    const first = open('/trips/t1')
    expect(await screen.findByText(/Welcome aboard, Ana!/)).toBeInTheDocument()
    expect(screen.getByText('— Djamina')).toBeInTheDocument()
    click('got it ✓')
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument()
    first.unmount()
    open('/trips/t1')
    await screen.findByRole('link', { name: /Trip settings/ })
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument()
  })
})
