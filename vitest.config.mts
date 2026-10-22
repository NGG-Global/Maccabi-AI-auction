import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The integration suite talks to a real Postgres and needs more than the default.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
