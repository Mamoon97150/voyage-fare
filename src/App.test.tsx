import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import { AuthProvider } from './lib/auth'

// A fake Supabase: the tests decide who is signed in and what the server answers.
const fake = vi.hoisted(() => {
  type Listener = (event: string, session: unknown) => void
  const state = { session: null as unknown, listeners: [] as Listener[] }
  const emit = (event: string, session: unknown) => {
    state.session = session
    state.listeners.forEach((l) => l(event, session))
  }
  return {
    state,
    emit,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session } })),
      onAuthStateChange: vi.fn((listener: Listener) => {
        state.listeners.push(listener)
        return {
          data: {
            subscription: { unsubscribe: () => (state.listeners = state.listeners.filter((l) => l !== listener)) },
          },
        }
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      resend: vi.fn(),
      signOut: vi.fn(async () => emit('SIGNED_OUT', null)),
    },
    rpc: vi.fn(),
  }
})

vi.mock('./lib/supabase', () => ({ supabase: { auth: fake.auth, rpc: fake.rpc } }))
const pwned = vi.hoisted(() => ({ isPwned: vi.fn(async () => false) }))
vi.mock('./lib/pwned', () => pwned)

const session = { user: { email: 'dana@mail.com' } }

beforeEach(() => {
  fake.state.session = null
  fake.state.listeners = []
  Object.values(fake.auth).forEach((fn) => fn.mockClear())
})

function open(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('home', () => {
  it('shows the name and the promise', async () => {
    open('/')
    expect(screen.getAllByText('Voyage Fare')).toHaveLength(2) // the bar and the footer
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/what it really costs/)
    // The demo is the main button (build 7, step 3); creating a notebook comes next.
    const demo = await screen.findAllByRole('link', { name: 'Try it with a real trip' })
    expect(demo[0]).toHaveAttribute('href', '/demo')
    expect(screen.getAllByRole('link', { name: /create (my|your) notebook/i })[0]).toHaveAttribute('href', '/sign-up')
    // A real trip as a sample, then how it works in three steps.
    expect(screen.getByRole('heading', { name: 'Colombia & Panama' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who paid what, settled' })).toBeInTheDocument()
    expect(screen.getByText('Made by Djamina, for trips with her sisters.')).toBeInTheDocument()
  })
})

describe('pages that need an account', () => {
  it('signed out → sign in, then back to the page asked for', async () => {
    fake.auth.signInWithPassword.mockImplementation(async () => {
      fake.emit('SIGNED_IN', session)
      return { data: { session }, error: null }
    })
    open('/trips?from=link')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()

    type('Email', 'dana@mail.com')
    type('Password', 'anything')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Your trips' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Me' })).toHaveAttribute('href', '/me')
  })

  it('after signing in, back to the exact page asked for (not just Your trips)', async () => {
    fake.auth.signInWithPassword.mockImplementation(async () => {
      fake.emit('SIGNED_IN', session)
      return { data: { session }, error: null }
    })
    open('/account')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    type('Email', 'dana@mail.com')
    type('Password', 'anything')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument()
  })

  it('never shows the page before knowing who is there', () => {
    fake.auth.getSession.mockImplementationOnce(() => new Promise(() => {}))
    open('/trips')
    expect(screen.getByRole('status')).toHaveTextContent(/Opening/)
    expect(screen.queryByRole('heading', { name: 'Your trips' })).not.toBeInTheDocument()
  })

  it('signing out goes back to sign in', async () => {
    fake.state.session = session
    open('/me')
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('already signed in → sign in sends straight to the trips', async () => {
    fake.state.session = session
    open('/sign-in')
    expect(await screen.findByRole('heading', { name: 'Your trips' })).toBeInTheDocument()
  })
})

describe('sign in', () => {
  it('shows each problem under its field, without asking the server', async () => {
    open('/sign-in')
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.')
    expect(fake.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows it is working while the server answers', async () => {
    let answer!: (value: unknown) => void
    fake.auth.signInWithPassword.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    open('/sign-in')
    await screen.findByLabelText('Email')
    type('Email', 'dana@mail.com')
    type('Password', 'anything')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    await act(async () => answer({ data: {}, error: { code: 'invalid_credentials', message: 'x' } }))
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong email or password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('an address not confirmed yet: explained, with the link sent again right there', async () => {
    fake.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })
    open('/sign-in')
    await screen.findByLabelText('Email')
    type('Email', 'dana@mail.com')
    type('Password', 'anything')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/Confirm your email first/)).toBeInTheDocument()
    fake.auth.resend.mockResolvedValue({ error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Send the link again' }))
    expect(await screen.findByText('A new link is on its way.')).toBeInTheDocument()
    expect(fake.auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'dana@mail.com' }))
  })

  it('just looking: the demo is one tap away', async () => {
    open('/sign-in')
    expect(await screen.findByRole('link', { name: 'Try it with a real trip ›' })).toHaveAttribute('href', '/demo')
  })
})

describe('email links (sign-in polish, 15 Nov)', () => {
  it('an old confirmation link: said, and a new one sent', async () => {
    fake.auth.resend.mockResolvedValue({ error: null })
    open('/trips#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'dana@mail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }))
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(fake.auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'dana@mail.com' }))
  })

  it('an old reset link: a new reset link', async () => {
    fake.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    open('/reset-password#error_code=otp_expired')
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'dana@mail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }))
    await screen.findByRole('heading', { name: 'Check your inbox' })
    expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith('dana@mail.com', expect.anything())
  })
})

describe('your account (sign-in polish, 15 Nov)', () => {
  beforeEach(() => fake.emit('SIGNED_IN', session))

  it('change my email: a link to the new address', async () => {
    fake.auth.updateUser.mockResolvedValue({ error: null })
    open('/account')
    fireEvent.click(await screen.findByRole('button', { name: 'Change my email' }))
    fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'dana@new.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    expect(await screen.findByText(/We sent a link to dana@new.com/)).toBeInTheDocument()
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ email: 'dana@new.com' }, expect.anything())
  })

  it('delete my account: asked once, then gone and signed out', async () => {
    fake.rpc.mockResolvedValue({ error: null })
    open('/account')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete my account…' }))
    expect(screen.getByText('The trips only you are on are deleted.')).toBeInTheDocument()
    expect(fake.rpc).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await vi.waitFor(() => expect(fake.auth.signOut).toHaveBeenCalled())
    expect(fake.rpc).toHaveBeenCalledWith('delete_my_account')
  })
})

describe('create an account', () => {
  async function fillSignUp(name: string, email: string, password: string) {
    open('/sign-up')
    await screen.findByLabelText('Your first name')
    type('Your first name', name)
    type('Email', email)
    type('Password', password)
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('our own leak check: a leaked password is refused before the account is made', async () => {
    pwned.isPwned.mockResolvedValueOnce(true)
    await fillSignUp('Dana', 'dana@mail.com', 'password')
    expect(await screen.findByText(/appeared in a data leak/)).toBeInTheDocument()
    expect(fake.auth.signUp).not.toHaveBeenCalled()
  })

  it('a password from a data leak gets its own message', async () => {
    fake.auth.signUp.mockResolvedValue({
      data: {},
      error: { code: 'weak_password', message: 'Password is known to be weak', reasons: ['pwned'] },
    })
    await fillSignUp('Dana', 'dana@mail.com', 'sunshine2024')
    expect(await screen.findByText(/appeared in a data leak/)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/We use your email only to sign you in/)).toBeInTheDocument()
  })

  it('checks every field before sending', async () => {
    await fillSignUp(' ', 'dana@mail.com', 'short')
    expect(screen.getByLabelText('Your first name')).toHaveAccessibleDescription('Enter your first name.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Use at least 8 characters.')
    expect(fake.auth.signUp).not.toHaveBeenCalled()
  })

  it('the password can be shown instead of typed twice', async () => {
    open('/sign-up')
    const field = await screen.findByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('keeps the first name, and asks to confirm the email when the server waits for it', async () => {
    fake.auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
    await fillSignUp(' Dana ', ' dana@mail.com ', 'long enough')
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(screen.getByText('dana@mail.com')).toBeInTheDocument()
    expect(fake.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'dana@mail.com',
        password: 'long enough',
        options: expect.objectContaining({ data: { first_name: 'Dana' } }),
      }),
    )
  })

  it('the confirmation link can be sent again', async () => {
    fake.auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
    fake.auth.resend.mockResolvedValue({ data: {}, error: null })
    await fillSignUp('Dana', 'dana@mail.com', 'long enough')
    fireEvent.click(await screen.findByRole('button', { name: 'send the link again' }))
    expect(await screen.findByText('A new link is on its way.')).toBeInTheDocument()
    expect(fake.auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'dana@mail.com' }))
  })

  it('an email already used is said on the email field', async () => {
    fake.auth.signUp.mockResolvedValue({ data: {}, error: { code: 'user_already_exists', message: 'x' } })
    await fillSignUp('Dana', 'dana@mail.com', 'long enough')
    expect(await screen.findByText(/already exists/)).toBeInTheDocument()
  })
})

describe('forgot password', () => {
  it('gives the same answer whether the account exists or not', async () => {
    fake.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    open('/forgot-password')
    await screen.findByLabelText('Email')
    type('Email', 'who@mail.com')
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument()
  })

  it('an expired link says what to do', async () => {
    open('/reset-password')
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toBeInTheDocument()
  })

  it('from the email link, a new password is saved and the trips open', async () => {
    fake.state.session = session
    fake.auth.updateUser.mockResolvedValue({ data: {}, error: null })
    open('/reset-password')
    await screen.findByLabelText('New password')
    type('New password', 'brand new pass')
    fireEvent.click(screen.getByRole('button', { name: 'Save the new password' }))
    expect(await screen.findByRole('heading', { name: 'Your trips' })).toBeInTheDocument()
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'brand new pass' })
  })
})

describe('your account', () => {
  it('Me (the bar at the bottom of Your trips) leads to your account', async () => {
    fake.state.session = session
    open('/trips')
    fireEvent.click(await screen.findByRole('link', { name: 'Me' }))
    expect(await screen.findByRole('link', { name: /Name, email, password/ })).toHaveAttribute('href', '/account')
  })

  it('change your first name, used in new trips', async () => {
    fake.state.session = { user: { email: 'dana@mail.com', user_metadata: { first_name: 'Dana' } } }
    fake.auth.updateUser.mockResolvedValue({ data: {}, error: null })
    open('/account')
    await screen.findByRole('heading', { name: 'Your account' })
    expect(screen.getByLabelText('First name')).toHaveValue('Dana')
    expect(screen.getByText('dana@mail.com')).toBeInTheDocument()
    type('First name', ' Danielle ')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved. New trips will use this name for you.')).toBeInTheDocument()
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ data: { first_name: 'Danielle' } })
  })

  it('a new password needs 8 characters', async () => {
    fake.state.session = session
    open('/account')
    await screen.findByRole('heading', { name: 'Your account' })
    type('New password', 'short')
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription('Use at least 8 characters.')
    expect(fake.auth.updateUser).not.toHaveBeenCalled()
  })

  it('menus-v5: the bar, ☰ and the footer', async () => {
    open('/')
    expect(screen.getAllByRole('link', { name: 'Try the demo' })[0]).toHaveAttribute('href', '/demo')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = document.getElementById('site-menu') as HTMLElement
    expect(within(menu).getByRole('link', { name: /How it works/ })).toHaveAttribute('href', '/#how')
    expect(within(menu).getByRole('link', { name: /See a real trip/ })).toHaveAttribute('href', '/demo')
    expect(within(menu).getByText('soon')).toBeInTheDocument() // the story, until it's written
    expect(within(menu).getByRole('link', { name: /Contact/ })).toHaveAttribute('href', 'mailto:hello@voyagefare.app')
    expect(within(menu).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.getElementById('site-menu')).toBeNull()
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })
})

describe('privacy', () => {
  it('in plain words: what we keep, why, who helps, your choices', () => {
    open('/privacy')
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument()
    for (const h of ['What we keep', 'Why', 'Who helps us', 'Your choices', 'Who’s behind it'])
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
  })
})
