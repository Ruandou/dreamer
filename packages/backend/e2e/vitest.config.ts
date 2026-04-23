import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./e2e/utils/setup.ts'],
    include: ['e2e/**/*.e2e.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true
  }
})
