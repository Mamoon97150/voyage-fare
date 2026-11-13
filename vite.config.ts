import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // The smoke test talks to the real Supabase project with the demo account: run it on demand.
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
  },
})
