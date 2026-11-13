import { defineConfig, loadEnv } from 'vite'

// The seeds write real trips into the demo account (npm run seed:colombia). They replace their own trip, nothing else.
export default defineConfig(({ mode }) => ({
  test: {
    include: ['tests/seed/**/*.seed.ts'],
    environment: 'node',
    env: loadEnv(mode === 'test' ? 'development' : mode, process.cwd(), ''),
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
}))
