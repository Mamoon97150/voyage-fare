// First: read an email link's error before the Supabase client clears it from the address.
import './lib/linkAtStart'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/pwa'
import { applyTheme, watchSystemTheme } from './lib/theme'

registerServiceWorker()
applyTheme()
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
