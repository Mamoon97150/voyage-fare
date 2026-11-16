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
  it('from Me: kind, message, what goes with it, then a thank-you', async () => {
    data.sendFeedback.mockResolvedValue(undefined)
    open('/me')
    fireEvent.click(await screen.findByRole('button', { name: /Send feedback/ }))
    expect(screen.queryByRole('heading', { name: /Admin/ })).toBeNull() // not an admin
    const sheet = screen.getByRole('dialog', { name: 'Send feedback' })
    expect(sheet).toHaveTextContent('the page you’re on (Me)')
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
          page: 'Me',
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
    open('/me')
    // Admins only: a block on top of Me, with what's new; a dot on the Me tab.
    expect(await screen.findByRole('heading', { name: /Admin\s*● 1 new/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Admin dashboard/ })).toHaveAttribute('href', '/admin')
    expect(screen.getByLabelText('1 new for Admin')).toBeInTheDocument()

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
    // Notify me: this test browser can't show notifications, so it says how to get them.
    expect(await screen.findByRole('switch', { name: /Notify me/ })).toBeDisabled()
    // AI reading (step 5a): this month's use of the cap, and the switch for everyone.
    expect(screen.getByRole('meter', { name: 'AI reading used' })).toHaveAttribute('aria-valuenow', '21')
    expect(screen.getByText('$1.24 / $5.80')).toBeInTheDocument()
    expect(screen.getByText('212')).toBeInTheDocument()
    data.setAiEnabled.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('switch', { name: /AI reading on for everyone/ }))
    await waitFor(() => expect(data.setAiEnabled).toHaveBeenCalledWith(false))
    expect(await screen.findByRole('switch', { name: /AI reading off for everyone/ })).not.toBeChecked()

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

describe('hello@ inside Admin (stage B)', () => {
  it('emails to hello@ in the same list: open, reply from hello@, done', async () => {
    data.amIAdmin.mockResolvedValue(true)
    data.adminOverview.mockResolvedValue(overview)
    data.adminMessages.mockResolvedValue([])
    data.inboxThreads.mockResolvedValue([
      {
        id: 'th1',
        subject: 'Group trip to Dubai',
        from: 'Talisa <talisa@mail.test>',
        emails: 1,
        read: false,
        done: false,
        received_at: '2026-11-15T19:05:00Z',
      },
    ])
    data.inboxRead.mockResolvedValue([
      {
        id: 'e1',
        direction: 'inbound',
        from: 'Talisa <talisa@mail.test>',
        subject: 'Group trip to Dubai',
        text: 'Could I test it with my girls’ trip?',
        attachments: [],
        received_at: '2026-11-15T19:05:00Z',
      },
    ])
    data.inboxReply.mockResolvedValue({ id: 'sent1' })
    data.inboxDone.mockResolvedValue({ ok: true })
    open('/admin')
    await screen.findByText('+2 this week')
    click(/Messages/)
    expect(await screen.findByText('Talisa · hello@')).toBeInTheDocument()
    click('Open')
    expect(await screen.findByText('Could I test it with my girls’ trip?')).toBeInTheDocument()
    expect(screen.getByText('from hello@voyagefare.app')).toBeInTheDocument()
    type('Your reply', 'With pleasure!')
    click('Send')
    await waitFor(() => expect(data.inboxReply).toHaveBeenCalledWith('th1', 'e1', 'With pleasure!'))
    expect(await screen.findByText('✓ Sent from hello@voyagefare.app')).toBeInTheDocument()
    click('Done')
    await waitFor(() => expect(data.inboxDone).toHaveBeenCalledWith('th1', true))
  })

  it('the key isn’t set up yet: the app’s feedback still shows, and it says why hello@ is missing', async () => {
    data.amIAdmin.mockResolvedValue(true)
    data.adminOverview.mockResolvedValue(overview)
    data.adminMessages.mockResolvedValue([])
    data.inboxThreads.mockRejectedValue(new Error('The Resend key isn’t set up yet.'))
    open('/admin')
    await screen.findByText('+2 this week')
    click(/Messages/)
    expect(await screen.findByText(/hello@ couldn’t be read: The Resend key isn’t set up yet./)).toBeInTheDocument()
  })
})
