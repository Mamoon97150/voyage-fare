import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { click, data, open, type } from '../test/app'

vi.mock('../lib/supabase', async () => (await import('../test/fakes')).supabaseModule)
vi.mock('../lib/trips', async () => (await import('../test/fakes')).tripsModule)

const overview = {
  accounts: 6,
  accounts_week: 2,
  trips: 9,
  trips_week: 3,
  active_week: 4,
  new_messages: 1,
  database_bytes: 18 * 1024 ** 2,
  files_bytes: 12 * 1024 ** 2,
}

describe('send feedback (any signed-in person)', () => {
  it('from the account menu: kind, message, what goes with it, then a thank-you', async () => {
    data.listTrips.mockResolvedValue([])
    data.sendFeedback.mockResolvedValue(undefined)
    open('/trips')
    await screen.findByText('Your first trip')
    fireEvent.click(screen.getByRole('button', { name: /Your account/ }))
    expect(screen.queryByRole('menuitem', { name: /Admin/ })).toBeNull() // not an admin
    fireEvent.click(screen.getByRole('menuitem', { name: /Send feedback/ }))
    const sheet = screen.getByRole('dialog', { name: 'Send feedback' })
    expect(sheet).toHaveTextContent('the page you’re on (Your trips)')
    click('Send')
    expect(await screen.findByText('What kind of message is it?')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'An idea' }))
    type('Your message', 'Hotels on a map, please')
    fireEvent.click(within(sheet).getByRole('switch', { name: /You can write back to me/ }))
    click('Send')
    await waitFor(() =>
      expect(data.sendFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'idea',
          message: 'Hotels on a map, please',
          page: 'Your trips',
          canReply: false,
        }),
      ),
    )
    expect(await screen.findByText('Thank you, Ana!')).toBeInTheDocument()
  })
})

describe('the Admin dashboard (admins only)', () => {
  it('not an admin: a plain message, nothing loaded', async () => {
    open('/admin')
    expect(await screen.findByText('This page is for Voyage Fare’s admins.')).toBeInTheDocument()
    expect(data.adminOverview).not.toHaveBeenCalled()
  })

  it('an admin: the menu line with new messages; Overview, Messages, People, Admins', async () => {
    data.amIAdmin.mockResolvedValue(true)
    data.adminOverview.mockResolvedValue(overview)
    data.listTrips.mockResolvedValue([])
    open('/trips')
    await screen.findByText('Your first trip')
    fireEvent.click(screen.getByRole('button', { name: /Your account/ }))
    expect(await screen.findByRole('menuitem', { name: /Admin\s*1 new/ })).toHaveAttribute('href', '/admin')

    data.adminMessages.mockResolvedValue([
      {
        id: 'm1',
        kind: 'broken',
        message: 'Budget shows 0 € for Medellín',
        page: 'Budget · Colombia',
        device: 'iPhone, Safari',
        can_reply: true,
        status: 'new',
        created_at: '2026-11-15T18:42:00Z',
        first_name: 'Ana',
        email: 'ana@mail.test',
      },
    ])
    data.markMessage.mockResolvedValue(undefined)
    data.adminPeople.mockResolvedValue([
      {
        user_id: 'u1',
        first_name: 'Ana',
        email: 'ana@mail.test',
        created_at: '2026-11-15T10:00:00Z',
        last_seen: null,
        confirmed: false,
        trips: 0,
        is_admin: false,
        is_first: false,
      },
    ])
    data.adminList.mockResolvedValue([
      { user_id: 'u-ana', first_name: 'Ana', is_first: true, added_by_name: null, created_at: '2026-11-15T10:00:00Z' },
    ])
    data.addAdmin.mockResolvedValue(undefined)

    open('/admin')
    expect(await screen.findByText('6')).toBeInTheDocument()
    expect(screen.getByText('+2 this week')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Files stored' })).toBeInTheDocument()

    click(/Messages/)
    expect(await screen.findByText('Budget shows 0 € for Medellín')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reply by email' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:ana@mail\.test/),
    )
    click('Done')
    await waitFor(() => expect(data.markMessage).toHaveBeenCalledWith('m1', 'done'))

    click('People')
    expect(await screen.findByText(/email not confirmed/)).toBeInTheDocument()
    expect(screen.getByText(/never what’s in their trips/)).toBeInTheDocument()

    click('Admins')
    expect(await screen.findByText('first admin · can’t be removed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
    type('Add an admin', 'jo@mail.test')
    click('Add')
    await waitFor(() => expect(data.addAdmin).toHaveBeenCalledWith('jo@mail.test'))
  })
})
