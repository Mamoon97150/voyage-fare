import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('shows the name and the promise', () => {
  render(<App />)
  expect(screen.getByText('Voyage Fare')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/what it really costs/)
})
