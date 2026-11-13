import { defineConfig, loadEnv } from 'vite'

// The smoke test runs the app's real queries against the Supabase project, signed in as the
// demo user (.env.local: VITE_SUPABASE_*, DEMO_USER_EMAIL, DEMO_USER_PASSWORD). Run it by hand
// before a commit that touches data: npm run test:smoke. It cleans up after itself.
export default defineConfig(({ mode }) => ({
  test: {
    include: ['tests/smoke/**/*.test.ts'],
    environment: 'node',
    env: loadEnv(mode === 'test' ? 'development' : mode, process.cwd(), ''),
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
}))
