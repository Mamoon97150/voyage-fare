import { act, fireEvent, render, screen } from '@testing-library/react'
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
      signOut: vi.fn(async () => emit('SIGNED_OUT', null)),
    },
  }
})

vi.mock('./lib/supabase', () => ({ supabase: { auth: fake.auth } }))

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
    expect(screen.getByText('Voyage Fare')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/what it really costs/)
    expect(await screen.findByRole('link', { name: 'Create an account' })).toBeInTheDocument()
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
    expect(screen.getByText('dana@mail.com')).toBeInTheDocument()
  })

  it('never shows the page before knowing who is there', () => {
    fake.auth.getSession.mockImplementationOnce(() => new Promise(() => {}))
    open('/trips')
    expect(screen.getByRole('status')).toHaveTextContent(/Opening/)
    expect(screen.queryByRole('heading', { name: 'Your trips' })).not.toBeInTheDocument()
  })

  it('signing out goes back to sign in', async () => {
    fake.state.session = session
    open('/trips')
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

  it('an address not confirmed yet is explained on the email field', async () => {
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
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('create an account', () => {
  it('checks the password before sending', async () => {
    open('/sign-up')
    await screen.findByLabelText('Email')
    type('Email', 'dana@mail.com')
    type('Password', 'short')
    type('Password again', 'shorter')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Use at least 8 characters.')
    expect(screen.getByLabelText('Password again')).toHaveAccessibleDescription('The two passwords don’t match.')
    expect(fake.auth.signUp).not.toHaveBeenCalled()
  })

  it('asks to confirm the email when the server waits for it', async () => {
    fake.auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
    open('/sign-up')
    await screen.findByLabelText('Email')
    type('Email', ' dana@mail.com ')
    type('Password', 'long enough')
    type('Password again', 'long enough')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(screen.getByText('dana@mail.com')).toBeInTheDocument()
    expect(fake.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'dana@mail.com', password: 'long enough' }),
    )
  })

  it('an email already used is said on the email field', async () => {
    fake.auth.signUp.mockResolvedValue({ data: {}, error: { code: 'user_already_exists', message: 'x' } })
    open('/sign-up')
    await screen.findByLabelText('Email')
    type('Email', 'dana@mail.com')
    type('Password', 'long enough')
    type('Password again', 'long enough')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
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
    type('New password again', 'brand new pass')
    fireEvent.click(screen.getByRole('button', { name: 'Save the new password' }))
    expect(await screen.findByRole('heading', { name: 'Your trips' })).toBeInTheDocument()
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'brand new pass' })
  })
})
